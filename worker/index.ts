import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { TaskStatus } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { recordAudit } from "../src/domain/audit";
import { createApprovalRequest } from "../src/domain/approvals";
import { getActivePlanner, getPlannerMode } from "../src/providers";
import { copyProjectMedia, writeProjectArtifact } from "../src/lib/paths";
import { gateExternalAction } from "../src/tools/policy";
import { OpenCodeAdapter } from "../src/tools/opencode-adapter";
import { ImageStudioAdapter } from "../src/tools/image-studio-adapter";
import { PostizAdapter } from "../src/tools/postiz-adapter";
import { N8nAdapter } from "../src/tools/n8n-adapter";
import type { StructuredPlan } from "../src/domain/schemas";
import { processDueSchedules } from "../src/domain/schedules";
import { createSqliteBackup } from "../src/lib/backup";
import { selectNextQueuedRunId } from "../src/domain/prioritization";
import { checkBudget, consumeBudget } from "../src/domain/budgets";
import {
  consolidateTaskOutcome,
  memoriesForPlanning,
  upsertProjectMemory,
} from "../src/domain/memory";
import { writeAutiqWeeklyCalendar } from "../src/tools/autiq-calendar";
import { appendAllowlistedNote } from "../src/tools/allowlisted-append";
import { AppendAllowlistedNoteSchema } from "../src/domain/schemas";
import {
  parseAndSanitizeWeeklyBrief,
  proposeNextWeekTheme,
  WeeklyBriefSchema,
} from "../src/domain/content-loop";

const WORKER_ID = `worker-${process.pid}`;
const POLL_MS = 1500;
const IDLE_POLL_MS = 5_000;
const SCHEDULE_TICK_MS = 15_000;
const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Long enough for Image Studio Comfy polls (M4) without mid-job reclaim. */
const LEASE_MS = 420_000;
const MAX_ATTEMPTS = 3;
/**
 * Exit when idle so GPU/CPU are not held for nothing.
 * Default 5 minutes. Set FACCI_WORKER_IDLE_EXIT_MS=0 to keep worker always on.
 * Waiting_approval does not count as work. Enabled schedules keep the worker alive.
 */
const IDLE_EXIT_MS = (() => {
  const raw = process.env.FACCI_WORKER_IDLE_EXIT_MS;
  if (raw === undefined || raw === "") return 5 * 60 * 1000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 5 * 60 * 1000;
})();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function reclaimExpiredLeases() {
  const now = new Date();
  const expired = await prisma.taskRun.findMany({
    where: {
      status: { in: [TaskStatus.planning, TaskStatus.running, TaskStatus.verifying] },
      leaseExpiresAt: { lt: now },
    },
  });
  for (const run of expired) {
    await prisma.taskRun.update({
      where: { id: run.id },
      data: {
        status: TaskStatus.queued,
        leaseOwner: null,
        leaseExpiresAt: null,
        errorCode: "lease_expired",
        errorMessage: "Lease expired — requeued for recovery",
      },
    });
    await prisma.task.update({
      where: { id: run.taskId },
      data: { status: TaskStatus.queued },
    });
    await recordAudit({
      actor: WORKER_ID,
      verb: "worker.lease_reclaimed",
      target: run.id,
    });
  }
}

async function claimNextRun() {
  await reclaimExpiredLeases();

  const nextId = await selectNextQueuedRunId();
  if (!nextId) return null;

  const candidate = await prisma.taskRun.findUnique({
    where: { id: nextId },
    include: {
      task: {
        include: {
          project: true,
          assignedAgent: true,
        },
      },
    },
  });
  if (!candidate || candidate.status !== TaskStatus.queued) return null;
  if (candidate.task.status !== TaskStatus.queued) return null;

  // M6: block claim when monthly plan budget exhausted
  const planBudget = await checkBudget({
    organizationId: candidate.task.project.organizationId,
    projectId: candidate.task.projectId,
    dimension: "planCalls",
  });
  if (!planBudget.allowed) {
    await prisma.task.update({
      where: { id: candidate.taskId },
      data: { status: TaskStatus.blocked, completedAt: new Date() },
    });
    await prisma.taskRun.update({
      where: { id: candidate.id },
      data: {
        status: TaskStatus.blocked,
        endedAt: new Date(),
        errorCode: "budget_exhausted",
        errorMessage: planBudget.reason,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    await recordAudit({
      projectId: candidate.task.projectId,
      actor: WORKER_ID,
      verb: "task.budget_blocked",
      target: candidate.taskId,
      payload: { reason: planBudget.reason },
    });
    return null;
  }

  const planner = getActivePlanner();
  const leaseExpiresAt = new Date(Date.now() + LEASE_MS);
  const claimed = await prisma.taskRun.updateMany({
    where: {
      id: candidate.id,
      status: TaskStatus.queued,
      OR: [{ leaseOwner: null }, { leaseExpiresAt: { lt: new Date() } }],
    },
    data: {
      status: TaskStatus.planning,
      leaseOwner: WORKER_ID,
      leaseExpiresAt,
      startedAt: candidate.startedAt ?? new Date(),
      modelProvider: planner.id,
    },
  });
  if (claimed.count !== 1) return null;

  await prisma.task.update({
    where: { id: candidate.taskId },
    data: { status: TaskStatus.planning },
  });

  return prisma.taskRun.findUniqueOrThrow({
    where: { id: candidate.id },
    include: {
      task: {
        include: {
          project: {
            include: {
              agents: { where: { status: "active" } },
              memories: { orderBy: { updatedAt: "desc" }, take: 16 },
              goals: { take: 3 },
            },
          },
        },
      },
    },
  });
}

async function extendLease(runId: string) {
  await prisma.taskRun.update({
    where: { id: runId },
    data: { leaseExpiresAt: new Date(Date.now() + LEASE_MS) },
  });
}

async function stillActive(taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  return !!task && task.status !== TaskStatus.cancelled;
}

function artifactExists(storageRef: string): boolean {
  if (fs.existsSync(storageRef)) return true;
  return fs.existsSync(path.join(process.cwd(), storageRef));
}

async function persistProjectPlanMemory(params: {
  projectId: string;
  taskId: string;
  plan: StructuredPlan;
}) {
  const content = [
    `Task ${params.taskId}`,
    `Planner: ${params.plan.labeledAs}`,
    params.plan.modelId ? `Model: ${params.plan.modelId}` : null,
    params.plan.reasoningSummary ? `Reasoning: ${params.plan.reasoningSummary}` : null,
    `Specialist: ${params.plan.specialistTemplateKey}`,
    `Steps: ${params.plan.steps.map((s) => s.actionType).join(" -> ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  await prisma.projectMemory.create({
    data: {
      projectId: params.projectId,
      category: "plan_history",
      content: content.slice(0, 2000),
      sourceRef: params.taskId,
      visibility: "project",
      lastVerifiedAt: new Date(),
    },
  });
}

async function executeRun(
  run: NonNullable<Awaited<ReturnType<typeof claimNextRun>>>,
) {
  const planner = getActivePlanner();
  const { task } = run;
  const project = task.project;

  const specialists = project.agents
    .filter((a) => a.role === "specialist")
    .map((a) => a.templateKey);

  await recordAudit({
    projectId: project.id,
    actor: WORKER_ID,
    verb: "task.planning",
    target: task.id,
    payload: {
      planner: planner.label,
      isLiveModel: planner.isLiveModel,
      mode: getPlannerMode(),
    },
  });

  const health = await planner.checkHealth();
  if (!health.healthy) {
    throw new Error(
      `Planner unhealthy — refusing to simulate: ${health.details ?? planner.id}`,
    );
  }

  const planningMemories = await memoriesForPlanning(project.id, 16);
  const plan = await planner.generateStructuredPlan({
    projectSlug: project.slug,
    projectName: project.name,
    projectMission: project.mission,
    title: task.title,
    objective: task.objective,
    availableSpecialists: specialists,
    projectMemories: planningMemories.map((m) => ({
      category: m.category,
      content: m.verified ? m.content : `[unverified] ${m.content}`,
    })),
  });

  // Enforce project isolation on plan slug
  if (plan.projectSlug !== project.slug) {
    throw new Error(
      `Plan projectSlug mismatch (isolation): plan=${plan.projectSlug} task=${project.slug}`,
    );
  }

  await consumeBudget({
    organizationId: project.organizationId,
    projectId: project.id,
    dimension: "planCalls",
  });

  await prisma.taskRun.update({
    where: { id: run.id },
    data: {
      modelProvider: plan.plannerId,
      modelId: plan.modelId ?? null,
      planJson: JSON.stringify(plan),
      planLatencyMs: plan.latencyMs ?? null,
    },
  });

  await recordAudit({
    projectId: project.id,
    actor: WORKER_ID,
    verb: "task.plan_validated",
    target: task.id,
    payload: {
      plannerId: plan.plannerId,
      modelId: plan.modelId ?? null,
      latencyMs: plan.latencyMs ?? null,
      isLiveModel: plan.isLiveModel,
      stepCount: plan.steps.length,
      specialistTemplateKey: plan.specialistTemplateKey,
    },
  });

  await persistProjectPlanMemory({
    projectId: project.id,
    taskId: task.id,
    plan,
  });

  if (!(await stillActive(task.id))) return;

  // Planning-only plans: store validated plan, mark blocked/completed honestly without fake side effects
  if (
    plan.planningOnly &&
    !plan.steps.some(
      (s) =>
        s.produceArtifact ||
        s.requiresApproval ||
        s.actionType === "run_developer_task" ||
        s.actionType === "update_brand_calendar" ||
        s.actionType === "append_allowlisted_note" ||
        s.actionType === "run_image_studio_task" ||
        s.actionType === "stage_social_draft" ||
        s.actionType === "prepare_n8n_workflow",
    )
  ) {
    for (const step of plan.steps) {
      await prisma.taskStep.create({
        data: {
          runId: run.id,
          sequence: step.sequence,
          actionType: step.actionType,
          inputSummary: step.summary,
          outputSummary: "Plan recorded only — no execution claimed",
          status: TaskStatus.completed,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      });
    }
    await prisma.taskRun.update({
      where: { id: run.id },
      data: {
        status: TaskStatus.completed,
        endedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        errorCode: "planning_only",
        errorMessage: "Validated AI plan stored; no executable local steps claimed as done.",
      },
    });
    await prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.completed, completedAt: new Date() },
    });
    return;
  }

  await prisma.taskRun.update({
    where: { id: run.id },
    data: { status: TaskStatus.running },
  });
  await prisma.task.update({
    where: { id: task.id },
    data: { status: TaskStatus.running },
  });
  await extendLease(run.id);

  const ceo = await prisma.agent.findFirst({
    where: { organizationId: project.organizationId, role: "ceo" },
  });
  const manager = project.agents.find((a) => a.role === "manager");
  if (!manager) throw new Error("Missing project manager");

  let executedArtifact = false;
  let executedDeveloper = false;
  let waitingApproval = false;
  const openCodeAdapter = new OpenCodeAdapter();
  /** Images produced earlier in this run for packaging into one review draft. */
  const pipelineImages: {
    generationId: string | null;
    studioUrl: string | null;
    facciArtifactId: string;
    storageRef: string;
    viewPath: string;
  }[] = [];

  for (const step of plan.steps) {
    if (!(await stillActive(task.id))) return;
    await extendLease(run.id);

    let agentId: string | null = null;
    if (step.agentRole === "ceo") agentId = ceo?.id ?? null;
    else if (step.agentRole === "manager") agentId = manager.id;
    else {
      const specialist =
        project.agents.find(
          (a) => a.role === "specialist" && a.templateKey === step.agentTemplateKey,
        ) ??
        project.agents.find(
          (a) =>
            a.role === "specialist" && a.templateKey === plan.specialistTemplateKey,
        );
      agentId = specialist?.id ?? manager.id;
      // Isolation: never assign another project's agent
      if (specialist && specialist.projectId !== project.id) {
        throw new Error("Cross-project agent assignment blocked");
      }
    }

    // Resumable runs: same (runId, sequence) may already exist after lease reclaim.
    const existingStep = await prisma.taskStep.findUnique({
      where: { runId_sequence: { runId: run.id, sequence: step.sequence } },
    });
    if (existingStep?.status === TaskStatus.completed) {
      if (existingStep.actionType === "run_developer_task") executedDeveloper = true;
      if (existingStep.evidenceRef) executedArtifact = true;
      continue;
    }

    const stepRow = existingStep
      ? await prisma.taskStep.update({
          where: { id: existingStep.id },
          data: {
            agentId,
            actionType: step.actionType,
            inputSummary: step.summary,
            status: TaskStatus.running,
            startedAt: new Date(),
            endedAt: null,
            outputSummary: null,
            evidenceRef: null,
          },
        })
      : await prisma.taskStep.create({
          data: {
            runId: run.id,
            sequence: step.sequence,
            agentId,
            actionType: step.actionType,
            inputSummary: step.summary,
            status: TaskStatus.running,
            startedAt: new Date(),
          },
        });

    await recordAudit({
      projectId: project.id,
      actor: agentId ?? WORKER_ID,
      verb: `step.${step.actionType}`,
      target: task.id,
      payload: {
        sequence: step.sequence,
        summary: step.summary,
        planner: plan.labeledAs,
        modelId: plan.modelId ?? null,
        resumed: Boolean(existingStep),
      },
    });

    if (step.requiresApproval && step.approvalActionType) {
      const gate = gateExternalAction(step.approvalActionType);
      const payload = {
        action: step.approvalActionType,
        projectId: project.id,
        taskId: task.id,
        preview: step.summary,
        note: "Will not execute external side effects even if approved (M3 policy)",
      };
      await createApprovalRequest({
        taskId: task.id,
        requestedByAgentId: agentId,
        actionType: step.approvalActionType,
        actionSummary: step.summary,
        riskLevel: step.riskLevel ?? "high",
        payload,
      });
      await prisma.taskStep.update({
        where: { id: stepRow.id },
        data: {
          status: TaskStatus.waiting_approval,
          outputSummary: gate.reason,
          endedAt: new Date(),
        },
      });
      await prisma.taskRun.update({
        where: { id: run.id },
        data: {
          status: TaskStatus.waiting_approval,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      waitingApproval = true;
      return;
    }

    if (step.actionType === "run_developer_task") {
      if (!step.developerTask) {
        throw new Error("run_developer_task missing developerTask payload");
      }
      const result = await openCodeAdapter.execute(
        {
          toolId: "opencode",
          action: "developer_edit",
          projectId: project.id,
          agentId: agentId ?? manager.id,
          taskId: task.id,
          input: step.developerTask,
          idempotencyKey: `${task.id}:${step.sequence}:dev`,
        },
        AbortSignal.timeout(360_000),
      );

      const evidenceName = `${Date.now()}-${project.slug}-dev-evidence.md`;
      const written = writeProjectArtifact({
        projectSlug: project.slug,
        filename: evidenceName,
        content: result.evidenceMarkdown,
      });
      const contentHash = createHash("sha256")
        .update(result.evidenceMarkdown)
        .digest("hex");
      const artifact = await prisma.artifact.create({
        data: {
          projectId: project.id,
          taskId: task.id,
          kind: "developer-evidence",
          title: `Developer evidence: ${step.developerTask.workspaceId}`,
          storageRef: written.storageRef,
          contentHash,
          metadataJson: JSON.stringify({
            executor: result.executor,
            modelId: result.modelId ?? null,
            changedFiles: result.changedFiles,
            rollbackSnapshotRef: result.rollbackSnapshotRef,
            testsPassed: result.test.passed,
            opencodeAvailable: result.opencodeAvailable,
            opencodeAttempted: result.opencodeAttempted,
            opencodeError: result.opencodeError ?? null,
            phase: "executed",
          }),
        },
      });

      await prisma.taskStep.update({
        where: { id: stepRow.id },
        data: {
          status: TaskStatus.completed,
          outputSummary: `Executed via ${result.executor}: ${result.changedFiles.join(", ")} · tests ${result.test.passed ? "passed" : "n/a"}`,
          evidenceRef: artifact.id,
          endedAt: new Date(),
        },
      });
      await recordAudit({
        projectId: project.id,
        actor: agentId ?? WORKER_ID,
        verb:
          result.executor === "opencode"
            ? "tool.opencode.executed"
            : "tool.bounded_patch.executed",
        target: task.id,
        payload: {
          executor: result.executor,
          workspaceId: result.workspaceId,
          changedFiles: result.changedFiles,
          rollbackSnapshotRef: result.rollbackSnapshotRef,
          testsPassed: result.test.passed,
          opencodeAttempted: result.opencodeAttempted,
          opencodeAvailable: result.opencodeAvailable,
          opencodeError: result.opencodeError ?? null,
        },
      });
      executedDeveloper = true;
      executedArtifact = true;
      continue;
    }

    if (step.actionType === "update_brand_calendar") {
      if (!step.brandCalendarTask) {
        throw new Error("update_brand_calendar missing brandCalendarTask payload");
      }
      const brief = WeeklyBriefSchema.parse(step.brandCalendarTask);
      const result = writeAutiqWeeklyCalendar(brief);
      const evidenceName = `${Date.now()}-${project.slug}-calendar-evidence.md`;
      const written = writeProjectArtifact({
        projectSlug: project.slug,
        filename: evidenceName,
        content: result.evidenceMarkdown,
      });
      const contentHash = createHash("sha256")
        .update(result.evidenceMarkdown)
        .digest("hex");
      const artifact = await prisma.artifact.create({
        data: {
          projectId: project.id,
          taskId: task.id,
          kind: "calendar-evidence",
          title: `Calendar update: ${result.updatedChannels.join(", ")}`,
          storageRef: written.storageRef,
          contentHash,
          metadataJson: JSON.stringify({
            executor: "deterministic-calendar-writer",
            workspaceId: result.workspaceId,
            relativePath: result.relativePath,
            updatedChannels: result.updatedChannels,
            weekLabel: result.weekLabel,
            phase: "executed",
          }),
        },
      });
      await prisma.taskStep.update({
        where: { id: stepRow.id },
        data: {
          status: TaskStatus.completed,
          outputSummary: `Wrote ${result.updatedChannels.join(", ")} into ${result.relativePath}`,
          evidenceRef: artifact.id,
          endedAt: new Date(),
        },
      });
      await recordAudit({
        projectId: project.id,
        actor: agentId ?? WORKER_ID,
        verb: "tool.brand_calendar.updated",
        target: task.id,
        payload: {
          workspaceId: result.workspaceId,
          relativePath: result.relativePath,
          updatedChannels: result.updatedChannels,
          weekLabel: result.weekLabel,
        },
      });
      executedArtifact = true;
      continue;
    }

    if (step.actionType === "append_allowlisted_note") {
      if (!step.appendAllowlistedNote) {
        throw new Error("append_allowlisted_note missing appendAllowlistedNote payload");
      }
      const payload = AppendAllowlistedNoteSchema.parse(step.appendAllowlistedNote);
      const result = appendAllowlistedNote(payload);
      const evidenceName = `${Date.now()}-${project.slug}-append-evidence.md`;
      const written = writeProjectArtifact({
        projectSlug: project.slug,
        filename: evidenceName,
        content: result.evidenceMarkdown,
      });
      const contentHash = createHash("sha256")
        .update(result.evidenceMarkdown)
        .digest("hex");
      const artifact = await prisma.artifact.create({
        data: {
          projectId: project.id,
          taskId: task.id,
          kind: "append-evidence",
          title: `Append note: ${result.relativePath}`,
          storageRef: written.storageRef,
          contentHash,
          metadataJson: JSON.stringify({
            executor: "deterministic-allowlisted-append",
            workspaceId: result.workspaceId,
            relativePath: result.relativePath,
            absolutePath: result.absolutePath,
            phase: "executed",
          }),
        },
      });
      await prisma.taskStep.update({
        where: { id: stepRow.id },
        data: {
          status: TaskStatus.completed,
          outputSummary: `Appended note to ${result.relativePath} (${result.workspaceId})`,
          evidenceRef: artifact.id,
          endedAt: new Date(),
        },
      });
      await recordAudit({
        projectId: project.id,
        actor: agentId ?? WORKER_ID,
        verb: "tool.allowlisted_append.executed",
        target: task.id,
        payload: {
          workspaceId: result.workspaceId,
          relativePath: result.relativePath,
        },
      });
      executedArtifact = true;
      continue;
    }

    if (step.actionType === "run_image_studio_task") {
      if (!step.imageStudioTask) {
        throw new Error("run_image_studio_task missing imageStudioTask payload");
      }
      const imageBudget = await checkBudget({
        organizationId: project.organizationId,
        projectId: project.id,
        dimension: "imageGens",
      });
      if (!imageBudget.allowed) {
        throw new Error(imageBudget.reason);
      }
      const imageAdapter = new ImageStudioAdapter();
      const result = await imageAdapter.execute(
        {
          toolId: "image-studio",
          action: "generate",
          projectId: project.id,
          agentId: agentId ?? manager.id,
          taskId: task.id,
          input: step.imageStudioTask,
          idempotencyKey: `${task.id}:${step.sequence}:image`,
        },
        AbortSignal.timeout(360_000),
      );

      // Copy Studio outputs into FACCI-owned media so the dashboard can view them.
      const copiedMediaIds: string[] = [];
      if (result.executed && result.status === "completed") {
        for (const cand of result.localMediaCandidates) {
          if (!fs.existsSync(cand.sourcePath)) continue;
          const copied = copyProjectMedia({
            projectSlug: project.slug,
            sourceAbsolutePath: cand.sourcePath,
            filename: `${Date.now()}-${cand.filename}`,
          });
          const buf = fs.readFileSync(copied.absolutePath);
          const mediaArt = await prisma.artifact.create({
            data: {
              projectId: project.id,
              taskId: task.id,
              kind: "generated-image",
              title: `Generated image ${result.generationId ?? ""}`.trim(),
              storageRef: copied.storageRef,
              contentHash: createHash("sha256").update(buf).digest("hex"),
              metadataJson: JSON.stringify({
                generationId: result.generationId ?? null,
                studioUrl: cand.studioUrl ?? null,
                sourcePath: cand.sourcePath,
                mimeType: "image/png",
              }),
            },
          });
          copiedMediaIds.push(mediaArt.id);
          pipelineImages.push({
            generationId: result.generationId ?? null,
            studioUrl: cand.studioUrl ?? null,
            facciArtifactId: mediaArt.id,
            storageRef: copied.storageRef,
            viewPath: `/api/artifacts/${mediaArt.id}/file`,
          });
        }
      }

      const justCopied = pipelineImages.filter((m) =>
        copiedMediaIds.includes(m.facciArtifactId),
      );
      const facciLinks =
        justCopied.length > 0
          ? `\n## FACCI-local copies (viewable in dashboard)\n${justCopied
              .map((m) => `- ${m.viewPath} (\`${m.storageRef}\`)`)
              .join("\n")}\n`
          : "";
      const evidenceBody = `${result.evidenceMarkdown}${facciLinks}`;
      const evidenceName = `${Date.now()}-${project.slug}-image-evidence.md`;
      const written = writeProjectArtifact({
        projectSlug: project.slug,
        filename: evidenceName,
        content: evidenceBody,
      });
      const artifact = await prisma.artifact.create({
        data: {
          projectId: project.id,
          taskId: task.id,
          kind: "image-studio-evidence",
          title: `Image Studio: ${result.generationId ?? "prepared"}`,
          storageRef: written.storageRef,
          contentHash: createHash("sha256").update(evidenceBody).digest("hex"),
          metadataJson: JSON.stringify({
            executed: result.executed,
            preparedOnly: result.preparedOnly,
            generationId: result.generationId ?? null,
            status: result.status ?? null,
            outputUrls: result.outputUrls,
            facciMediaArtifactIds: copiedMediaIds,
            error: result.error ?? null,
            phase: result.executed && result.status === "completed" ? "executed" : "incomplete",
          }),
        },
      });
      const success =
        result.executed &&
        result.status === "completed" &&
        (result.outputUrls.length > 0 ||
          result.outputPaths.length > 0 ||
          copiedMediaIds.length > 0);
      const preparedOk = result.preparedOnly && Boolean(result.evidenceMarkdown);
      if (!success && !preparedOk) {
        await prisma.taskStep.update({
          where: { id: stepRow.id },
          data: {
            status: TaskStatus.failed,
            outputSummary: result.error ?? "Image Studio step failed",
            evidenceRef: artifact.id,
            endedAt: new Date(),
          },
        });
        throw new Error(result.error ?? "Image Studio generation failed without outputs");
      }
      await prisma.taskStep.update({
        where: { id: stepRow.id },
        data: {
          status: TaskStatus.completed,
          outputSummary: success
            ? `Image Studio completed generation ${result.generationId}; FACCI media=${copiedMediaIds.length}`
            : `Image Studio prepared-only: ${result.error ?? "not executed"}`,
          evidenceRef: artifact.id,
          endedAt: new Date(),
        },
      });
      await recordAudit({
        projectId: project.id,
        actor: agentId ?? WORKER_ID,
        verb: success ? "tool.image_studio.executed" : "tool.image_studio.prepared",
        target: task.id,
        payload: {
          generationId: result.generationId ?? null,
          status: result.status ?? null,
          preparedOnly: result.preparedOnly,
          outputCount: result.outputUrls.length,
          facciMediaCount: copiedMediaIds.length,
          error: result.error ?? null,
        },
      });
      if (result.executed && result.status === "completed") {
        await consumeBudget({
          organizationId: project.organizationId,
          projectId: project.id,
          dimension: "imageGens",
        });
      }
      executedArtifact = true;
      continue;
    }

    if (step.actionType === "stage_social_draft") {
      if (!step.socialDraft) {
        throw new Error("stage_social_draft missing socialDraft payload");
      }
      const imageUrls = [
        ...(step.socialDraft.imageUrls ?? []),
        ...pipelineImages.map((m) => m.studioUrl).filter((u): u is string => Boolean(u)),
        ...pipelineImages.map((m) => m.viewPath),
      ];
      const postiz = new PostizAdapter();
      const result = await postiz.stageDraft(
        {
          toolId: "postiz",
          action: "stage_draft",
          projectId: project.id,
          agentId: agentId ?? manager.id,
          taskId: task.id,
          input: {
            ...step.socialDraft,
            imageUrls: imageUrls.length ? [...new Set(imageUrls)] : undefined,
          },
          idempotencyKey: `${task.id}:${step.sequence}:social`,
        },
        project.slug,
      );
      const evidenceName = `${Date.now()}-${project.slug}-social-evidence.md`;
      const written = writeProjectArtifact({
        projectSlug: project.slug,
        filename: evidenceName,
        content: result.evidenceMarkdown,
      });
      const artifact = await prisma.artifact.create({
        data: {
          projectId: project.id,
          taskId: task.id,
          kind: "social-draft-evidence",
          title: result.postizDraftCreated
            ? `Postiz draft ${result.postizPostId}`
            : "Local social staging",
          storageRef: written.storageRef,
          contentHash: createHash("sha256").update(result.evidenceMarkdown).digest("hex"),
          metadataJson: JSON.stringify({
            stagedLocally: result.stagedLocally,
            postizDraftCreated: result.postizDraftCreated,
            postizPostId: result.postizPostId ?? null,
            localStagingRef: result.localStagingRef,
            calendarRef: result.calendarRef,
            error: result.error ?? null,
          }),
        },
      });
      if (!result.stagedLocally) {
        throw new Error(result.error ?? "Social staging failed");
      }

      // One reviewable package: caption + FACCI-local image(s). Never publish.
      const imageBlocks =
        pipelineImages.length > 0
          ? pipelineImages
              .map(
                (m, i) =>
                  `### Image ${i + 1}\n\n![Generated draft ${i + 1}](${m.viewPath})\n\n- FACCI view: \`${m.viewPath}\`\n- Storage: \`${m.storageRef}\`\n- Studio generation: \`${m.generationId ?? "n/a"}\`\n`,
              )
              .join("\n")
          : "_No FACCI-local image was attached (generation missing or copy failed)._\n";
      const packageMd = `# Instagram review draft (not published)

- Project: ${project.slug}
- Task: ${task.title}
- Channel: ${step.socialDraft.channel}
- Status: **local review only** — no Postiz schedule/publish, no Instagram send
- Postiz draft created: **${result.postizDraftCreated ? "yes" : "no"}**${
        result.postizDraftCreated ? ` (\`${result.postizPostId}\`)` : " (not configured / unreachable)"
      }

## Caption

${step.socialDraft.caption}

## Images

${imageBlocks}

## Tool evidence

- Social staging: \`${result.localStagingRef}\`
- Calendar JSON: \`${result.calendarRef}\`
- Specialists in plan: image → social (publish requires separate owner approval)

---
_Assembled by FACCI worker after real Image Studio generation + local staging. Not an external publish receipt._
`;
      const packageWritten = writeProjectArtifact({
        projectSlug: project.slug,
        filename: `${Date.now()}-${project.slug}-instagram-review-draft.md`,
        content: packageMd,
      });
      const packageArt = await prisma.artifact.create({
        data: {
          projectId: project.id,
          taskId: task.id,
          kind: "instagram-review-draft",
          title: "Instagram review draft (image + caption)",
          storageRef: packageWritten.storageRef,
          contentHash: createHash("sha256").update(packageMd).digest("hex"),
          metadataJson: JSON.stringify({
            channel: step.socialDraft.channel,
            published: false,
            scheduled: false,
            postizDraftCreated: result.postizDraftCreated,
            imageArtifactIds: pipelineImages.map((m) => m.facciArtifactId),
            viewPaths: pipelineImages.map((m) => m.viewPath),
          }),
        },
      });

      await prisma.taskStep.update({
        where: { id: stepRow.id },
        data: {
          status: TaskStatus.completed,
          outputSummary: result.postizDraftCreated
            ? `Postiz draft + review package ${packageArt.id}`
            : `Local review package ${packageArt.id} (image+caption); Postiz not used`,
          evidenceRef: packageArt.id,
          endedAt: new Date(),
        },
      });
      await recordAudit({
        projectId: project.id,
        actor: agentId ?? WORKER_ID,
        verb: result.postizDraftCreated
          ? "tool.postiz.draft_created"
          : "tool.social.staged_local",
        target: task.id,
        payload: {
          postizDraftCreated: result.postizDraftCreated,
          postizPostId: result.postizPostId ?? null,
          localStagingRef: result.localStagingRef,
          reviewPackageArtifactId: packageArt.id,
          imageCount: pipelineImages.length,
          published: false,
          error: result.error ?? null,
        },
      });
      executedArtifact = true;
      continue;
    }

    if (step.actionType === "prepare_n8n_workflow") {
      if (!step.n8nJob) {
        throw new Error("prepare_n8n_workflow missing n8nJob payload");
      }
      const n8n = new N8nAdapter();
      const result = await n8n.prepare({
        toolId: "n8n",
        action: "prepare",
        projectId: project.id,
        agentId: agentId ?? manager.id,
        taskId: task.id,
        input: step.n8nJob,
        idempotencyKey: `${task.id}:${step.sequence}:n8n`,
      });
      if (result.liveExecuted) {
        throw new Error("n8n adapter claimed live execution — refusing (policy)");
      }
      const evidenceName = `${Date.now()}-${project.slug}-n8n-evidence.md`;
      const written = writeProjectArtifact({
        projectSlug: project.slug,
        filename: evidenceName,
        content: result.evidenceMarkdown,
      });
      const artifact = await prisma.artifact.create({
        data: {
          projectId: project.id,
          taskId: task.id,
          kind: "n8n-evidence",
          title: "n8n dry-run / prepare",
          storageRef: written.storageRef,
          contentHash: createHash("sha256").update(result.evidenceMarkdown).digest("hex"),
          metadataJson: JSON.stringify({
            dryRun: result.dryRun,
            liveExecuted: result.liveExecuted,
            workflowCount: result.workflows.length,
            apiAuthorized: result.health.apiAuthorized,
            error: result.error ?? null,
          }),
        },
      });
      await prisma.taskStep.update({
        where: { id: stepRow.id },
        data: {
          status: TaskStatus.completed,
          outputSummary: result.health.apiAuthorized
            ? `n8n dry-run OK — ${result.workflows.length} workflow(s) listed`
            : `n8n prepare recorded — ${result.error ?? result.health.details}`,
          evidenceRef: artifact.id,
          endedAt: new Date(),
        },
      });
      await recordAudit({
        projectId: project.id,
        actor: agentId ?? WORKER_ID,
        verb: "tool.n8n.prepared",
        target: task.id,
        payload: {
          dryRun: true,
          liveExecuted: false,
          workflowCount: result.workflows.length,
          apiAuthorized: result.health.apiAuthorized,
        },
      });
      executedArtifact = true;
      continue;
    }

    if (step.actionType === "request_merge_code") {
      const gate = gateExternalAction("merge_code");
      await createApprovalRequest({
        taskId: task.id,
        requestedByAgentId: agentId,
        actionType: "merge_code",
        actionSummary: step.summary,
        riskLevel: step.riskLevel ?? "high",
        payload: {
          action: "merge_code",
          projectId: project.id,
          taskId: task.id,
          preview: step.summary,
          note: "Merge/push require explicit approval and are not auto-executed in M3",
        },
      });
      await prisma.taskStep.update({
        where: { id: stepRow.id },
        data: {
          status: TaskStatus.waiting_approval,
          outputSummary: gate.reason,
          endedAt: new Date(),
        },
      });
      await prisma.taskRun.update({
        where: { id: run.id },
        data: {
          status: TaskStatus.waiting_approval,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      waitingApproval = true;
      return;
    }

    if (step.produceArtifact) {
      const written = writeProjectArtifact({
        projectSlug: project.slug,
        filename: step.produceArtifact.filename,
        content: step.produceArtifact.content,
      });
      if (!fs.existsSync(written.absolutePath)) {
        throw new Error("Artifact verification failed — file missing");
      }
      const contentHash = createHash("sha256")
        .update(step.produceArtifact.content)
        .digest("hex");
      const artifact = await prisma.artifact.create({
        data: {
          projectId: project.id,
          taskId: task.id,
          kind: step.produceArtifact.kind,
          title: step.produceArtifact.title,
          storageRef: written.storageRef,
          contentHash,
          metadataJson: JSON.stringify({
            planner: plan.labeledAs,
            modelId: plan.modelId ?? null,
            isLiveModel: plan.isLiveModel,
            absolutePath: written.absolutePath,
            phase: "executed",
          }),
        },
      });
      await prisma.taskStep.update({
        where: { id: stepRow.id },
        data: {
          status: TaskStatus.completed,
          outputSummary: `Executed: wrote artifact ${written.storageRef}`,
          evidenceRef: artifact.id,
          endedAt: new Date(),
        },
      });

      // Weekly analytics → durable project memory for next loop's marketing prompt.
      if (step.produceArtifact.kind === "weekly-analytics" && project.slug === "autiq") {
        const raw = plan.steps.find((s) => s.brandCalendarTask)?.brandCalendarTask ?? null;
        const brief = raw ? parseAndSanitizeWeeklyBrief(raw) : null;
        const blurb = brief
          ? proposeNextWeekTheme(brief).memoryBlurb
          : "AUTIQ weekly analytics: brief blocked — re-run loop before next theme.";
        await upsertProjectMemory({
          projectId: project.id,
          category: "weekly-next-theme",
          content: blurb.slice(0, 8000),
          sourceRef: "autiq-weekly-content-loop",
          verify: true,
        });
      }

      executedArtifact = true;
      continue;
    }

    if (step.actionType === "verify_artifact") {
      const artifacts = await prisma.artifact.findMany({ where: { taskId: task.id } });
      if (artifacts.length === 0) {
        throw new Error("Verification failed: no artifacts (refusing to claim success)");
      }
      for (const a of artifacts) {
        if (!artifactExists(a.storageRef)) {
          throw new Error(`Verification failed: missing ${a.storageRef}`);
        }
      }
      await prisma.taskStep.update({
        where: { id: stepRow.id },
        data: {
          status: TaskStatus.completed,
          outputSummary: `Verified ${artifacts.length} on-disk artifact(s)`,
          endedAt: new Date(),
        },
      });
      continue;
    }

    await prisma.taskStep.update({
      where: { id: stepRow.id },
      data: {
        status: TaskStatus.completed,
        outputSummary: `Recorded: ${step.summary}`,
        endedAt: new Date(),
      },
    });
  }

  if (waitingApproval) return;

  await prisma.taskRun.update({
    where: { id: run.id },
    data: { status: TaskStatus.verifying },
  });
  await prisma.task.update({
    where: { id: task.id },
    data: { status: TaskStatus.verifying },
  });

  const artifacts = await prisma.artifact.findMany({ where: { taskId: task.id } });
  if (
    !executedArtifact &&
    !executedDeveloper &&
    artifacts.length === 0 &&
    !plan.blockedReason
  ) {
    throw new Error(
      "Refusing completed status: no executed artifact/developer evidence (plan alone is not execution)",
    );
  }

  await prisma.taskRun.update({
    where: { id: run.id },
    data: {
      status: TaskStatus.completed,
      endedAt: new Date(),
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
  await prisma.task.update({
    where: { id: task.id },
    data: { status: TaskStatus.completed, completedAt: new Date() },
  });

  await consolidateTaskOutcome({
    projectId: project.id,
    taskId: task.id,
    title: task.title,
    status: "completed",
    specialistKey: plan.specialistTemplateKey,
    artifactKinds: artifacts.map((a) => a.kind),
    modelId: plan.modelId ?? null,
  });

  await recordAudit({
    projectId: project.id,
    actor: WORKER_ID,
    verb: "task.completed",
    target: task.id,
    payload: {
      artifactCount: artifacts.length,
      planner: plan.labeledAs,
      modelId: plan.modelId ?? null,
      executedArtifact,
    },
  });
}

async function failRun(runId: string, taskId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const run = await prisma.taskRun.findUnique({ where: { id: runId } });
  const attempt = run?.attempt ?? 1;

  // Do not retry planner-unavailable forever as if work happened
  const nonRetryable =
    /Planner unhealthy|Ollama planner unavailable|Ollama structured plan failed|isolation/i.test(
      message,
    );

  if (!nonRetryable && attempt < MAX_ATTEMPTS) {
    await prisma.taskRun.update({
      where: { id: runId },
      data: {
        status: TaskStatus.queued,
        attempt: attempt + 1,
        errorCode: "retryable",
        errorMessage: message,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    await prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.queued },
    });
    await recordAudit({
      actor: WORKER_ID,
      verb: "task.retry",
      target: taskId,
      payload: { attempt: attempt + 1, message },
    });
    return;
  }

  await prisma.taskRun.update({
    where: { id: runId },
    data: {
      status: TaskStatus.failed,
      endedAt: new Date(),
      errorCode: "failed",
      errorMessage: message,
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
  await prisma.task.update({
    where: { id: taskId },
    data: { status: TaskStatus.failed, completedAt: new Date() },
  });
  await recordAudit({
    actor: WORKER_ID,
    verb: "task.failed",
    target: taskId,
    payload: { message },
  });
}

async function hasRunnableWork(): Promise<boolean> {
  const n = await prisma.taskRun.count({
    where: {
      status: {
        in: [
          TaskStatus.queued,
          TaskStatus.planning,
          TaskStatus.running,
          TaskStatus.verifying,
        ],
      },
    },
  });
  return n > 0;
}

async function hasEnabledSchedules(): Promise<boolean> {
  const n = await prisma.schedule.count({ where: { enabled: true } });
  return n > 0;
}

async function loop() {
  const planner = getActivePlanner();
  console.log(`[FACCI worker] started as ${WORKER_ID}`);
  console.log(`[FACCI worker] planner mode=${getPlannerMode()} provider=${planner.id}`);
  console.log(`[FACCI worker] liveModel=${planner.isLiveModel} label=${planner.label}`);
  console.log(`[FACCI worker] concurrency: 1`);
  console.log(`[FACCI worker] M5 schedules tick every ${SCHEDULE_TICK_MS}ms`);
  console.log(
    `[FACCI worker] idle exit: ${
      IDLE_EXIT_MS === 0
        ? "disabled (FACCI_WORKER_IDLE_EXIT_MS=0)"
        : `after ${Math.round(IDLE_EXIT_MS / 1000)}s with no work / no enabled schedules`
    }`,
  );
  const health = await planner.checkHealth();
  console.log(`[FACCI worker] health: ${health.healthy ? "ok" : "UNHEALTHY"} — ${health.details}`);

  try {
    const backup = createSqliteBackup("worker-start");
    console.log(`[FACCI worker] startup backup: ${backup.relativePath} (${backup.bytes} bytes)`);
  } catch (err) {
    console.warn(
      `[FACCI worker] startup backup skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let lastScheduleTick = 0;
  let lastBackupAt = Date.now();
  let idleSince = Date.now();

  while (true) {
    try {
      const now = Date.now();
      if (now - lastScheduleTick >= SCHEDULE_TICK_MS) {
        lastScheduleTick = now;
        const fired = await processDueSchedules(new Date(now));
        if (fired.createdTaskIds.length > 0) {
          console.log(
            `[FACCI worker] schedules fired (new): ${fired.createdTaskIds.join(", ")}`,
          );
          idleSince = Date.now();
        } else if (fired.firedTaskIds.length > 0) {
          console.log(
            `[FACCI worker] schedules replayed (idempotent): ${fired.firedTaskIds.join(", ")}`,
          );
          idleSince = Date.now();
        }
      }
      if (now - lastBackupAt >= BACKUP_INTERVAL_MS) {
        lastBackupAt = now;
        try {
          const backup = createSqliteBackup("periodic");
          console.log(`[FACCI worker] periodic backup: ${backup.relativePath}`);
        } catch (err) {
          console.warn(
            `[FACCI worker] periodic backup failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      const run = await claimNextRun();
      if (!run) {
        const keepAlive =
          (await hasRunnableWork()) || (await hasEnabledSchedules());
        if (keepAlive) {
          idleSince = Date.now();
          await sleep(POLL_MS);
          continue;
        }
        if (IDLE_EXIT_MS > 0 && Date.now() - idleSince >= IDLE_EXIT_MS) {
          console.log(
            `[FACCI worker] idle exit after ${Math.round(IDLE_EXIT_MS / 1000)}s — no runnable work and no enabled schedules. New chat/tasks wake the worker.`,
          );
          process.exit(0);
        }
        await sleep(IDLE_POLL_MS);
        continue;
      }
      idleSince = Date.now();
      console.log(`[FACCI worker] claimed task ${run.taskId}`);
      try {
        await executeRun(run);
        console.log(`[FACCI worker] finished claim for task ${run.taskId}`);
      } catch (err) {
        console.error(`[FACCI worker] error on ${run.taskId}:`, err);
        await failRun(run.id, run.taskId, err);
      }
    } catch (err) {
      console.error("[FACCI worker] loop error:", err);
      await sleep(POLL_MS);
    }
  }
}

loop().catch((err) => {
  console.error(err);
  process.exit(1);
});
