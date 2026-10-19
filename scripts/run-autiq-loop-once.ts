import { createTask } from "../src/domain/tasks";
import { AUTIQ_WEEKLY_LOOP_TEMPLATE } from "../src/domain/content-loop";
import { prisma } from "../src/lib/db";

async function main() {
  const p = await prisma.project.findUnique({ where: { slug: "autiq" } });
  if (!p) throw new Error("AUTIQ project not found");
  const task = await createTask({
    projectId: p.id,
    title: AUTIQ_WEEKLY_LOOP_TEMPLATE.title,
    objective: `${AUTIQ_WEEKLY_LOOP_TEMPLATE.objective}\n\n(Proof run: deterministic calendar writer)`,
    origin: "operational",
    idempotencyKey: `autiq-weekly-loop-proof-${Date.now()}`,
  });
  console.log(JSON.stringify({ id: task.id, status: task.status, title: task.title }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
