/**
 * Proven alternate when OpenCode CLI is unavailable or fails on small local models.
 * Uses Ollama structured JSON to propose allowlisted file edits, then applies them
 * deterministically. Never claims to be OpenCode.
 */
import fs from "fs";
import path from "path";
import { z } from "zod";
import {
  assertPathInsideWorkspace,
  isPathAllowed,
  type WorkspaceConfig,
} from "@/tools/workspace";

const PatchSchema = z.object({
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(200),
        content: z.string().min(1).max(50000),
        rationale: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(5),
  summary: z.string().min(1).max(1000),
});

export type BoundedPatchResult = {
  executor: "bounded-patch-executor";
  modelId: string;
  summary: string;
  writtenFiles: string[];
  latencyMs: number;
  rawPlanValid: boolean;
};

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Bounded patch executor: model returned non-JSON");
  }
}

/** Prefer docs/README over large app trees so small models see the right files. */
function prioritizeFilesForPrompt(
  currentFiles: Record<string, string>,
  prompt: string,
  budget = 14_000,
): string {
  const promptLower = prompt.toLowerCase();
  const score = (p: string): number => {
    const n = p.replace(/\\/g, "/").toLowerCase();
    let s = 0;
    if (n === "readme.md" || n === "agents.md") s += 100;
    if (n.startsWith("docs/")) s += 80;
    if (/\.(md|txt)$/i.test(n)) s += 20;
    if (promptLower.includes(n) || promptLower.includes(path.basename(n))) s += 50;
    if (n.startsWith("app/") || n.startsWith("components/")) s -= 10;
    return s;
  };
  const ranked = Object.entries(currentFiles).sort((a, b) => score(b[0]) - score(a[0]));
  const parts: string[] = [];
  let used = 0;
  for (const [p, c] of ranked) {
    const chunk = `--- ${p}\n${c}`;
    if (parts.length > 0 && used + chunk.length > budget) continue;
    parts.push(chunk);
    used += chunk.length;
    if (used >= budget || parts.length >= 12) break;
  }
  return parts.join("\n\n").slice(0, budget);
}

export async function runBoundedPatchExecutor(params: {
  workspaceRoot: string;
  config: WorkspaceConfig;
  prompt: string;
  currentFiles: Record<string, string>;
  modelId?: string;
}): Promise<BoundedPatchResult> {
  const base = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  const modelId =
    params.modelId ??
    process.env.OLLAMA_CODER_MODEL?.trim() ??
    process.env.OLLAMA_MODEL?.trim() ??
    "qwen2.5-coder:3b";

  const fileListing = prioritizeFilesForPrompt(params.currentFiles, params.prompt);

  const system = `You are a constrained coding assistant for FACCI.
Return ONLY JSON: {"summary":"...","files":[{"path":"relative/path","content":"full new file contents","rationale":"..."}]}
Rules:
- You MUST change at least one allowlisted file (files array length >= 1).
- Prefer a small edit: append/update README.md, AGENTS.md, or a docs/*.md file when the task is documentation.
- Paths must be relative to the workspace root.
- Allowed paths match: ${params.config.allowedGlobs.join(", ")}
- Do not touch secrets, .env, node_modules, or paths outside the workspace.
- Provide FULL file content for each changed file (not a diff).`;

  const user = `Task:\n${params.prompt}\n\nCurrent files (priority subset):\n${fileListing}`;

  const started = Date.now();
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      stream: false,
      format: "json",
      options: {
        temperature: 0.1,
        num_ctx: 4096,
        // Prefer CPU while ComfyUI may hold GPU
        num_gpu: process.env.FACCI_FORCE_GPU === "1" ? undefined : 0,
      },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) {
    throw new Error(`Bounded patch Ollama HTTP ${res.status}`);
  }
  const data = (await res.json()) as { message?: { content?: string }; model?: string };
  const parsed = PatchSchema.parse(extractJson(data.message?.content ?? ""));
  const writtenFiles: string[] = [];

  for (const file of parsed.files) {
    const rel = file.path.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!isPathAllowed(params.config, rel)) {
      throw new Error(`Bounded patch denied path outside allowlist: ${rel}`);
    }
    const abs = path.join(params.workspaceRoot, rel);
    assertPathInsideWorkspace(params.workspaceRoot, abs);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, file.content, "utf8");
    writtenFiles.push(rel);
  }

  return {
    executor: "bounded-patch-executor",
    modelId: data.model ?? modelId,
    summary: parsed.summary,
    writtenFiles,
    latencyMs: Date.now() - started,
    rawPlanValid: true,
  };
}
