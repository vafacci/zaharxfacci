/**
 * M5 regression — schedules, metrics, backup, Grupvi/DreamIT specialist reports.
 * Uses Demo planner for deterministic artifact kinds (set FACCI_PLANNER=demo).
 */
import { prisma } from "../src/lib/db";
import { createTask } from "../src/domain/tasks";
import { createSchedule, processDueSchedules, patchSchedule } from "../src/domain/schedules";
import { computeProjectMetrics } from "../src/domain/metrics";
import { createSqliteBackup, listBackups } from "../src/lib/backup";
import { DemoPlannerProvider } from "../src/providers/demo-planner";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitTask(id: string, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const t = await prisma.task.findUnique({
      where: { id },
      include: { artifacts: true, runs: { orderBy: { attempt: "desc" }, take: 1 } },
    });
    if (!t) throw new Error("task missing");
    if (["completed", "failed", "blocked", "waiting_approval", "cancelled"].includes(t.status)) {
      return t;
    }
    await sleep(1500);
  }
  throw new Error(`timeout waiting for task ${id}`);
}

async function main() {
  process.env.FACCI_PLANNER = "demo";
  const checks: { name: string; ok: boolean; detail?: string }[] = [];

  const grupvi = await prisma.project.findUnique({ where: { slug: "grupvi" } });
  const dreamit = await prisma.project.findUnique({ where: { slug: "dreamit" } });
  if (!grupvi || !dreamit) throw new Error("Seed projects missing — run npm run db:seed");

  // 1) Demo planner UX/research reports
  const demo = new DemoPlannerProvider();
  const uxPlan = await demo.generateStructuredPlan({
    projectSlug: "grupvi",
    projectName: grupvi.name,
    title: "Improve Grupvi chat UX",
    objective: "UX review of usability for chat",
    availableSpecialists: ["developer", "ux-design", "qa", "research"],
  });
  checks.push({
    name: "demo UX plan → ux-design + ux-review artifact",
    ok:
      uxPlan.specialistTemplateKey === "ux-design" &&
      !!uxPlan.steps.find((s) => s.produceArtifact?.kind === "ux-review"),
  });

  const researchPlan = await demo.generateStructuredPlan({
    projectSlug: "dreamit",
    projectName: dreamit.name,
    title: "Find problems we should fix in DreamIT",
    objective: "Investigate and research problems",
    availableSpecialists: ["developer", "design", "marketing", "research"],
  });
  checks.push({
    name: "demo research plan → research-brief",
    ok:
      researchPlan.specialistTemplateKey === "research" &&
      !!researchPlan.steps.find((s) => s.produceArtifact?.kind === "research-brief"),
  });

  // 2) Live worker path (requires worker running with FACCI_PLANNER=demo OR ollama)
  const uxTask = await createTask({
    projectId: grupvi.id,
    title: "Improve Grupvi chat UX",
    objective:
      "UX review of the StudieChat/Grupvi chat experience with provenance. No invented interviews.",
    origin: "validation",
    idempotencyKey: `m5-ux-${Date.now()}`,
  });
  console.log("Queued UX task", uxTask.id);
  const uxDone = await waitTask(uxTask.id);
  const uxArt = uxDone.artifacts.find(
    (a) => a.kind === "ux-review" || a.title.includes("UX") || a.kind === "markdown",
  );
  checks.push({
    name: "worker completes Grupvi UX task with artifact",
    ok: uxDone.status === "completed" && !!uxArt,
    detail: `status=${uxDone.status} arts=${uxDone.artifacts.map((a) => a.kind).join(",")}`,
  });

  // 3) Schedule fire (immediate)
  const created = await createSchedule({
    projectId: dreamit.id,
    title: "M5 regression schedule",
    rule: "every_15m",
    enabled: true,
    requiresOwnerApproval: false,
    actionTemplate: {
      title: "Find problems we should fix in DreamIT",
      objective: "Investigate and research — schedule fire test",
      origin: "validation",
    },
  });
  const sched = created.schedule;
  // Force due
  await prisma.schedule.update({
    where: { id: sched.id },
    data: { nextRunAt: new Date(Date.now() - 1000) },
  });
  const fired = await processDueSchedules();
  checks.push({
    name: "schedule processDueSchedules creates task",
    ok: fired.createdTaskIds.length >= 1,
    detail: fired.createdTaskIds.join(","),
  });
  await patchSchedule(sched.id, { enabled: false });

  // 4) Metrics + backup
  const metrics = await computeProjectMetrics();
  checks.push({
    name: "metrics include grupvi + dreamit",
    ok: metrics.projects.some((p) => p.slug === "grupvi") &&
      metrics.projects.some((p) => p.slug === "dreamit"),
  });

  const backup = createSqliteBackup("m5-regression");
  checks.push({
    name: "sqlite backup created",
    ok: backup.bytes > 0 && listBackups().some((b) => b.relativePath === backup.relativePath),
    detail: backup.relativePath,
  });

  console.log("\n=== M5 REGRESSION ===");
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    process.exitCode = 1;
  } else {
    console.log("\nAll M5 checks passed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
