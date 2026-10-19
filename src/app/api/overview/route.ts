import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { cached } from "@/lib/health-cache";
import { getActivePlanner, getPlannerMode } from "@/providers";
import { inspectGpuGuard } from "@/providers/gpu-guard";
import { loadWorkspaces } from "@/tools/workspace";
import { checkImageStudioHealth } from "@/tools/image-studio-adapter";
import { checkPostizHealth } from "@/tools/postiz-adapter";
import { checkN8nHealth } from "@/tools/n8n-adapter";
import { listSchedules } from "@/domain/schedules";
import { computeProjectMetrics } from "@/domain/metrics";
import { listBackups } from "@/lib/backup";
import { listBudgets, currentMonthKey } from "@/domain/budgets";
import { listPortfolioPriorities } from "@/domain/prioritization";
import { getRemoteModelStatus } from "@/providers/remote-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlanSummary = {
  plannerId?: string;
  labeledAs?: string;
  isLiveModel?: boolean;
  modelId?: string;
  latencyMs?: number;
  reasoningSummary?: string;
  specialistTemplateKey?: string;
  steps?: {
    sequence: number;
    agentRole: string;
    actionType: string;
    summary: string;
  }[];
};

function summarizePlan(planJson: string | null | undefined): PlanSummary | null {
  if (!planJson) return null;
  try {
    const plan = JSON.parse(planJson) as PlanSummary & {
      steps?: {
        sequence: number;
        agentRole: string;
        actionType: string;
        summary: string;
      }[];
    };
    return {
      plannerId: plan.plannerId,
      labeledAs: plan.labeledAs,
      isLiveModel: plan.isLiveModel,
      modelId: plan.modelId,
      latencyMs: plan.latencyMs,
      reasoningSummary: plan.reasoningSummary?.slice(0, 400),
      specialistTemplateKey: plan.specialistTemplateKey,
      steps: (plan.steps ?? []).slice(0, 12).map((s) => ({
        sequence: s.sequence,
        agentRole: s.agentRole,
        actionType: s.actionType,
        summary: String(s.summary ?? "").slice(0, 220),
      })),
    };
  } catch {
    return null;
  }
}

/** Fast, no-spawn OpenCode status for UI polling. */
function openCodePackageStatus(): {
  available: boolean;
  details: string;
  version?: string;
} {
  const pkgPath = path.join(process.cwd(), "node_modules", "opencode-ai", "package.json");
  const exePath = path.join(process.cwd(), "node_modules", "opencode-ai", "bin", "opencode.exe");
  if (!fs.existsSync(pkgPath)) {
    return { available: false, details: "opencode-ai package not installed" };
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
    const hasBin = fs.existsSync(exePath);
    return {
      available: true,
      details: hasBin
        ? `OpenCode package v${pkg.version ?? "?"} (+ binary)`
        : `OpenCode package v${pkg.version ?? "?"} installed`,
      version: pkg.version,
    };
  } catch {
    return { available: true, details: "OpenCode package present" };
  }
}

export async function GET() {
  const [org, tasks, approvals, audit, artifacts, tools, schedules, metrics] =
    await Promise.all([
    prisma.organization.findFirst({
      select: {
        id: true,
        name: true,
        ownerName: true,
        projects: {
          select: {
            id: true,
            slug: true,
            name: true,
            mission: true,
            agents: {
              select: {
                id: true,
                name: true,
                role: true,
                templateKey: true,
                projectId: true,
                parentAgentId: true,
                status: true,
              },
              orderBy: [{ role: "asc" }, { name: "asc" }],
            },
            _count: { select: { tasks: true, artifacts: true } },
          },
          orderBy: { name: "asc" },
        },
        agents: {
          where: { role: "ceo" },
          take: 1,
          select: {
            id: true,
            name: true,
            role: true,
            templateKey: true,
            projectId: true,
            parentAgentId: true,
            status: true,
          },
        },
      },
    }),
    prisma.task.findMany({
      select: {
        id: true,
        title: true,
        objective: true,
        status: true,
        origin: true,
        projectId: true,
        project: { select: { id: true, name: true, slug: true } },
        assignedAgent: { select: { id: true, name: true } },
        artifacts: {
          select: { id: true, title: true, storageRef: true, kind: true },
          orderBy: { createdAt: "desc" },
          take: 16,
        },
        approvals: {
          select: { id: true, state: true, actionType: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        runs: {
          select: {
            id: true,
            status: true,
            modelProvider: true,
            modelId: true,
            planLatencyMs: true,
            errorMessage: true,
            planJson: true,
            steps: {
              select: {
                id: true,
                sequence: true,
                actionType: true,
                inputSummary: true,
                outputSummary: true,
                status: true,
                agent: { select: { name: true } },
              },
              orderBy: { sequence: "asc" },
              take: 20,
            },
          },
          orderBy: { attempt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.approval.findMany({
      where: { state: "pending" },
      select: {
        id: true,
        actionType: true,
        actionSummary: true,
        riskLevel: true,
        state: true,
        createdAt: true,
        task: {
          select: {
            id: true,
            title: true,
            project: { select: { name: true } },
          },
        },
        requestedByAgent: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.auditEvent.findMany({
      select: {
        id: true,
        actor: true,
        verb: true,
        target: true,
        createdAt: true,
        projectId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.artifact.findMany({
      select: {
        id: true,
        title: true,
        kind: true,
        storageRef: true,
        createdAt: true,
        project: { select: { name: true, slug: true } },
        task: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.toolRegistration.findMany({
      select: {
        id: true,
        name: true,
        adapterType: true,
        state: true,
      },
      orderBy: { name: "asc" },
    }),
    listSchedules(),
    computeProjectMetrics(),
  ]);
  const backups = listBackups().slice(0, 5);
  const orgId = org?.id;
  const monthKey = currentMonthKey();
  const [budgets, portfolio] = orgId
    ? await Promise.all([listBudgets(orgId, monthKey), listPortfolioPriorities(orgId)])
    : [[], []];
  const remoteModel = getRemoteModelStatus();

  const planner = getActivePlanner();
  const [plannerHealth, gpuGuard, imageStudio, postiz, n8n] = await Promise.all([
    cached("planner-health", 30_000, () => planner.checkHealth()),
    cached("gpu-guard", 30_000, () => inspectGpuGuard()),
    cached("image-studio-health", 30_000, () => checkImageStudioHealth()),
    cached("postiz-health", 30_000, () => checkPostizHealth()),
    cached("n8n-health", 30_000, () => checkN8nHealth()),
  ]);
  const openCode = openCodePackageStatus();
  const workspaces = loadWorkspaces();

  const toolsWithLive = tools.map((t) => {
    if (t.adapterType === "ollama") {
      return {
        ...t,
        state: plannerHealth.healthy ? ("online" as const) : ("offline" as const),
        liveNote: plannerHealth.healthy
          ? `${plannerHealth.details}`
          : `offline / not ready — ${plannerHealth.details ?? "unavailable"}`,
      };
    }
    if (t.adapterType === "opencode") {
      return {
        ...t,
        state: openCode.available ? ("online" as const) : ("not_connected" as const),
        liveNote: openCode.available
          ? `${openCode.details}; allowlisted: ${workspaces.map((w) => w.id).join(", ") || "(none)"}`
          : `not connected — ${openCode.details}`,
      };
    }
    if (t.adapterType === "image-studio") {
      return {
        ...t,
        state: imageStudio.connected
          ? ("online" as const)
          : imageStudio.available
            ? ("offline" as const)
            : ("not_connected" as const),
        liveNote: imageStudio.details,
      };
    }
    if (t.adapterType === "postiz") {
      return {
        ...t,
        state: postiz.reachable
          ? ("online" as const)
          : postiz.configured
            ? ("offline" as const)
            : ("not_connected" as const),
        liveNote: postiz.details,
      };
    }
    if (t.adapterType === "n8n") {
      return {
        ...t,
        state: n8n.apiAuthorized
          ? ("online" as const)
          : n8n.instanceReachable
            ? ("offline" as const)
            : ("not_connected" as const),
        liveNote: n8n.details,
      };
    }
    return { ...t, liveNote: null as string | null };
  });

  const counts = {
    projects: org?.projects.length ?? 0,
    queued: tasks.filter((t) => t.status === "queued").length,
    running: tasks.filter((t) =>
      ["planning", "running", "verifying"].includes(t.status),
    ).length,
    waitingApproval: approvals.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  };

  const tasksWithPlan = tasks.map((t) => {
    const run = t.runs[0];
    return {
      id: t.id,
      title: t.title,
      objective: t.objective.slice(0, 500),
      status: t.status,
      origin: t.origin,
      projectId: t.projectId,
      project: t.project,
      assignedAgent: t.assignedAgent,
      artifacts: t.artifacts,
      approvals: t.approvals,
      runs: run
        ? [
            {
              id: run.id,
              status: run.status,
              modelProvider: run.modelProvider,
              modelId: run.modelId,
              planLatencyMs: run.planLatencyMs,
              errorMessage: run.errorMessage?.slice(0, 400) ?? null,
              steps: run.steps.map((s) => ({
                ...s,
                inputSummary: s.inputSummary?.slice(0, 280) ?? null,
                outputSummary: s.outputSummary?.slice(0, 400) ?? null,
              })),
            },
          ]
        : [],
      latestPlan: summarizePlan(run?.planJson),
      latestRunMeta: run
        ? {
            modelProvider: run.modelProvider,
            modelId: run.modelId,
            planLatencyMs: run.planLatencyMs,
            status: run.status,
            errorMessage: run.errorMessage?.slice(0, 400) ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({
    demoLabel: "Seed hierarchy — Milestone 6 (budgets, memory, priority, recurring approval)",
    plannerMode: getPlannerMode(),
    planner: {
      id: planner.id,
      label: planner.label,
      isLiveModel: planner.isLiveModel,
      health: plannerHealth,
    },
    openCode,
    imageStudio,
    postiz,
    n8n,
    workspaces: workspaces.map((w) => ({
      id: w.id,
      label: w.label,
      relativePath: w.relativePath,
    })),
    gpuGuard,
    organization: org,
    tasks: tasksWithPlan,
    approvals,
    audit,
    artifacts,
    tools: toolsWithLive,
    counts,
    schedules: schedules.map((s) => ({
      id: s.id,
      title: s.title,
      rule: s.rule,
      enabled: s.enabled,
      nextRunAt: s.nextRunAt,
      lastRunAt: s.lastRunAt,
      lastTaskId: s.lastTaskId,
      project: s.project,
    })),
    metrics,
    backups,
    monthKey,
    budgets: budgets.map((b) => ({
      id: b.id,
      projectId: b.projectId || null,
      monthKey: b.monthKey,
      maxPlanCalls: b.maxPlanCalls,
      usedPlanCalls: b.usedPlanCalls,
      maxImageGens: b.maxImageGens,
      usedImageGens: b.usedImageGens,
      maxTaskCreates: b.maxTaskCreates,
      usedTaskCreates: b.usedTaskCreates,
      remoteModelConsent: b.remoteModelConsent,
      remoteModelMaxCalls: b.remoteModelMaxCalls,
      usedRemoteCalls: b.usedRemoteCalls,
    })),
    portfolio,
    remoteModel,
    flywheel: await (async () => {
      const autiq = org?.projects?.find((p) => p.slug === "autiq");
      if (!autiq) return null;
      const nextTheme = await prisma.projectMemory.findFirst({
        where: { projectId: autiq.id, category: "weekly-next-theme" },
        orderBy: [{ lastVerifiedAt: "desc" }, { updatedAt: "desc" }],
        select: { content: true, updatedAt: true, sourceRef: true },
      });
      const loopSchedule = schedules.find(
        (s) => s.project.slug === "autiq" && s.title === "AUTIQ weekly content loop",
      );
      return {
        projectSlug: "autiq",
        scheduleEnabled: Boolean(loopSchedule?.enabled),
        nextRunAt: loopSchedule?.nextRunAt?.toISOString?.() ?? loopSchedule?.nextRunAt ?? null,
        nextThemeMemory: nextTheme
          ? {
              content: nextTheme.content,
              updatedAt: nextTheme.updatedAt.toISOString(),
              sourceRef: nextTheme.sourceRef,
            }
          : null,
      };
    })(),
  });
}
