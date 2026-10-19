import { TaskStatus } from "@prisma/client";
import { prisma } from "../src/lib/db";

const id = process.argv[2];
if (!id) {
  console.error("Usage: npx tsx scripts/cancel-task.ts <taskId>");
  process.exit(1);
}

async function main() {
  await prisma.taskRun.updateMany({
    where: { taskId: id, status: { in: ["running", "planning", "queued"] } },
    data: {
      status: TaskStatus.failed,
      errorMessage: "Cancelled: hung timeout — owner retry",
      leaseOwner: null,
      leaseExpiresAt: null,
      endedAt: new Date(),
    },
  });
  await prisma.task.update({
    where: { id },
    data: { status: TaskStatus.cancelled, completedAt: new Date() },
  });
  console.log(JSON.stringify({ cancelled: id }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
