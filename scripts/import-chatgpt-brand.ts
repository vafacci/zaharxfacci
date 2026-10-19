/**
 * Import ChatGPT / chat export → brand/_import/*.draft.md (owner review).
 *
 * Usage:
 *   npx tsx scripts/import-chatgpt-brand.ts --project autiq --file path/to/export.json
 *   npx tsx scripts/import-chatgpt-brand.ts --project autiq --file notes.md
 *
 * Never overwrites live brand/*.md. Live pack is updated only by you (or a future --apply with explicit confirm).
 */
import fs from "fs";
import path from "path";
import {
  importBrandKnowledgeFromText,
  renderBrandImportDrafts,
} from "../src/domain/brand-import";
import { projectRoot } from "../src/lib/paths";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function main() {
  const projectSlug = arg("--project") ?? "autiq";
  const file = arg("--file");
  if (!file) {
    console.error(
      "Usage: npx tsx scripts/import-chatgpt-brand.ts --project autiq --file <export.json|notes.md>",
    );
    process.exit(1);
  }
  if (projectSlug !== "autiq") {
    console.error(
      `Project "${projectSlug}" brand import path not wired yet — use --project autiq for now.`,
    );
    process.exit(1);
  }

  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(abs, "utf8");
  const result = importBrandKnowledgeFromText({
    projectSlug,
    sourcePath: abs,
    rawText,
  });
  const drafts = renderBrandImportDrafts(result);

  const outDir = path.join(
    projectRoot(),
    "workspaces",
    projectSlug,
    "brand",
    "_import",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(drafts)) {
    fs.writeFileSync(path.join(outDir, name), content, "utf8");
  }

  // Keep a pointer for the latest run
  const latest = path.join(projectRoot(), "workspaces", projectSlug, "brand", "_import", "LATEST.txt");
  fs.mkdirSync(path.dirname(latest), { recursive: true });
  fs.writeFileSync(latest, `${outDir}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        outDir,
        sourceKind: result.sourceKind,
        messageCount: result.messageCount,
        candidates: result.candidates.length,
        redactions: result.redactions,
        warnings: result.warnings,
        files: Object.keys(drafts),
      },
      null,
      2,
    ),
  );
}

main();
