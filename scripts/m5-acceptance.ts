/**
 * M5 acceptance — schedules, isolated backup restore, Windows status, reports, skipped tests.
 * Does NOT overwrite production DB. Does NOT install Windows tasks.
 */
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";
import {
  createSchedule,
  processDueSchedules,
  patchSchedule,
  scheduleFireIdempotencyKey,
} from "../src/domain/schedules";
import {
  createSqliteBackup,
  restoreSqliteBackupIsolated,
  verifySqliteFile,
  resolveDbPathForTest,
} from "../src/lib/backup";
import { buildSpecialistReport } from "../src/domain/specialist-reports";
import { execSync } from "child_process";

type Check = { name: string; ok: boolean; detail?: string };

function check(name: string, ok: boolean, detail?: string): Check {
  return { name, ok, detail };
}

async function acceptSchedules(): Promise<Check[]> {
  const out: Check[] = [];
  const dreamit = await prisma.project.findUnique({ where: { slug: "dreamit" } });
  if (!dreamit) return [check("schedules: dreamit project exists", false)];

  const dueAt = new Date(Date.now() - 2_000);
  const created = await createSchedule({
    projectId: dreamit.id,
    title: "M5 acceptance schedule",
    rule: "every_15m",
    enabled: true,
    requiresOwnerApproval: false,
    actionTemplate: {
      title: "M5 acceptance scheduled research",
      objective: "Investigate acceptance slot — validation only",
      origin: "validation",
    },
  });
  const sched = created.schedule;
  await prisma.schedule.update({
    where: { id: sched.id },
    data: { nextRunAt: dueAt },
  });

  const first = await processDueSchedules(new Date());
  out.push(
    check(
      "schedule fires once when due",
      first.createdTaskIds.length === 1 && first.firedTaskIds.length === 1,
      `created=${first.createdTaskIds.join(",")} fired=${first.firedTaskIds.join(",")}`,
    ),
  );

  const after = await prisma.schedule.findUnique({ where: { id: sched.id } });
  const expectedNext = dueAt.getTime() + 15 * 60_000;
  const nextOk =
    !!after?.nextRunAt &&
    after.nextRunAt.getTime() > Date.now() &&
    Math.abs(after.nextRunAt.getTime() - expectedNext) < 5_000;
  out.push(
    check(
      "nextRunAt advances by rule interval (15m) into the future",
      nextOk,
      `next=${after?.nextRunAt?.toISOString()} expected~${new Date(expectedNext).toISOString()}`,
    ),
  );

  // Simulate worker restart before next slot: force same due slot again
  await prisma.schedule.update({
    where: { id: sched.id },
    data: { nextRunAt: dueAt, enabled: true },
  });
  const replay = await processDueSchedules(new Date());
  const sameTask =
    replay.firedTaskIds.length === 1 &&
    replay.createdTaskIds.length === 0 &&
    replay.firedTaskIds[0] === first.createdTaskIds[0];
  out.push(
    check(
      "restart replay does not duplicate task (same due slot)",
      sameTask,
      `replayCreated=${replay.createdTaskIds.length} task=${replay.firedTaskIds[0]}`,
    ),
  );

  const key = scheduleFireIdempotencyKey(sched.id, dueAt);
  const tasksForKey = await prisma.task.count({ where: { idempotencyKey: key } });
  out.push(check("exactly one task row per due-slot idempotency key", tasksForKey === 1));

  // Second distinct slot should create a new task
  const due2 = new Date(dueAt.getTime() + 15 * 60_000);
  await prisma.schedule.update({
    where: { id: sched.id },
    data: { nextRunAt: due2 },
  });
  // Make due2 in the past relative to "now" for fire
  const second = await processDueSchedules(new Date(due2.getTime() + 1_000));
  out.push(
    check(
      "next interval creates a distinct task",
      second.createdTaskIds.length === 1 &&
        second.createdTaskIds[0] !== first.createdTaskIds[0],
      second.createdTaskIds.join(","),
    ),
  );

  await patchSchedule(sched.id, { enabled: false });
  return out;
}

async function acceptBackup(): Promise<Check[]> {
  const out: Check[] = [];
  const productionDb = resolveDbPathForTest();
  const prodStat = fs.existsSync(productionDb) ? fs.statSync(productionDb) : null;
  out.push(check("production DB path exists", !!prodStat, productionDb));

  const backup = createSqliteBackup("m5-acceptance");
  out.push(
    check("backup file created", backup.bytes > 0 && fs.existsSync(backup.backupPath), backup.relativePath),
  );

  const backupIntegrity = await verifySqliteFile(backup.backupPath);
  out.push(
    check("backup PRAGMA integrity_check", backupIntegrity.ok, backupIntegrity.details),
  );

  const isolated = restoreSqliteBackupIsolated(
    backup.relativePath,
    `m5-accept-${Date.now()}.db`,
  );
  out.push(
    check(
      "isolated restore path under data/backups/restore-test",
      isolated.restoredTo.replace(/\\/g, "/").includes("/data/backups/restore-test/"),
      isolated.relativePath,
    ),
  );

  const afterProd = fs.statSync(productionDb);
  out.push(
    check(
      "production DB mtime/size unchanged after isolated restore",
      !!prodStat &&
        afterProd.size === prodStat.size &&
        afterProd.mtimeMs === prodStat.mtimeMs,
      `before=${prodStat?.size}/${prodStat?.mtimeMs} after=${afterProd.size}/${afterProd.mtimeMs}`,
    ),
  );

  const restoredIntegrity = await verifySqliteFile(isolated.restoredTo);
  out.push(
    check(
      "isolated restore integrity + readable orgs/projects",
      restoredIntegrity.ok &&
        (restoredIntegrity.organizationCount ?? 0) >= 1 &&
        (restoredIntegrity.projectCount ?? 0) >= 1,
      restoredIntegrity.details,
    ),
  );

  return out;
}

function acceptWindows(): Check[] {
  const out: Check[] = [];
  const script = path.join(process.cwd(), "scripts", "install-windows-tasks.ps1");
  out.push(check("Windows script file implemented", fs.existsSync(script), script));

  try {
    const stdout = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}" -Status`,
      { encoding: "utf8", timeout: 30_000 },
    );
    out.push(
      check(
        "windows:tasks -Status is read-only and runs",
        /STATUS \(read-only\)/i.test(stdout) && /IMPLEMENTED/i.test(stdout),
        stdout.split(/\r?\n/).slice(0, 8).join(" | "),
      ),
    );
    const workerInstalled = /\[FACCI-Worker\] INSTALLED/i.test(stdout);
    out.push(
      check(
        "document install state (not required for acceptance)",
        true,
        workerInstalled
          ? "FACCI-Worker is INSTALLED on this machine"
          : "FACCI-Worker is NOT INSTALLED (script implemented only) — acceptable",
      ),
    );
  } catch (err) {
    out.push(
      check(
        "windows:tasks -Status runs",
        false,
        err instanceof Error ? err.message : String(err),
      ),
    );
  }
  return out;
}

function acceptReports(): Check[] {
  const out: Check[] = [];
  const kinds = [
    { key: "ux-design", kind: "ux-review" },
    { key: "qa", kind: "qa-checklist" },
    { key: "research", kind: "research-brief" },
    { key: "analytics", kind: "analytics-snapshot" },
  ] as const;

  for (const { key, kind } of kinds) {
    const report = buildSpecialistReport({
      projectName: "StudieChat / Grupvi",
      projectSlug: "grupvi",
      title: `Accept ${kind}`,
      objective: "Owner-stated objective for acceptance.",
      templateKey: key,
      projectMission: "Group study/chat application",
    });
    const c = report.content;
    const hasTable = /Verified sources/i.test(c) && /\|\s*Provenance\s*\|/i.test(c);
    const blocksExternal =
      /\*\*blocked\*\*/i.test(c) &&
      (/web fetch|telemetry|screenshot|customer analytics/i.test(c) ||
        /unavailable/i.test(c));
    const noFakeCustomers = !/NPS score|10,?000 users|market share 4[0-9]%/i.test(c);
    const missionObserved = /Group study\/chat application/.test(c);
    out.push(
      check(
        `report ${kind}: provenance table + limitations`,
        report.kind === kind && hasTable && blocksExternal && noFakeCustomers && missionObserved,
        `kind=${report.kind}`,
      ),
    );
  }

  const noMission = buildSpecialistReport({
    projectName: "DreamIT",
    projectSlug: "dreamit",
    title: "No mission",
    objective: "x",
    templateKey: "research",
  });
  out.push(
    check(
      "report without mission marks mission source blocked",
      /Project mission[\s\S]*\*\*blocked\*\*/i.test(noMission.content),
    ),
  );
  return out;
}

function acceptSkippedTests(): Check[] {
  return [
    check(
      "skipped: ollama live structured planning",
      true,
      "describe.runIf(FACCI_LIVE_OLLAMA_TEST===1) — opt-in live Ollama; skipped in default CI to avoid GPU/time flakiness",
    ),
    check(
      "skipped: developer adapter live toy fix",
      true,
      "describe.runIf(FACCI_LIVE_DEV_TEST===1) — opt-in OpenCode/bounded-patch on toy-counter; skipped by default (mutates workspace, long runtime)",
    ),
  ];
}

async function main() {
  const checks: Check[] = [];
  checks.push(...(await acceptSchedules()));
  checks.push(...(await acceptBackup()));
  checks.push(...acceptWindows());
  checks.push(...acceptReports());
  checks.push(...acceptSkippedTests());

  console.log("\n=== M5 ACCEPTANCE ===\n");
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
