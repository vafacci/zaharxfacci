/**
 * Deterministic routing helpers. Policy/specialist selection must not rely on LLM alone.
 */
import { isWeeklyContentLoop, weeklyLoopReasoning } from "@/domain/content-loop";
import {
  dreamitResearchLoopReasoning,
  grupviUxLoopReasoning,
  isDreamitResearchLoop,
  isGrupviUxLoop,
} from "@/domain/project-loops";

export type OwnerIntent = {
  wantsExternal: boolean;
  wantsMerge: boolean;
  wantsPublish: boolean;
  wantsCoding: boolean;
  wantsResearch: boolean;
  /** M5 Grupvi/DreamIT UX review */
  wantsUx: boolean;
  /** M5 QA checklist / acceptance review */
  wantsQa: boolean;
  /** M5 analytics / metrics snapshot */
  wantsAnalytics: boolean;
  wantsImage: boolean;
  wantsMarketing: boolean;
  /** Brief → image → caption → calendar (M4 draft pipeline) */
  wantsContentPipeline: boolean;
  wantsAutomation: boolean;
  /** Weekly loop: marketing brief → social drafts → QA → owner approval stop */
  wantsWeeklyContentLoop: boolean;
  /** Grupvi weekly UX loop (deterministic) */
  wantsGrupviUxLoop: boolean;
  /** DreamIT weekly research loop (deterministic) */
  wantsDreamitResearchLoop: boolean;
};

/** True only for affirmative external intents — ignores "do not publish". */
export function ownerWantsExternalAction(title: string, objective: string): boolean {
  const text = `${title}\n${objective}`;
  if (
    /\b(do not|don't|never|no|uden at|ikke)\b.{0,40}\b(publish|post|send|deploy|merge|push)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  return /\b(publish\s+(this|to|on|now|the|a|an)|post\s+to|send\s+(dm|email|message)|deploy\b|merge\b|push\s+to|purchase\b|buy\b|enable\s+paid)/i.test(
    text,
  );
}

export function classifyOwnerIntent(title: string, objective: string): OwnerIntent {
  const text = `${title}\n${objective}`;
  const wantsExternal = ownerWantsExternalAction(title, objective);
  // Merge/push wins over publish when both appear (policy gate is still approval-only).
  const wantsMerge = wantsExternal && /\b(merge|push)\b/i.test(text);
  const wantsPublish = wantsExternal && !wantsMerge;

  // Must win over coding (AUTIQ + calendar/brand) and the M4 "weekly content" pipeline.
  if (!wantsExternal && isWeeklyContentLoop(title, objective)) {
    return {
      wantsExternal,
      wantsMerge,
      wantsPublish,
      wantsCoding: false,
      wantsResearch: false,
      wantsUx: false,
      wantsQa: false,
      wantsAnalytics: false,
      wantsImage: false,
      wantsMarketing: true,
      wantsContentPipeline: false,
      wantsAutomation: false,
      wantsWeeklyContentLoop: true,
      wantsGrupviUxLoop: false,
      wantsDreamitResearchLoop: false,
    };
  }

  if (!wantsExternal && isGrupviUxLoop(title, objective)) {
    return {
      wantsExternal,
      wantsMerge,
      wantsPublish,
      wantsCoding: false,
      wantsResearch: false,
      wantsUx: true,
      wantsQa: false,
      wantsAnalytics: false,
      wantsImage: false,
      wantsMarketing: false,
      wantsContentPipeline: false,
      wantsAutomation: false,
      wantsWeeklyContentLoop: false,
      wantsGrupviUxLoop: true,
      wantsDreamitResearchLoop: false,
    };
  }

  if (!wantsExternal && isDreamitResearchLoop(title, objective)) {
    return {
      wantsExternal,
      wantsMerge,
      wantsPublish,
      wantsCoding: false,
      wantsResearch: true,
      wantsUx: false,
      wantsQa: false,
      wantsAnalytics: false,
      wantsImage: false,
      wantsMarketing: false,
      wantsContentPipeline: false,
      wantsAutomation: false,
      wantsWeeklyContentLoop: false,
      wantsGrupviUxLoop: false,
      wantsDreamitResearchLoop: true,
    };
  }

  // Social/content campaign language is marketing pipeline — not a developer vault edit.
  const looksLikeContentCampaign =
    /\b(content\s+pipeline|weekly\s+content|campaign\s+draft|image\s+and\s+caption|caption\s+and\s+image|postiz|content\s+calendar|social\s+draft)\b/i.test(
      text,
    );

  // Research-first / defer build — beats coding when owner says research before code.
  const researchSignal =
    !wantsExternal &&
    /\b(research|reserach|investigate|undersøg|analyse|survey|find\s+problems|competitor|forstå\s+koncept)\b/i.test(
      text,
    );
  const deferCoding =
    /\b(først|first|ingen\s+kode|no\s+code|kun\s+research|research\s+first|ikke\s+bygget|ikke\s+kode|before\s+(we\s+)?(build|code)|no\s+html\s+yet|ingen\s+html)\b/i.test(
      text,
    );
  const researchFirst = researchSignal && deferCoding;

  // Avoid matching product phrasing like "problems we should fix" (DreamIT research).
  // Coding stays the main path for real build/fix asks — only skip when research-first defers it.
  const wantsCoding =
    !wantsExternal &&
    !looksLikeContentCampaign &&
    !researchFirst &&
    (/\b(bug|implement|refactor|unit\s+test|toy-counter|counter\.js|opencode|bounded-patch|autiq-web|autiq-main|grupvi-app|dreamit-web|nofacci-web|studiechat)\b/i.test(
      text,
    ) ||
      /\b(developer|workspace)\b/i.test(text) ||
      // Explicit brand-vault file edits (paths or update verbs) — not "content calendar" campaigns
      (/\bautiq\b/i.test(text) &&
        (/\b(content\/|brand\/|voice\.md|calendar\.md)\b/i.test(text) ||
          (/\b(brand|voice|tone)\b/i.test(text) &&
            /\b(opdater|skriv|udvid|ret|fix|update|edit|tilføj)\b/i.test(text)))) ||
      (/\b(grupvi|studiechat)\b/i.test(text) &&
        /\b(product\/|ux-notes|ux\b|opdater|skriv|tilføj|edit)\b/i.test(text)) ||
      (/\bdreamit\b/i.test(text) &&
        /\b(product\/|notes\.md|website|opdater|skriv|tilføj|edit)\b/i.test(text)) ||
      (/\bnofacci\b/i.test(text) &&
        !researchFirst &&
        (/\b(nofacci-web|index\.html|styles\.css|inspiration\/|opdater|skriv|tilføj|edit|implement)\b/i.test(
          text,
        ) ||
          /\b(byg|build)\b.{0,60}\b(hjemmeside|website|web\s*site|landing)\b/i.test(text))) ||
      (/\bdailycap\b/i.test(text) &&
        /\b(product\/|brand\/|opdater|skriv|tilføj|edit|implement)\b/i.test(text) &&
        !researchSignal) ||
      /\b(fix|patch|opdater|skriv|udvid)\b.{0,80}\b(bug|code|test|workspace|toy-counter|counter\.js|src\/|brand|voice|index\.html)\b/i.test(
        text,
      ) ||
      /\b(bug|code|test|workspace|toy-counter|counter\.js|src\/|brand|voice).{0,80}\b(fix|patch|opdater)\b/i.test(
        text,
      ));
  const wantsResearch =
    !wantsExternal && !wantsCoding && (researchFirst || researchSignal);
  const wantsUx =
    !wantsExternal &&
    !wantsCoding &&
    !wantsResearch &&
    /\b(ux|ui\b|usability|brugeroplevelse|user\s+experience|design\s+review|chat\s+ux)\b/i.test(
      text,
    );
  const wantsQa =
    !wantsExternal &&
    !wantsCoding &&
    !wantsResearch &&
    !wantsUx &&
    /\b(qa|quality\s+assurance|test\s+plan|acceptance\s+criteria|regression\s+checklist|qa\s+review)\b/i.test(
      text,
    );
  const wantsAnalytics =
    !wantsExternal &&
    !wantsCoding &&
    !wantsResearch &&
    !wantsUx &&
    !wantsQa &&
    /\b(analytics|metrics|kpi|projektmetrics|performance\s+report|conversion)\b/i.test(text);
  const wantsContentPipeline =
    !wantsExternal &&
    !wantsCoding &&
    /\b(content\s+pipeline|weekly\s+content|campaign\s+draft|image\s+and\s+caption|caption\s+and\s+image|postiz|content\s+calendar|social\s+draft)\b/i.test(
      text,
    );
  const wantsImage =
    !wantsExternal &&
    !wantsCoding &&
    (wantsContentPipeline ||
      /\b(image|visual|billede|illustration|comfy|graphic|txt2img|generate\s+an?\s+image)\b/i.test(
        text,
      ));
  const wantsMarketing =
    !wantsExternal &&
    !wantsCoding &&
    !wantsResearch &&
    !wantsUx &&
    !wantsQa &&
    !wantsAnalytics &&
    (!wantsImage || wantsContentPipeline) &&
    /\b(marketing|content|caption|draft|outline|ideas|kampagne|copy|calendar)\b/i.test(text);
  const wantsAutomation =
    !wantsExternal &&
    !wantsCoding &&
    /\b(n8n|automation\s+workflow|webhook|orchestrate\s+workflow)\b/i.test(text);

  return {
    wantsExternal,
    wantsMerge,
    wantsPublish,
    wantsCoding,
    wantsResearch,
    wantsUx,
    wantsQa,
    wantsAnalytics,
    wantsImage,
    wantsMarketing,
    wantsContentPipeline,
    wantsAutomation,
    wantsWeeklyContentLoop: false,
    wantsGrupviUxLoop: false,
    wantsDreamitResearchLoop: false,
  };
}

function firstAvailable(available: string[], preferred: string[]): string | undefined {
  return preferred.find((k) => available.includes(k));
}

/**
 * Resolve specialist from deterministic intent, falling back to a validated model suggestion.
 */
export function resolveSpecialistTemplateKey(
  intent: OwnerIntent,
  availableSpecialists: string[],
  modelSuggested: string,
): string {
  const suggested = availableSpecialists.includes(modelSuggested)
    ? modelSuggested
    : undefined;

  if (intent.wantsMerge) {
    return (
      firstAvailable(availableSpecialists, ["developer"]) ??
      suggested ??
      availableSpecialists[0] ??
      "developer"
    );
  }
  if (intent.wantsPublish) {
    return (
      firstAvailable(availableSpecialists, ["marketing", "social", "developer"]) ??
      suggested ??
      availableSpecialists[0] ??
      "marketing"
    );
  }
  if (intent.wantsWeeklyContentLoop) {
    return (
      firstAvailable(availableSpecialists, ["marketing", "social"]) ??
      suggested ??
      availableSpecialists[0] ??
      "marketing"
    );
  }
  if (intent.wantsGrupviUxLoop) {
    return (
      firstAvailable(availableSpecialists, ["ux-design", "design", "research"]) ??
      suggested ??
      availableSpecialists[0] ??
      "ux-design"
    );
  }
  if (intent.wantsDreamitResearchLoop) {
    return (
      firstAvailable(availableSpecialists, ["research", "analytics"]) ??
      suggested ??
      availableSpecialists[0] ??
      "research"
    );
  }
  if (intent.wantsCoding) {
    return (
      firstAvailable(availableSpecialists, ["developer"]) ??
      suggested ??
      availableSpecialists[0] ??
      "developer"
    );
  }
  if (intent.wantsResearch) {
    return (
      firstAvailable(availableSpecialists, ["research", "analytics"]) ??
      suggested ??
      availableSpecialists[0] ??
      "research"
    );
  }
  if (intent.wantsUx) {
    return (
      firstAvailable(availableSpecialists, ["ux-design", "design", "research"]) ??
      suggested ??
      availableSpecialists[0] ??
      "ux-design"
    );
  }
  if (intent.wantsQa) {
    return (
      firstAvailable(availableSpecialists, ["qa", "security-qa"]) ??
      suggested ??
      availableSpecialists[0] ??
      "qa"
    );
  }
  if (intent.wantsAnalytics) {
    return (
      firstAvailable(availableSpecialists, ["analytics", "research", "marketing"]) ??
      suggested ??
      availableSpecialists[0] ??
      "analytics"
    );
  }
  if (intent.wantsContentPipeline) {
    // Pipeline spans image + social; prefer social/marketing as lead with image steps.
    return (
      firstAvailable(availableSpecialists, ["social", "marketing", "image"]) ??
      suggested ??
      availableSpecialists[0] ??
      "marketing"
    );
  }
  if (intent.wantsAutomation) {
    return (
      firstAvailable(availableSpecialists, ["automation", "developer"]) ??
      suggested ??
      availableSpecialists[0] ??
      "automation"
    );
  }
  if (intent.wantsImage) {
    return (
      firstAvailable(availableSpecialists, ["image", "design"]) ??
      suggested ??
      availableSpecialists[0] ??
      "image"
    );
  }
  if (intent.wantsMarketing) {
    return (
      firstAvailable(availableSpecialists, ["marketing", "social"]) ??
      suggested ??
      availableSpecialists[0] ??
      "marketing"
    );
  }
  return suggested ?? availableSpecialists[0] ?? "developer";
}

export function reasoningForIntent(
  intent: OwnerIntent,
  specialist: string,
  modelReasoning?: string,
): string {
  if (intent.wantsMerge) {
    return `Merge/push is high-risk: route to ${specialist}, stop at human approval — no auto-merge/push.`;
  }
  if (intent.wantsPublish) {
    return `Publish/external send is high-risk: route to ${specialist}, stop at human approval — no external publish.`;
  }
  if (intent.wantsWeeklyContentLoop) {
    return weeklyLoopReasoning(specialist);
  }
  if (intent.wantsGrupviUxLoop) {
    return grupviUxLoopReasoning(specialist);
  }
  if (intent.wantsDreamitResearchLoop) {
    return dreamitResearchLoopReasoning(specialist);
  }
  if (intent.wantsCoding) {
    return `Coding/fix task: route to ${specialist} for allowlisted workspace execution with verified evidence.`;
  }
  if (intent.wantsResearch) {
    return `M5 research: route to ${specialist}; cite verified sources; never invent customer/competitor private data.`;
  }
  if (intent.wantsUx) {
    return `M5 UX review: route to ${specialist}; evidence-first UX findings and proposed acceptance criteria.`;
  }
  if (intent.wantsQa) {
    return `M5 QA: route to ${specialist}; checklist + test matrix without claiming unexecuted tests.`;
  }
  if (intent.wantsAnalytics) {
    return `M5 analytics: route to ${specialist}; use FACCI internal metrics only unless an external source is verified.`;
  }
  if (intent.wantsContentPipeline) {
    return `M4 draft pipeline: image proposal via Image Studio, caption/calendar staging (Postiz draft if configured), publish remains approval-gated. Lead specialist: ${specialist}.`;
  }
  if (intent.wantsAutomation) {
    return `Automation prepare via n8n dry-run for ${specialist}; live triggers require approval.`;
  }
  if (modelReasoning?.trim()) return modelReasoning.trim().slice(0, 2000);
  return `Delegated to project-local specialist (${specialist}).`;
}

/** Task origin: operational work vs milestone/validation harness tasks. */
export type TaskOrigin = "operational" | "validation";

const VALIDATION_IDEMPOTENCY =
  /^(m[0-9]+[-_]|facci[_-]?(live|test|m[0-9])|validation[-_]|test[-_]|e2e[-_])/i;

/**
 * Historical M1–M3 harness titles — only used when idempotencyKey is missing/ambiguous.
 * Do NOT match generic real-work titles like "Draft 3 content ideas" alone.
 */
const VALIDATION_TITLE_EXACT = new Set(
  [
    "fix toy-counter add bug",
    "merge toy-counter fix to main",
    "publish social post now",
    "publish social post",
    "cancel me",
    "cancel me now",
    "test: publish_post (skal blokeres)",
    "maybe improve things somehow",
  ].map((s) => s.toLowerCase()),
);

export function resolveTaskOrigin(params: {
  explicitOrigin?: TaskOrigin | null;
  idempotencyKey?: string | null;
  title?: string | null;
}): TaskOrigin {
  if (params.explicitOrigin === "validation" || params.explicitOrigin === "operational") {
    return params.explicitOrigin;
  }
  if (params.idempotencyKey && VALIDATION_IDEMPOTENCY.test(params.idempotencyKey)) {
    return "validation";
  }
  // UI test button historically used ui-…-publish
  if (
    params.idempotencyKey &&
    /^ui-/i.test(params.idempotencyKey) &&
    /publish/i.test(params.idempotencyKey)
  ) {
    return "validation";
  }
  const title = (params.title ?? "").trim().toLowerCase();
  if (title && VALIDATION_TITLE_EXACT.has(title)) {
    return "validation";
  }
  return "operational";
}
