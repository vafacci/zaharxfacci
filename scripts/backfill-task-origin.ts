import { PrismaClient } from "@prisma/client";
import { resolveTaskOrigin } from "../src/domain/routing";

async function main() {
  const prisma = new PrismaClient();
  const tasks = await prisma.task.findMany({
    select: { id: true, title: true, idempotencyKey: true, origin: true },
  });
  let updated = 0;
  for (const t of tasks) {
    const origin = resolveTaskOrigin({
      idempotencyKey: t.idempotencyKey,
      title: t.title,
    });
    if (origin !== t.origin) {
      await prisma.task.update({ where: { id: t.id }, data: { origin } });
      updated += 1;
      console.log(`${origin}\t${t.title}\t${t.idempotencyKey ?? ""}`);
    }
  }
  console.log(`updated ${updated} of ${tasks.length}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
