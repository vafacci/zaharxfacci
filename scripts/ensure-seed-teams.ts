/**
 * Add missing seed specialists (e.g. DreamIT QA) without wiping the DB.
 * Usage: npm run team:ensure
 */
import { ensureSeedTeams } from "../src/domain/ensure-seed-teams";

async function main() {
  const results = await ensureSeedTeams();
  for (const r of results) {
    if (r.missingProject) {
      console.log(`${r.projectSlug}: project missing — run npm run db:seed`);
      continue;
    }
    if (r.createdProject) {
      console.log(`${r.projectSlug}: created project + team (${r.added.join(", ")})`);
      continue;
    }
    if (r.added.length) {
      console.log(`${r.projectSlug}: added ${r.added.join(", ")}`);
    } else {
      console.log(`${r.projectSlug}: team complete (${r.alreadyHad.join(", ")})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
