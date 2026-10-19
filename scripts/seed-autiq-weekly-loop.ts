/**
 * Non-destructive upsert of the AUTIQ weekly content loop schedule (stays disabled).
 *   npm run autiq:loop:seed              — upsert only
 *   npm run autiq:loop:seed -- --run-now — also queue one loop task now
 */
import { prisma } from "../src/lib/db";
import { runAutiqWeeklyLoopOnce, upsertAutiqWeeklyLoopSchedule } from "../src/domain/schedules";

async function main() {
  const { schedule, created } = await upsertAutiqWeeklyLoopSchedule();
  console.log(
    JSON.stringify(
      {
        created,
        scheduleId: schedule.id,
        title: schedule.title,
        rule: schedule.rule,
        enabled: schedule.enabled,
        requiresOwnerApproval: schedule.requiresOwnerApproval,
        maxFiresPerDay: schedule.maxFiresPerDay,
      },
      null,
      2,
    ),
  );
  if (process.argv.includes("--run-now")) {
    const task = await runAutiqWeeklyLoopOnce();
    console.log(JSON.stringify({ queuedTaskId: task.id, status: task.status }, null, 2));
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
