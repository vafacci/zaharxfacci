/**
 * M6 acceptance — budgets, memory, priority claim order, recurring approval, team perf, remote defaults.
 */
import { prisma } from "../src/lib/db";
import {
  createSchedule,
  processDueSchedules,
  applyRecurringJobApproval,
} from "../src/domain/schedules";
import { decideApproval } from "../src/domain/approvals";
import {
  checkBudget,
  consumeBudget,
  ensureMonthlyBudget,
  currentMonthKey,
  upsertBudget,
} from "../src/domain/budgets";
import {
  consolidateTaskOutcome,
  listProjectMemories,
  upsertOwnerMemory,
  upsertProjectMemory,
} from "../src/domain/memory";
import { setProjectPriority, selectNextQueuedRunId } from "../src/domain/prioritization";
import { persistTeamPerformance } from "../src/domain/team-performance";
import { createTask } from "../src/domain/tasks";
import { getRemoteModelStatus } from "../src/providers/remote-model";
import { TaskStatus } from "@prisma/client";

type Check = { name: string; ok: boolean; detail?: string };
const check = (name: string, ok: boolean, detail?: string): Check => ({ name, ok, detail });

async function main() {
  const checks: Check[] = [];
  const org = await prisma.organization.findFirst();
  const autiq = await prisma.project.findUnique({ where: { slug: "autiq" } });
  const grupvi = await prisma.project.findUnique({ where: { slug: "grupvi" } });
  const dreamit = await prisma.project.findUnique({ where: { slug: "dreamit" } });
  if (!org || !autiq || !grupvi || !dreamit) {
    throw new Error("Seed org/projects missing");
  }

  const monthKey = currentMonthKey();
  await ensureMonthlyBudget({ organizationId: org.id, projectId: "", monthKey });
  await upsertBudget({
    organizationId: org.id,
    projectId: "",
    monthKey,
    maxPlanCalls: 1000,
    maxTaskCreates: 2000,
    maxImageGens: 200,
    remoteModelConsent: false,
    remoteModelMaxCalls: 0,
  });

  // --- Budgets ---
  const before = await checkBudget({
    organizationId: org.id,
    projectId: autiq.id,
    dimension: "planCalls",
  });
  checks.push(check("budget gate allows under ceiling", before.allowed === true));
  await consumeBudget({
    organizationId: org.id,
    projectId: autiq.id,
    dimension: "planCalls",
  });
  const orgBudget = await prisma.monthlyBudget.findUnique({
    where: {
      organizationId_projectId_monthKey: {
        organizationId: org.id,
        projectId: "",
        monthKey,
      },
    },
  });
  checks.push(
    check(
      "budget consume increments org counter",
      (orgBudget?.usedPlanCalls ?? 0) >= 1,
      `usedPlanCalls=${orgBudget?.usedPlanCalls}`,
    ),
  );

  await upsertBudget({
    organizationId: org.id,
    projectId: autiq.id,
    monthKey,
    maxPlanCalls: 0,
    maxTaskCreates: 50,
    maxImageGens: 0,
  });
  const blocked = await checkBudget({
    organizationId: org.id,
    projectId: autiq.id,
    dimension: "planCalls",
  });
  checks.push(
    check("budget fail-closed at project ceiling 0", blocked.allowed === false, blocked.allowed ? undefined : blocked.reason),
  );
  // restore usable project budget
  await upsertBudget({
    organizationId: org.id,
    projectId: autiq.id,
    monthKey,
    maxPlanCalls: 200,
    maxTaskCreates: 200,
    maxImageGens: 40,
  });

  // --- Durable memory ---
  const pm = await upsertProjectMemory({
    projectId: grupvi.id,
    category: "architecture",
    content: "M6 acceptance: Grupvi prefers evidence-first UX notes.",
    sourceRef: "m6-acceptance-arch",
    verify: true,
  });
  const om = await upsertOwnerMemory({
    organizationId: org.id,
    category: "preference",
    content: "Owner prefers local Ollama; remote models only with explicit consent.",
    sourceRef: "m6-acceptance-owner",
    verify: true,
  });
  const listed = await listProjectMemories(grupvi.id);
  checks.push(
    check(
      "project memory persists and lists",
      listed.some((m) => m.id === pm.id && m.lastVerifiedAt != null),
    ),
  );
  checks.push(check("owner memory created", Boolean(om.id)));

  const outcome = await consolidateTaskOutcome({
    projectId: dreamit.id,
    taskId: "m6-fake-task-id",
    title: "Synthetic consolidate",
    status: "completed",
    specialistKey: "research",
    artifactKinds: ["research-brief"],
    modelId: "demo",
  });
  checks.push(
    check(
      "task outcome memory consolidated",
      outcome.category === "task_outcome" && outcome.content.includes("observed"),
    ),
  );

  // --- Priority claim order ---
  await setProjectPriority({ projectId: dreamit.id, priority: 90 });
  await setProjectPriority({ projectId: autiq.id, priority: 10 });
  // clean leftover queued validation noise for this probe
  const low = await createTask({
    projectId: autiq.id,
    title: "M6 low priority probe",
    objective: "Should not claim first",
    origin: "validation",
    priority: 1,
    idempotencyKey: `m6-prio-low-${Date.now()}`,
  });
  const high = await createTask({
    projectId: dreamit.id,
    title: "M6 high priority probe",
    objective: "Should claim first",
    origin: "validation",
    priority: 1,
    idempotencyKey: `m6-prio-high-${Date.now()}`,
  });
  const nextId = await selectNextQueuedRunId();
  const nextRun = nextId
    ? await prisma.taskRun.findUnique({ where: { id: nextId }, include: { task: true } })
    : null;
  checks.push(
    check(
      "worker claim prefers higher project priority",
      nextRun?.taskId === high.id,
      `next=${nextRun?.taskId} high=${high.id} low=${low.id}`,
    ),
  );
  // cancel probes so they don't clog the worker
  await prisma.task.updateMany({
    where: { id: { in: [low.id, high.id] } },
    data: { status: TaskStatus.cancelled, completedAt: new Date() },
  });
  await prisma.taskRun.updateMany({
    where: { taskId: { in: [low.id, high.id] } },
    data: { status: TaskStatus.cancelled, endedAt: new Date() },
  });
  await setProjectPriority({ projectId: autiq.id, priority: 1 });
  await setProjectPriority({ projectId: dreamit.id, priority: 0 });

  // --- Owner-approved recurring job ---
  const created = await createSchedule({
    projectId: grupvi.id,
    title: "M6 approval-gated schedule",
    rule: "every_1h",
    enabled: true,
    requiresOwnerApproval: true,
    maxFiresPerDay: 2,
    actionTemplate: {
      title: "M6 gated recurring UX note",
      objective: "UX review from approved recurring job",
      origin: "operational",
    },
  });
  checks.push(
    check(
      "recurring enable requests approval (stays disabled)",
      created.schedule.enabled === false && Boolean(created.pendingApprovalId),
      `enabled=${created.schedule.enabled} approval=${created.pendingApprovalId}`,
    ),
  );
  const approvalId = created.pendingApprovalId!;
  await decideApproval(approvalId, "approved", "Human Owner");
  const enabled = await prisma.schedule.findUnique({ where: { id: created.schedule.id } });
  checks.push(
    check(
      "approval enables recurring schedule",
      enabled?.enabled === true && enabled.ownerApprovedAt != null,
    ),
  );
  await prisma.schedule.update({
    where: { id: created.schedule.id },
    data: { nextRunAt: new Date(Date.now() - 1000), maxFiresPerDay: 1, firesToday: 0, firesDayKey: null },
  });
  const fired1 = await processDueSchedules();
  checks.push(
    check("approved schedule can fire", fired1.createdTaskIds.length === 1, fired1.createdTaskIds.join(",")),
  );
  await prisma.schedule.update({
    where: { id: created.schedule.id },
    data: {
      nextRunAt: new Date(Date.now() - 1000),
      firesToday: 1,
      firesDayKey: new Date().toISOString().slice(0, 10),
      maxFiresPerDay: 1,
    },
  });
  const firedCap = await processDueSchedules();
  checks.push(
    check(
      "daily fire cap blocks further creates",
      firedCap.createdTaskIds.length === 0,
      `created=${firedCap.createdTaskIds.length}`,
    ),
  );
  await prisma.schedule.update({
    where: { id: created.schedule.id },
    data: { enabled: false },
  });

  // --- Team performance ---
  const perf = await persistTeamPerformance(grupvi.id, 30);
  checks.push(
    check(
      "team performance artifact + memory",
      perf.artifact.kind === "team-performance" && perf.report.tasks.total >= 0,
      perf.storageRef,
    ),
  );

  // --- Remote model ---
  const remote = getRemoteModelStatus();
  checks.push(
    check(
      "remote model not ready without opt-in",
      remote.ready === false && remote.remoteModelConsent !== true,
      remote.blockedReason ?? "",
    ),
  );
  // remoteModelConsent is on budget not status — fix check
  checks.pop();
  checks.push(
    check(
      "remote model not ready without opt-in",
      remote.ready === false,
      remote.blockedReason ?? "blocked",
    ),
  );

  // applyRecurringJobApproval smoke (already enabled)
  const again = await applyRecurringJobApproval(created.schedule.id);
  checks.push(check("applyRecurringJobApproval idempotent enable", again.enabled === true));

  console.log("\n=== M6 ACCEPTANCE ===\n");
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `\n       ${c.detail}` : ""}`);
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
