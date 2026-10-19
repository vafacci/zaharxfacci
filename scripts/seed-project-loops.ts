/**
 * Upsert Grupvi UX + DreamIT research weekly loops (disabled until owner enable).
 *   npm run project:loops:seed
 *   npm run project:loops:seed -- --run-now   — also queue both once
 */
import { prisma } from "../src/lib/db";
import {
  runDreamitResearchLoopOnce,
  runGrupviUxLoopOnce,
  upsertDreamitResearchLoopSchedule,
  upsertGrupviUxLoopSchedule,
} from "../src/domain/schedules";

async function main() {
  const grupvi = await upsertGrupviUxLoopSchedule();
  const dreamit = await upsertDreamitResearchLoopSchedule();
  console.log(
    JSON.stringify(
      {
        grupvi: {
          created: grupvi.created,
          id: grupvi.schedule.id,
          title: grupvi.schedule.title,
          enabled: grupvi.schedule.enabled,
          rule: grupvi.schedule.rule,
        },
        dreamit: {
          created: dreamit.created,
          id: dreamit.schedule.id,
          title: dreamit.schedule.title,
          enabled: dreamit.schedule.enabled,
          rule: dreamit.schedule.rule,
        },
      },
      null,
      2,
    ),
  );

  if (process.argv.includes("--run-now")) {
    const g = await runGrupviUxLoopOnce();
    const d = await runDreamitResearchLoopOnce();
    console.log(
      JSON.stringify(
        {
          queued: [
            { id: g.id, title: g.title, status: g.status },
            { id: d.id, title: d.title, status: d.status },
          ],
        },
        null,
        2,
      ),
    );
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
