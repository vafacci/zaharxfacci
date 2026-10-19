/**
 * ChatGPT / chat-export → curated brand-pack drafts.
 * Deterministic extraction only (no LLM). Never auto-publishes into live pack files.
 */
import { z } from "zod";

export const BrandPackSectionKey = z.enum([
  "positioning",
  "audience",
  "claims",
  "examples",
  "glossary",
  "voice",
  "unsorted",
]);
export type BrandPackSectionKey = z.infer<typeof BrandPackSectionKey>;

export const BrandImportCandidateSchema = z.object({
  section: BrandPackSectionKey,
  text: z.string().min(3).max(2000),
  provenance: z.literal("proposed"),
  sourceLabel: z.string().min(1).max(200),
  confidence: z.enum(["low", "medium", "high"]),
});
export type BrandImportCandidate = z.infer<typeof BrandImportCandidateSchema>;

export const BrandImportResultSchema = z.object({
  projectSlug: z.string().min(1),
  sourcePath: z.string().min(1),
  sourceKind: z.enum(["openai_conversations_json", "markdown", "plain_text", "json_messages"]),
  messageCount: z.number().int().nonnegative(),
  candidates: z.array(BrandImportCandidateSchema),
  redactions: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
});
export type BrandImportResult = z.infer<typeof BrandImportResultSchema>;

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9]{10,}\b/g,
  /\bsk-proj-[a-zA-Z0-9_-]{10,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bghp_[a-zA-Z0-9]{20,}\b/g,
  /\bxox[baprs]-[a-zA-Z0-9-]{10,}\b/g,
  /\bBearer\s+[a-zA-Z0-9._-]{20,}\b/gi,
  /\bapi[_-]?key\s*[:=]\s*['"]?[^\s'"]{12,}/gi,
  /\bpassword\s*[:=]\s*['"]?[^\s'"]{6,}/gi,
];

export function redactSecrets(text: string): { text: string; redactions: number } {
  let out = text;
  let redactions = 0;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, () => {
      redactions += 1;
      return "[REDACTED]";
    });
  }
  return { text: out, redactions };
}

type ChatMessage = { role: string; content: string; sourceLabel: string };

/** OpenAI data-export conversations.json (best-effort; shapes vary). */
function parseOpenAiConversations(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const conv of raw) {
    if (!conv || typeof conv !== "object") continue;
    const c = conv as Record<string, unknown>;
    const title = typeof c.title === "string" ? c.title : "conversation";
    const mapping = c.mapping;
    if (!mapping || typeof mapping !== "object") continue;
    for (const node of Object.values(mapping as Record<string, unknown>)) {
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      const message = n.message;
      if (!message || typeof message !== "object") continue;
      const m = message as Record<string, unknown>;
      const author = m.author as Record<string, unknown> | undefined;
      const role = String(author?.role ?? "unknown");
      const content = m.content as Record<string, unknown> | undefined;
      const parts = content?.parts;
      let text = "";
      if (Array.isArray(parts)) {
        text = parts.filter((p) => typeof p === "string").join("\n");
      } else if (typeof content?.text === "string") {
        text = content.text;
      }
      text = text.trim();
      if (text.length < 3) continue;
      out.push({ role, content: text, sourceLabel: title });
    }
  }
  return out;
}

function parseJsonMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const content = typeof r.content === "string" ? r.content.trim() : "";
    if (content.length < 3) continue;
    out.push({
      role: String(r.role ?? "user"),
      content,
      sourceLabel: typeof r.title === "string" ? r.title : "message",
    });
  }
  return out;
}

function detectAndParse(rawText: string): {
  kind: BrandImportResult["sourceKind"];
  messages: ChatMessage[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const trimmed = rawText.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const json = JSON.parse(trimmed) as unknown;
      if (Array.isArray(json) && json[0] && typeof json[0] === "object") {
        const first = json[0] as Record<string, unknown>;
        if (first.mapping || first.title) {
          return {
            kind: "openai_conversations_json",
            messages: parseOpenAiConversations(json),
            warnings,
          };
        }
        if ("content" in first) {
          return { kind: "json_messages", messages: parseJsonMessages(json), warnings };
        }
      }
      if (json && typeof json === "object" && !Array.isArray(json)) {
        const obj = json as Record<string, unknown>;
        if (Array.isArray(obj.conversations)) {
          return {
            kind: "openai_conversations_json",
            messages: parseOpenAiConversations(obj.conversations),
            warnings,
          };
        }
      }
      warnings.push("JSON parsed but no known chat shape — treating as plain text fallback.");
    } catch {
      warnings.push("JSON parse failed — treating as plain text.");
    }
  }

  const kind: BrandImportResult["sourceKind"] = /#{1,3}\s+\w+/.test(trimmed)
    ? "markdown"
    : "plain_text";
  // Split on blank lines into pseudo-messages for extraction.
  const chunks = trimmed
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 3);
  const messages = chunks.map((content, i) => ({
    role: "user",
    content,
    sourceLabel: `chunk-${i + 1}`,
  }));
  return { kind, messages, warnings };
}

type Rule = {
  section: BrandPackSectionKey;
  re: RegExp;
  confidence: BrandImportCandidate["confidence"];
};

const RULES: Rule[] = [
  {
    section: "positioning",
    re: /\b(we are not|vi er ikke|what we are|positioning|differentiator|første tilbud|first offer|content autopilot)\b/i,
    confidence: "medium",
  },
  {
    section: "audience",
    re: /\b(audience|målgruppe|ideal customer|jobs? to be done|JTBD|pain point|køber|buyer|creator|operator)\b/i,
    confidence: "medium",
  },
  {
    section: "claims",
    re: /\b(claim|må ikke|must not|do not invent|forbidden|testimonial|garanti|guarantee|never invent)\b/i,
    confidence: "high",
  },
  {
    section: "examples",
    re: /\b(caption|eksempel|example post|instagram|linkedin|facebook)\b/i,
    confidence: "medium",
  },
  {
    section: "glossary",
    re: /\b(glossary|prefer|avoid|ord vi|call it|product name|Content Autopilot)\b/i,
    confidence: "low",
  },
  {
    section: "voice",
    re: /\b(tone|voice|tone of voice|skrivestil|no hype|ingen hype|emoji)\b/i,
    confidence: "medium",
  },
];

function classifyLine(line: string): { section: BrandPackSectionKey; confidence: BrandImportCandidate["confidence"] } {
  for (const rule of RULES) {
    if (rule.re.test(line)) return { section: rule.section, confidence: rule.confidence };
  }
  return { section: "unsorted", confidence: "low" };
}

function extractCandidates(messages: ChatMessage[]): {
  candidates: BrandImportCandidate[];
  redactions: number;
} {
  const candidates: BrandImportCandidate[] = [];
  let redactions = 0;
  const seen = new Set<string>();

  for (const msg of messages) {
    // Prefer owner/user turns for brand truth; still scan assistant for structured lists.
    const { text, redactions: r } = redactSecrets(msg.content);
    redactions += r;
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•]\s+/, "").replace(/^#{1,6}\s+/, "").trim())
      .filter((l) => l.length >= 12 && l.length <= 500);

    for (const line of lines) {
      const { section, confidence } = classifyLine(line);
      // Skip pure assistant fluff unless it matches a strong section signal.
      if (msg.role === "assistant" && section === "unsorted") continue;
      const key = `${section}:${line.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        section,
        text: line,
        provenance: "proposed",
        sourceLabel: `${msg.sourceLabel} (${msg.role})`,
        confidence,
      });
    }
  }

  // Cap per section so drafts stay reviewable on small GPUs / humans.
  const caps: Partial<Record<BrandPackSectionKey, number>> = {
    positioning: 40,
    audience: 40,
    claims: 40,
    examples: 50,
    glossary: 40,
    voice: 30,
    unsorted: 60,
  };
  const counts: Record<string, number> = {};
  const limited: BrandImportCandidate[] = [];
  for (const c of candidates) {
    const n = counts[c.section] ?? 0;
    const max = caps[c.section] ?? 30;
    if (n >= max) continue;
    counts[c.section] = n + 1;
    limited.push(c);
  }
  return { candidates: limited, redactions };
}

export function importBrandKnowledgeFromText(params: {
  projectSlug: string;
  sourcePath: string;
  rawText: string;
}): BrandImportResult {
  const { kind, messages, warnings } = detectAndParse(params.rawText);
  const { candidates, redactions } = extractCandidates(messages);
  if (messages.length === 0) {
    warnings.push("No messages/chunks extracted from source.");
  }
  if (candidates.length === 0) {
    warnings.push("No brand candidates matched heuristics — add clearer headings or paste curated notes.");
  }
  return BrandImportResultSchema.parse({
    projectSlug: params.projectSlug,
    sourcePath: params.sourcePath,
    sourceKind: kind,
    messageCount: messages.length,
    candidates,
    redactions,
    warnings,
  });
}

/** Render draft markdown per section for owner review (not live pack files). */
export function renderBrandImportDrafts(result: BrandImportResult): Record<string, string> {
  const bySection = new Map<BrandPackSectionKey, BrandImportCandidate[]>();
  for (const c of result.candidates) {
    const list = bySection.get(c.section) ?? [];
    list.push(c);
    bySection.set(c.section, list);
  }

  const files: Record<string, string> = {};
  const stamp = new Date().toISOString().slice(0, 10);
  for (const [section, items] of bySection) {
    const body = items
      .map(
        (c) =>
          `- (${c.confidence}) ${c.text}\n  - provenance: proposed · source: ${c.sourceLabel}`,
      )
      .join("\n");
    files[`${section}.draft.md`] = `# ${section} — import draft (${stamp})

> PROPOSED only. Not loaded by the weekly loop until you copy approved lines into \`brand/${section === "unsorted" ? "README" : section}.md\`.
> Source: \`${result.sourcePath}\` (${result.sourceKind})
> Redactions applied: ${result.redactions}

${body || "_No candidates._"}
`;
  }

  files["IMPORT_SUMMARY.md"] = `# Brand import summary (${stamp})

- Project: \`${result.projectSlug}\`
- Source: \`${result.sourcePath}\`
- Kind: ${result.sourceKind}
- Messages/chunks: ${result.messageCount}
- Candidates: ${result.candidates.length}
- Redactions: ${result.redactions}
- Warnings: ${result.warnings.length ? result.warnings.map((w) => `\n  - ${w}`).join("") : " none"}

## Next
1. Review \`*.draft.md\` files in this folder.
2. Copy approved lines into live pack files under \`brand/\` (positioning, audience, …).
3. Delete or archive this \`_import\` run when done.
4. Do **not** dump raw ChatGPT exports into live pack files.
`;
  return files;
}
