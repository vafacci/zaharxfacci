import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  AUTIQ_WEEKLY_LOOP_RULE,
  AUTIQ_WEEKLY_LOOP_TEMPLATE,
  buildWeeklyContentLoopSteps,
  captionsForWeeklyChannels,
  isWeeklyContentLoop,
  parseAndSanitizeWeeklyBrief,
  proposeNextWeekTheme,
  sanitizeCaptionDraft,
  type WeeklyBrief,
} from "@/domain/content-loop";
import {
  brandPackReadinessSummary,
  loadAutiqBrandPack,
  loadAutiqBrandVoice,
} from "@/tools/autiq-brand";
import { classifyOwnerIntent, resolveSpecialistTemplateKey } from "@/domain/routing";
import { computeNextRunAt, ScheduleActionTemplateSchema, ScheduleRuleSchema } from "@/domain/schedules";
import { DemoPlannerProvider } from "@/providers/demo-planner";
import { sanitizeOllamaPlanForTest } from "@/providers/ollama-provider";
import type { PlanContext } from "@/providers/types";
import {
  applyWeeklyCalendarCaptions,
  writeAutiqWeeklyCalendar,
} from "@/tools/autiq-calendar";

const AUTIQ_TEAM = [
  "social",
  "image",
  "developer",
  "marketing",
  "automation",
  "analytics",
  "security-qa",
];

const scheduledObjective = `${AUTIQ_WEEKLY_LOOP_TEMPLATE.objective}\n\n(Scheduled: AUTIQ weekly content loop · rule ${AUTIQ_WEEKLY_LOOP_RULE})`;

const ctx: PlanContext = {
  projectSlug: "autiq",
  projectName: "AUTIQ",
  projectMission: "Content business",
  title: AUTIQ_WEEKLY_LOOP_TEMPLATE.title,
  objective: scheduledObjective,
  availableSpecialists: AUTIQ_TEAM,
};

function expectLoopShape(plan: ReturnType<typeof sanitizeOllamaPlanForTest>) {
  const actions = plan.steps.map((s) => s.actionType);
  expect(actions).toEqual([
    "receive_owner_request",
    "delegate_to_specialist",
    "write_local_artifact",
    "update_brand_calendar",
    "stage_social_draft",
    "write_local_artifact",
    "write_local_artifact",
    "verify_artifact",
    "request_publish_post",
  ]);
  const keys = plan.steps.filter((s) => s.agentRole === "specialist").map((s) => s.agentTemplateKey);
  expect(keys).toEqual(["marketing", "social", "social", "security-qa", "analytics", "social"]);
  expect(plan.steps.some((s) => s.agentTemplateKey === "developer")).toBe(false);
  expect(plan.steps.some((s) => s.actionType === "run_developer_task")).toBe(false);
  expect(plan.steps.some((s) => s.actionType === "run_image_studio_task")).toBe(false);
  const analytics = plan.steps.find((s) => s.produceArtifact?.kind === "weekly-analytics");
  expect(analytics?.agentTemplateKey).toBe("analytics");
  expect(analytics?.produceArtifact?.content).toMatch(/Proposed|Blocked|Observed/i);

  const cal = plan.steps.find((s) => s.actionType === "update_brand_calendar");
  expect(cal?.brandCalendarTask?.workspaceId).toBe("autiq");
  expect(cal?.brandCalendarTask?.captions.length).toBeGreaterThanOrEqual(1);

  const social = plan.steps.find((s) => s.actionType === "stage_social_draft");
  expect(social?.socialDraft?.attemptPostizDraft).toBe(false);

  const last = plan.steps.at(-1)!;
  expect(last.requiresApproval).toBe(true);
  expect(last.approvalActionType).toBe("publish_post");
  expect(plan.specialistTemplateKey).toBe("marketing");
}

describe("AUTIQ weekly content loop routing", () => {
  it("detects the schedule-originated objective as the weekly loop, not coding/pipeline/external", () => {
    expect(isWeeklyContentLoop(ctx.title, ctx.objective)).toBe(true);
    const intent = classifyOwnerIntent(ctx.title, ctx.objective);
    expect(intent.wantsWeeklyContentLoop).toBe(true);
    expect(intent.wantsExternal).toBe(false);
    expect(intent.wantsPublish).toBe(false);
    expect(intent.wantsCoding).toBe(false);
    expect(intent.wantsContentPipeline).toBe(false);
    expect(intent.wantsImage).toBe(false);
    expect(resolveSpecialistTemplateKey(intent, AUTIQ_TEAM, "developer")).toBe("marketing");
  });

  it("does not hijack ordinary AUTIQ calendar edits or M4 pipeline asks", () => {
    const calendar = classifyOwnerIntent(
      "Opdater AUTIQ calendar",
      "Skriv tre rækker i content/calendar.md",
    );
    expect(calendar.wantsWeeklyContentLoop).toBe(false);
    expect(calendar.wantsCoding).toBe(true);

    const pipeline = classifyOwnerIntent("Weekly content pipeline", "image and caption draft");
    expect(pipeline.wantsWeeklyContentLoop).toBe(false);
    expect(pipeline.wantsContentPipeline).toBe(true);
  });

  it("an explicit publish request still wins over the loop marker", () => {
    const intent = classifyOwnerIntent("Weekly content loop", "Publish this to Instagram now");
    expect(intent.wantsWeeklyContentLoop).toBe(false);
    expect(intent.wantsPublish).toBe(true);
  });

  it("demo planner emits the fixed loop ending at owner approval", async () => {
    const plan = await new DemoPlannerProvider().generateStructuredPlan(ctx);
    expectLoopShape(plan);
  });

  it("ollama sanitizer forces the loop and places the model brief's exact captions", () => {
    const plan = sanitizeOllamaPlanForTest(
      {
        specialistTemplateKey: "developer",
        steps: [
          { agentRole: "specialist", agentTemplateKey: "developer", actionType: "run_developer_task" },
        ],
        theme: "Model theme",
        audience: "Small business owners",
        angles: ["Angle one", "Angle two", "Angle three"],
        captions: ["Caption | one\nline", "Caption two", "Caption three"],
        successSignal: "Owner approves one caption",
      },
      ctx,
    );
    expectLoopShape(plan);
    expect(plan.isLiveModel).toBe(true);
    const brief = plan.steps.find((s) => s.produceArtifact?.kind === "weekly-brief");
    expect(brief?.produceArtifact?.content).toMatch(/Model theme/);
    const cal = plan.steps.find((s) => s.actionType === "update_brand_calendar");
    expect(cal?.brandCalendarTask?.captions[0]).toMatch(/Caption/);
    expect(cal?.brandCalendarTask?.captions).toHaveLength(3);
  });

  it("invalid model brief blocks the vault write but still stops at approval", () => {
    const plan = sanitizeOllamaPlanForTest({ steps: [] }, ctx);
    expect(plan.steps.some((s) => s.actionType === "update_brand_calendar")).toBe(false);
    const brief = plan.steps.find((s) => s.produceArtifact?.kind === "weekly-brief");
    expect(brief?.produceArtifact?.content).toMatch(/Blocked/);
    expect(plan.steps.at(-1)?.approvalActionType).toBe("publish_post");
  });

  it("non-AUTIQ projects skip the brand-vault step", async () => {
    const plan = await new DemoPlannerProvider().generateStructuredPlan({
      ...ctx,
      projectSlug: "dreamit",
      projectName: "DreamIT",
    });
    expect(plan.steps.some((s) => s.actionType === "update_brand_calendar")).toBe(false);
    expect(plan.steps.at(-1)?.approvalActionType).toBe("publish_post");
  });
});

describe("brand-aligned weekly brief", () => {
  it("loads AUTIQ brand voice from the allowlisted vault", () => {
    const voice = loadAutiqBrandVoice();
    expect(voice).toBeTruthy();
    expect(voice!).toMatch(/AUTIQ brand voice/i);
    expect(voice!).toMatch(/Do NOT invent customers/i);
  });

  it("loads a ready AUTIQ brand pack (positioning → glossary)", () => {
    const pack = loadAutiqBrandPack();
    expect(pack.ready).toBe(true);
    expect(pack.missing).toEqual([]);
    expect(pack.thin).toEqual([]);
    expect(pack.promptText).toMatch(/Positioning/i);
    expect(pack.promptText).toMatch(/Claims policy/i);
    expect(pack.promptText).toMatch(/Approved examples/i);
    expect(brandPackReadinessSummary(pack)).toMatch(/ready/i);
  });

  it("skips calendar write when brand pack is not ready", () => {
    const brief: WeeklyBrief = {
      theme: "Should not write",
      audience: "Operators",
      angles: ["A", "B", "C"],
      captions: ["a", "b", "c"],
      successSignal: "Owner reviews",
    };
    const steps = buildWeeklyContentLoopSteps(ctx, {
      plannerLabel: "test",
      brief,
      brandPackReady: false,
      brandPackNote: "Brand pack not ready — missing: brand/positioning.md",
    });
    expect(steps.some((s) => s.actionType === "update_brand_calendar")).toBe(false);
    const briefArt = steps.find((s) => s.produceArtifact?.kind === "weekly-brief");
    expect(briefArt?.produceArtifact?.content).toMatch(/Brand pack not ready/i);
    expect(briefArt?.produceArtifact?.content).toMatch(/Blocked/i);
  });

  it("strips hype and emoji spam from caption drafts", () => {
    expect(sanitizeCaptionDraft("🚀 Revolutionary pioneering AUTIQ unveiling the future")).toMatch(
      /AUTIQ/i,
    );
    expect(sanitizeCaptionDraft("🚀 Revolutionary pioneering AUTIQ unveiling the future")).not.toMatch(
      /revolutionary|pioneering|unveiling the future/i,
    );
    expect(sanitizeCaptionDraft("🚀🚀🚀 hello")).toBe("hello");
  });

  it("parseAndSanitizeWeeklyBrief keeps a usable brief after cleanup", () => {
    const brief = parseAndSanitizeWeeklyBrief({
      theme: "Quiet automation for creators",
      audience: "Creator teams with approval bottlenecks",
      angles: ["Human stays in control", "Ops without chaos", "Draft then approve"],
      captions: [
        "🚀 Revolutionary Content Autopilot — pioneering the future!",
        "Keep approvals human while AUTIQ handles the repetitive ops.",
        "One workflow: draft → review → schedule.",
      ],
      successSignal: "Owner approves one caption",
    });
    expect(brief).not.toBeNull();
    expect(brief!.captions[0]).not.toMatch(/revolutionary|pioneering/i);
    expect(captionsForWeeklyChannels(brief!)).toHaveLength(3);
  });
});

describe("weekly analytics next-theme", () => {
  it("proposes a follow-up theme from observed angles without inventing KPIs", () => {
    const brief: WeeklyBrief = {
      theme: "Human approval stays in the loop",
      audience: "Creator ops leads",
      angles: ["Keep control", "Cut repetitive captions", "One draft workflow"],
      captions: ["Cap A", "Cap B", "Cap C"],
      successSignal: "Owner reviews drafts",
    };
    const p = proposeNextWeekTheme(brief);
    expect(p.nextTheme).toMatch(/Follow-up/i);
    expect(p.nextTheme).toMatch(/Cut repetitive captions|Keep control/i);
    expect(p.memoryBlurb).toMatch(/Proposed next theme/);
    expect(p.watchouts.some((w) => /invent/i.test(w))).toBe(true);
  });
});

describe("deterministic calendar writer", () => {
  it("pads to three channel captions when the model returns one", () => {
    const brief: WeeklyBrief = {
      theme: "Quiet automation",
      audience: "Creators",
      angles: ["Behind the scenes", "Time saved", "Control kept"],
      captions: ["Only Instagram line"],
      successSignal: "Owner reviews drafts",
    };
    const caps = captionsForWeeklyChannels(brief);
    expect(caps).toHaveLength(3);
    expect(caps[0]).toBe("Only Instagram line");
    expect(caps[1]).toMatch(/Time saved/); // pads from angles[1]
    expect(caps[2]).toMatch(/Control kept/); // pads from angles[2]
  });

  it("updates exactly Instagram, LinkedIn and Facebook idea cells", () => {
    const src = `# AUTIQ content calendar

| Week | Channel | Idea | Status |
|---|---|---|---|
| TBD | Instagram | old ig | draft |
| TBD | LinkedIn | old li | draft |
| TBD | Facebook | old fb | draft |
| TBD | Twitter | leave me | draft |
`;
    const { markdown, updatedChannels } = applyWeeklyCalendarCaptions(
      src,
      ["IG caption", "LI caption", "FB caption"],
      "2026-10-14",
    );
    expect(updatedChannels).toEqual(["Instagram", "LinkedIn", "Facebook"]);
    expect(markdown).toMatch(/\| 2026-10-14 \| Instagram \| IG caption \| draft \|/);
    expect(markdown).toMatch(/\| 2026-10-14 \| LinkedIn \| LI caption \| draft \|/);
    expect(markdown).toMatch(/\| 2026-10-14 \| Facebook \| FB caption \| draft \|/);
    expect(markdown).toMatch(/\| TBD \| Twitter \| leave me \| draft \|/);
  });

  it("writes all three rows into the allowlisted AUTIQ calendar file", () => {
    const calendarPath = path.join(process.cwd(), "workspaces", "autiq", "content", "calendar.md");
    const before = fs.readFileSync(calendarPath, "utf8");
    try {
      const brief: WeeklyBrief = {
        theme: "Test theme",
        audience: "Test audience",
        angles: ["A1", "A2", "A3"],
        captions: ["Cap IG", "Cap LI", "Cap FB"],
        successSignal: "tests pass",
      };
      const result = writeAutiqWeeklyCalendar(brief);
      expect(result.updatedChannels).toEqual(["Instagram", "LinkedIn", "Facebook"]);
      const after = fs.readFileSync(calendarPath, "utf8");
      expect(after).toMatch(/\| Cap IG \| draft \|/);
      expect(after).toMatch(/\| Cap LI \| draft \|/);
      expect(after).toMatch(/\| Cap FB \| draft \|/);
      expect(result.evidenceMarkdown).toMatch(/deterministic-calendar-writer/);
    } finally {
      fs.writeFileSync(calendarPath, before, "utf8");
    }
  });
});

describe("AUTIQ weekly loop schedule template", () => {
  it("is a valid weekly bounded schedule", () => {
    expect(ScheduleRuleSchema.parse(AUTIQ_WEEKLY_LOOP_RULE)).toBe("every_168h");
    expect(ScheduleActionTemplateSchema.parse(AUTIQ_WEEKLY_LOOP_TEMPLATE).origin).toBe("operational");
    const from = new Date("2026-10-14T09:00:00.000Z");
    expect(computeNextRunAt(AUTIQ_WEEKLY_LOOP_RULE, from)?.toISOString()).toBe(
      "2026-10-21T09:00:00.000Z",
    );
  });
});
