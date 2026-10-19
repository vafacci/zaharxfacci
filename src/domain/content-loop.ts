/**
 * AUTIQ weekly content loop ("flywheel"): one scheduled task walks
 * marketing brief → social calendar/caption drafts → security-qa checkpoint →
 * owner approval stop. Publish is never executed — approval only records intent.
 *
 * Pure module (no Prisma) so planners, UI and tests can share it.
 */
import { z } from "zod";
import { buildSpecialistReport } from "@/domain/specialist-reports";
import type { StructuredPlan } from "@/domain/schemas";
import type { PlanContext } from "@/providers/types";

export { AUTIQ_WEEKLY_LOOP_SCHEDULE_TITLE } from "@/domain/loop-titles";
export const AUTIQ_WEEKLY_LOOP_RULE = "every_168h";

export const AUTIQ_WEEKLY_LOOP_TEMPLATE = {
  title: "AUTIQ weekly content loop: brief, calendar drafts, QA, analytics, owner approval",
  objective: [
    "Run the AUTIQ weekly content loop for this week.",
    "1) Marketing writes a short weekly brief: one theme, target audience, three content angles, success signal.",
    "2) Social drafts three captions and updates content/calendar.md in the allowlisted AUTIQ brand vault (status stays draft). Follow brand/voice.md.",
    "3) Security-QA checkpoint: claims, tone, no invented customer data, no secrets.",
    "4) Analytics reviews this week's drafts (observed only — no invented engagement) and proposes a next-week theme for memory.",
    "5) Stop and request owner approval before any publish. Nothing is posted or scheduled externally by FACCI.",
  ].join("\n"),
  origin: "operational" as const,
};

const LOOP_MARKER =
  /\b(weekly\s+content\s+loop|content\s+flywheel|ugentlig[et]?\s+(content|indholds)[-\s]?(loop|hjul))\b/i;

/** Deterministic: schedule-originated (or owner-typed) weekly loop objective. */
export function isWeeklyContentLoop(title: string, objective: string): boolean {
  return LOOP_MARKER.test(`${title}\n${objective}`);
}

type Step = StructuredPlan["steps"][number];

/** Calendar rows the loop rewrites each week (must exist in workspaces/autiq/content/calendar.md). */
export const WEEKLY_LOOP_CHANNELS = ["Instagram", "LinkedIn", "Facebook"] as const;

const cell = z
  .string()
  .transform((s) => s.replace(/[|\r\n]+/g, " ").replace(/\s+/g, " ").trim())
  .pipe(z.string().min(3).max(280));

export const WeeklyBriefSchema = z.object({
  theme: cell,
  audience: cell,
  angles: z.array(cell).min(1).max(3),
  captions: z.array(cell).min(1).max(3),
  successSignal: cell,
});
export type WeeklyBrief = z.infer<typeof WeeklyBriefSchema>;

export function parseWeeklyBrief(raw: unknown): WeeklyBrief | null {
  const r = WeeklyBriefSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Always 3 captions (Instagram, LinkedIn, Facebook) — pad from angles/theme if model returns fewer. */
export function captionsForWeeklyChannels(brief: WeeklyBrief): string[] {
  return WEEKLY_LOOP_CHANNELS.map((channel, i) => {
    const fromCaption = brief.captions[i]?.trim();
    if (fromCaption && fromCaption.length >= 3) return sanitizeCaptionDraft(fromCaption);
    const fromAngle = brief.angles[i]?.trim();
    if (fromAngle && fromAngle.length >= 3) {
      return sanitizeCaptionDraft(`${fromAngle} (${channel})`);
    }
    return sanitizeCaptionDraft(`${brief.theme} — ${channel} draft`);
  });
}

export const WEEKLY_BRIEF_SYSTEM_PROMPT = `You are the marketing specialist for one project inside FACCI.
Return ONLY a JSON object, no prose:
{"theme":"...","audience":"...","angles":["...","...","..."],"captions":["...","...","..."],"successSignal":"..."}
Rules:
- Exactly three angles and three short captions (one line each, under 180 characters).
- Captions are drafts for Instagram, LinkedIn and Facebook, in that order.
- Follow the brand pack in the user message (positioning, audience, claims, examples, glossary, voice).
- Theme and angles MUST fit positioning + audience. Prefer craft close to approved examples.
- Obey claims policy: no invented customers, testimonials, numbers, metrics, quotes, or success stories.
- No hype words: revolutionary, pioneering, unveiling the future, game-changer, #1.
- No emoji spam (at most one emoji total across all three captions, optional).
- No links. Max two hashtags total across all captions. No publish dates.
- Prefer one concrete CTA per caption. AI is infrastructure, not the hero.
- Use preferred product names from the glossary (AUTIQ, Content Autopilot).`;

/** Soft cleanup after model output — keeps vault drafts on-brand even when the 3B model hypes. */
export function sanitizeCaptionDraft(text: string): string {
  let s = text.replace(/[|\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(
    /\b(revolutionary|revolutionizing|pioneering|unveiling the future|game-?changer|next-?level|disruptive)\b/gi,
    "",
  );
  // Collapse leftover doubled spaces / punctuation from word strips
  s = s.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
  // Drop most emoji / symbols; keep basic punctuation
  const withoutEmoji = s.replace(/\p{Extended_Pictographic}/gu, "").replace(/\s{2,}/g, " ").trim();
  if (withoutEmoji.length >= 3) s = withoutEmoji;
  return s.slice(0, 280);
}

export function sanitizeWeeklyBrief(brief: WeeklyBrief): WeeklyBrief {
  return {
    theme: sanitizeCaptionDraft(brief.theme),
    audience: sanitizeCaptionDraft(brief.audience),
    angles: brief.angles.map(sanitizeCaptionDraft).filter((a) => a.length >= 3).slice(0, 3),
    captions: brief.captions.map(sanitizeCaptionDraft).filter((c) => c.length >= 3).slice(0, 3),
    successSignal: sanitizeCaptionDraft(brief.successSignal),
  };
}

export function parseAndSanitizeWeeklyBrief(raw: unknown): WeeklyBrief | null {
  const parsed = parseWeeklyBrief(raw);
  if (!parsed) return null;
  const cleaned = sanitizeWeeklyBrief(parsed);
  // Re-validate after sanitize (angles/captions may shrink below min)
  return parseWeeklyBrief(cleaned);
}

/** Build weekly-loop user message with brand pack (preferred) or legacy voice excerpt. */
export function buildWeeklyBriefUserPrompt(
  input: {
    projectSlug: string;
    projectName: string;
    projectMission?: string | null;
    title: string;
    objective: string;
    projectMemories?: { category: string; content: string }[];
  },
  brandVoiceOrPack?: string | null,
): string {
  const memories =
    input.projectMemories && input.projectMemories.length > 0
      ? input.projectMemories
          .slice(0, 6)
          .map((m) => `- [${m.category}] ${m.content.slice(0, 220)}`)
          .join("\n")
      : "(none)";
  const pack = (brandVoiceOrPack ?? "").trim().slice(0, 5500);

  return `Project slug: ${input.projectSlug}
Project name: ${input.projectName}
Mission: ${input.projectMission ?? "(none)"}
Project memory (this project only):
${memories}

Brand pack (follow closely — positioning, audience, claims, examples, glossary, voice). Do not copy calendar tables:
${pack || "(none on disk — use mission + rules only)"}

Owner task title: ${input.title}
Owner objective: ${input.objective}

Return ONLY the weekly brief JSON object now.`;
}

function pick(available: string[], preferred: string[], fallback: string): string {
  return preferred.find((k) => available.includes(k)) ?? fallback;
}

function weeklyBriefMarkdown(
  input: PlanContext,
  plannerLabel: string,
  brief: WeeklyBrief | null,
  brandPackNote?: string | null,
) {
  const week = new Date().toISOString().slice(0, 10);
  const packLine = brandPackNote?.trim()
    ? `\n## Brand pack\n${brandPackNote.trim()}\n`
    : "";
  const body = brief
    ? `## Theme
${brief.theme}

## Audience
${brief.audience}

## Content angles
${brief.angles.map((a, i) => `${i + 1}. ${a}`).join("\n")}

## Caption drafts
${captionsForWeeklyChannels(brief)
  .map((c, i) => `- **${WEEKLY_LOOP_CHANNELS[i]}:** ${c}`)
  .join("\n")}

## Success signal
${brief.successSignal}`
    : `## Brief
_Blocked: no valid brief this run (model failure and/or brand pack not ready). No calendar rows were written. Fix the brand pack or re-run the loop._`;
  return `# AUTIQ weekly brief (week of ${week})

> Marketing specialist · ${plannerLabel}
> Project: ${input.projectName} (${input.projectSlug}). AI draft only — not published.

## Owner objective
${input.objective}
${packLine}
${body}
`;
}

/** Deterministic next-week proposal from this week's brief — no invented KPIs. */
export function proposeNextWeekTheme(brief: WeeklyBrief): {
  nextTheme: string;
  carryForward: string[];
  watchouts: string[];
  memoryBlurb: string;
} {
  const week = new Date().toISOString().slice(0, 10);
  const focus =
    brief.angles[1]?.trim() ||
    brief.angles[0]?.trim() ||
    brief.theme;
  const nextTheme = sanitizeCaptionDraft(`Follow-up: ${focus}`);
  const carryForward = captionsForWeeklyChannels(brief).map((c, i) =>
    `${WEEKLY_LOOP_CHANNELS[i]}: ${c}`,
  );
  const watchouts = [
    "No live engagement/conversion metrics available — do not invent numbers.",
    "Publish still requires human approval; drafts stay draft.",
    "Keep claims evidence-backed; no fake testimonials.",
  ];
  const memoryBlurb = [
    `AUTIQ weekly analytics (${week})`,
    `This week theme (observed): ${brief.theme}`,
    `Proposed next theme: ${nextTheme}`,
    `Audience (observed): ${brief.audience}`,
    `Success signal (observed): ${brief.successSignal}`,
  ].join(" · ");
  return { nextTheme, carryForward, watchouts, memoryBlurb };
}

export function buildWeeklyAnalyticsMarkdown(
  input: PlanContext,
  plannerLabel: string,
  brief: WeeklyBrief | null,
): string {
  const week = new Date().toISOString().slice(0, 10);
  if (!brief) {
    return `# AUTIQ weekly analytics (${week})

> Analytics specialist · ${plannerLabel}
> Project: ${input.projectName} (${input.projectSlug})

## Observed
- Weekly brief was **blocked** this run — no caption drafts to review.

## Proposed
- Re-run the weekly content loop before proposing a next theme.

## Blocked
- External engagement / revenue metrics (no connector).
- Invented customer outcomes.

_AI analytics note — internal FACCI evidence only._
`;
  }
  const proposal = proposeNextWeekTheme(brief);
  return `# AUTIQ weekly analytics (${week})

> Analytics specialist · ${plannerLabel}
> Project: ${input.projectName} (${input.projectSlug})
> Provenance: **observed** drafts from this loop · **proposed** next theme · **blocked** live KPIs.

## Observed (this week's drafts)
- **Theme:** ${brief.theme}
- **Audience:** ${brief.audience}
- **Angles:** ${brief.angles.join(" · ")}
- **Captions written:**
${proposal.carryForward.map((c) => `  - ${c}`).join("\n")}
- **Success signal (stated, not measured):** ${brief.successSignal}

## Proposed (next week — for owner / marketing)
- **Next theme:** ${proposal.nextTheme}
- Deepen the angle that was not the primary caption; keep AUTIQ voice (clear, no hype).
- Prefer one concrete CTA; AI stays infrastructure, not the hero.

## Watchouts
${proposal.watchouts.map((w) => `- ${w}`).join("\n")}

## Blocked
- Post reach, likes, leads, revenue (no live analytics connector).
- Competitor scrape / web fetch in this path.

_AI analytics note — feeds project memory for the next loop; does not publish._
`;
}

/**
 * Fixed loop plan. The model only supplies the brief/caption text;
 * step order, specialists and the approval stop are deterministic.
 */
export function buildWeeklyContentLoopSteps(
  input: PlanContext,
  opts: {
    plannerLabel: string;
    brief: WeeklyBrief | null;
    /** When false, skip calendar write even if a brief object exists. */
    brandPackReady?: boolean;
    brandPackNote?: string | null;
  },
): Step[] {
  const brandPackReady = opts.brandPackReady !== false;
  const brief = brandPackReady ? opts.brief : null;
  const avail = input.availableSpecialists;
  const marketing = pick(avail, ["marketing", "social"], avail[0] ?? "marketing");
  const social = pick(avail, ["social", "marketing"], marketing);
  const qa = pick(avail, ["security-qa", "qa"], marketing);
  const analytics = pick(avail, ["analytics", "marketing", "research"], marketing);
  const stamp = Date.now();

  const qaReport = buildSpecialistReport({
    projectName: input.projectName,
    projectSlug: input.projectSlug,
    title: `QA checkpoint: ${input.title}`,
    objective:
      "Review this week's brief, calendar rows and captions before owner approval: factual claims, brand tone, no invented customer data, no secrets, no external publish performed.",
    templateKey: qa,
    projectMission: input.projectMission ?? null,
    plannerLabel: opts.plannerLabel,
  });

  const steps: Omit<Step, "sequence">[] = [
    {
      agentRole: "ceo",
      agentTemplateKey: "ceo",
      actionType: "receive_owner_request",
      summary: `FACCI CEO received scheduled weekly content loop for ${input.projectName}`,
      requiresApproval: false,
    },
    {
      agentRole: "manager",
      agentTemplateKey: "manager",
      actionType: "delegate_to_specialist",
      summary: `${input.projectName} Manager delegates loop: ${marketing} → ${social} → ${qa} → ${analytics} → owner approval`,
      requiresApproval: false,
    },
    {
      agentRole: "specialist",
      agentTemplateKey: marketing,
      actionType: "write_local_artifact",
      summary: "Marketing writes weekly brief / strategy (local draft)",
      requiresApproval: false,
      produceArtifact: {
        kind: "weekly-brief",
        title: "AUTIQ weekly brief",
        filename: `${stamp}-${input.projectSlug}-weekly-brief.md`,
        content: weeklyBriefMarkdown(
          input,
          opts.plannerLabel,
          brief,
          opts.brandPackNote ?? null,
        ),
      },
    },
  ];

  // Brand vault is AUTIQ-only. Deterministic writer — not bounded-patch / OpenCode.
  // Requires a ready brand pack so captions stay concept-aligned.
  if (input.projectSlug === "autiq" && brief && brandPackReady) {
    steps.push({
      agentRole: "specialist",
      agentTemplateKey: social,
      actionType: "update_brand_calendar",
      summary:
        "Social writes Instagram/LinkedIn/Facebook caption drafts into content/calendar.md (deterministic)",
      requiresApproval: false,
      riskLevel: "low",
      brandCalendarTask: {
        workspaceId: "autiq",
        theme: brief.theme,
        audience: brief.audience,
        angles: brief.angles,
        captions: brief.captions,
        successSignal: brief.successSignal,
      },
    });
  }

  steps.push(
    {
      agentRole: "specialist",
      agentTemplateKey: social,
      actionType: "stage_social_draft",
      summary: "Social stages caption review package locally (Postiz disabled for scheduled loop)",
      requiresApproval: false,
      riskLevel: "low",
      socialDraft: {
        caption: `# ${input.title}\n\n${
          brief
            ? captionsForWeeklyChannels(brief)
                .map((c, i) => `**${WEEKLY_LOOP_CHANNELS[i]}:** ${c}`)
                .join("\n\n")
            : "_No caption drafts — brief was blocked this run._"
        }\n\n_AI draft — not published, not scheduled._`,
        channel: "instagram",
        title: input.title,
        attemptPostizDraft: false,
      },
    },
    {
      agentRole: "specialist",
      agentTemplateKey: qa,
      actionType: "write_local_artifact",
      summary: "Security-QA checkpoint on this week's drafts",
      requiresApproval: false,
      produceArtifact: {
        kind: qaReport.kind,
        title: qaReport.title,
        filename: `${stamp}-${input.projectSlug}-weekly-qa.md`,
        content: qaReport.content,
      },
    },
    {
      agentRole: "specialist",
      agentTemplateKey: analytics,
      actionType: "write_local_artifact",
      summary:
        "Analytics reviews this week's drafts and proposes next-week theme (no invented KPIs)",
      requiresApproval: false,
      produceArtifact: {
        kind: "weekly-analytics",
        title: "AUTIQ weekly analytics / next theme",
        filename: `${stamp}-${input.projectSlug}-weekly-analytics.md`,
        content: buildWeeklyAnalyticsMarkdown(input, opts.plannerLabel, brief),
      },
    },
    {
      agentRole: "manager",
      agentTemplateKey: "manager",
      actionType: "verify_artifact",
      summary: "Manager verifies brief, staging, QA and analytics artifacts exist on disk",
      requiresApproval: false,
    },
    {
      agentRole: "specialist",
      agentTemplateKey: social,
      actionType: "request_publish_post",
      summary:
        "Owner approval stop: weekly drafts ready for review. FACCI will NOT publish — approval only records the decision.",
      requiresApproval: true,
      approvalActionType: "publish_post",
      riskLevel: "high",
    },
  );

  return steps.map((s, i) => ({ ...s, sequence: i + 1 }) as Step);
}

export function weeklyLoopReasoning(marketing: string): string {
  return `Weekly content loop: ${marketing} brief → social calendar/caption drafts → security-qa → analytics next-theme → stop at owner approval. No external publish.`;
}
