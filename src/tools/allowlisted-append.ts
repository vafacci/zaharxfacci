/**
 * Deterministic append to an allowlisted text file.
 * Used for small FACCI notes in app repos where bounded-patch is unreliable.
 */
import fs from "fs";
import path from "path";
import { assertPathInsideWorkspace, isPathAllowed, resolveWorkspace } from "@/tools/workspace";

export function appendAllowlistedNote(params: {
  workspaceId: string;
  relativePath: string;
  note: string;
}): {
  workspaceId: string;
  relativePath: string;
  absolutePath: string;
  evidenceMarkdown: string;
} {
  const rel = params.relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
  const note = params.note.replace(/\r\n/g, "\n").trim();
  if (!note || note.length < 3) throw new Error("Note too short");
  if (note.length > 2000) throw new Error("Note too long");

  const { config, absolutePath: root } = resolveWorkspace(params.workspaceId);
  if (!isPathAllowed(config, rel)) {
    throw new Error(`Path not allowlisted: ${rel}`);
  }
  const abs = path.join(root, rel);
  assertPathInsideWorkspace(root, abs);

  const before = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
  if (before.includes(note)) {
    return {
      workspaceId: params.workspaceId,
      relativePath: rel,
      absolutePath: abs,
      evidenceMarkdown: evidence(params.workspaceId, rel, note, "already present — no write"),
    };
  }

  const block = `\n\n## FACCI note\n\n${note}\n`;
  const next = before.trimEnd() + block;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, next.endsWith("\n") ? next : `${next}\n`, "utf8");

  return {
    workspaceId: params.workspaceId,
    relativePath: rel,
    absolutePath: abs,
    evidenceMarkdown: evidence(params.workspaceId, rel, note, "appended"),
  };
}

function evidence(workspaceId: string, rel: string, note: string, result: string): string {
  return `# Allowlisted append evidence

- Workspace: \`${workspaceId}\`
- File: \`${rel}\`
- Executor: **deterministic-allowlisted-append** (not OpenCode / not bounded-patch)
- Result: ${result}

## Note
${note}
`;
}

/** Detect simple "append FACCI note to AGENTS/README" developer prompts. */
export function parseAppendNoteFromDeveloperPrompt(prompt: string): {
  relativePath: string;
  note: string;
} | null {
  const text = prompt.replace(/\r\n/g, "\n");
  const pathMatch = text.match(/\b(AGENTS\.md|README\.md|APP_STORE\.md|BETA_TEST\.md|CLOUD\.md)\b/i);
  if (!pathMatch) return null;
  if (!/\b(append|tilføj|FACCI\s*note|allowlist)\b/i.test(text)) return null;

  const relativePath = pathMatch[1];
  // Stable note so proofs are idempotent and on-brand.
  const note =
    "FACCI edits must stay on allowlisted paths. Never touch `.env`, secrets, or excluded folders. Publish/deploy/store release still requires human approval.";
  return { relativePath, note };
}
