import { describe, expect, it } from "vitest";
import {
  classifyOwnerIntent,
  resolveSpecialistTemplateKey,
  reasoningForIntent,
} from "@/domain/routing";
import { buildSpecialistReport, specialistReportKind } from "@/domain/specialist-reports";
import {
  computeNextRunAt,
  ScheduleRuleSchema,
  scheduleFireIdempotencyKey,
} from "@/domain/schedules";
import { DemoPlannerProvider } from "@/providers/demo-planner";
import { StructuredPlanSchema } from "@/domain/schemas";

const GRUPVI = ["developer", "ux-design", "qa", "research"];
const DREAMIT = ["developer", "design", "marketing", "research"];

describe("M5 specialist routing", () => {
  it("routes Grupvi UX to ux-design", () => {
    const intent = classifyOwnerIntent(
      "Improve Grupvi chat UX",
      "UX review of usability and user experience for the chat screen",
    );
    expect(intent.wantsUx).toBe(true);
    expect(resolveSpecialistTemplateKey(intent, GRUPVI, "developer")).toBe("ux-design");
    expect(reasoningForIntent(intent, "ux-design")).toMatch(/UX/i);
  });

  it("routes QA checklist to qa", () => {
    const intent = classifyOwnerIntent(
      "QA review for release",
      "Write a regression checklist and acceptance criteria for the next build",
    );
    expect(intent.wantsQa).toBe(true);
    expect(resolveSpecialistTemplateKey(intent, GRUPVI, "research")).toBe("qa");
  });

  it("routes DreamIT research to research", () => {
    const intent = classifyOwnerIntent(
      "Find problems we should fix in DreamIT",
      "Investigate and research candidate product problems",
    );
    expect(intent.wantsResearch).toBe(true);
    expect(resolveSpecialistTemplateKey(intent, DREAMIT, "marketing")).toBe("research");
  });

  it("routes analytics intents to analytics when available", () => {
    const specialists = ["analytics", "marketing", "research"];
    const intent = classifyOwnerIntent(
      "Project metrics review",
      "Produce an analytics snapshot of KPIs and internal metrics",
    );
    expect(intent.wantsAnalytics).toBe(true);
    expect(resolveSpecialistTemplateKey(intent, specialists, "marketing")).toBe("analytics");
  });
});

describe("M5 specialist reports", () => {
  it("builds UX report with provenance table", () => {
    const report = buildSpecialistReport({
      projectName: "StudieChat / Grupvi",
      projectSlug: "grupvi",
      title: "Improve chat UX",
      objective: "Review clarity",
      templateKey: "ux-design",
      projectMission: "Group study/chat application",
    });
    expect(specialistReportKind("ux-design")).toBe("ux-review");
    expect(report.kind).toBe("ux-review");
    expect(report.content).toMatch(/Provenance/i);
    expect(report.content).toMatch(/\*\*blocked\*\*/i);
    expect(report.content).toMatch(/Group study\/chat application/);
    expect(report.content).not.toMatch(/invented NPS|fake users/i);
  });

  it("marks mission blocked when not supplied", () => {
    const report = buildSpecialistReport({
      projectName: "DreamIT",
      projectSlug: "dreamit",
      title: "Research",
      objective: "Investigate",
      templateKey: "research",
    });
    expect(report.content).toMatch(/Project mission[\s\S]*\*\*blocked\*\*/i);
  });

  it("demo planner emits research-brief for DreamIT", async () => {
    const demo = new DemoPlannerProvider();
    const plan = await demo.generateStructuredPlan({
      projectSlug: "dreamit",
      projectName: "DreamIT",
      title: "Find problems we should fix in DreamIT",
      objective: "Investigate and research candidate product problems with verified sources",
      availableSpecialists: DREAMIT,
    });
    expect(plan.specialistTemplateKey).toBe("research");
    const art = plan.steps.find((s) => s.produceArtifact)?.produceArtifact;
    expect(art?.kind).toBe("research-brief");
    expect(art?.content).toMatch(/Verified sources/i);
    expect(() => StructuredPlanSchema.parse(plan)).not.toThrow();
  });
});

describe("M5 schedule rules", () => {
  it("parses every_Nm and daily rules", () => {
    expect(ScheduleRuleSchema.parse("every_15m")).toBe("every_15m");
    expect(ScheduleRuleSchema.parse("every_2h")).toBe("every_2h");
    expect(ScheduleRuleSchema.parse("daily_09:30")).toBe("daily_09:30");
  });

  it("computes next run in the future", () => {
    const from = new Date("2026-10-12T10:00:00.000Z");
    const nextHour = computeNextRunAt("every_1h", from);
    expect(nextHour?.getTime()).toBe(from.getTime() + 3_600_000);

    const daily = computeNextRunAt("daily_09:00", new Date("2026-10-12T10:00:00"));
    expect(daily).not.toBeNull();
    expect(daily!.getTime()).toBeGreaterThan(new Date("2026-10-12T10:00:00").getTime());
  });

  it("uses due-slot idempotency keys (not hour buckets)", () => {
    const due = new Date("2026-10-12T10:15:00.000Z");
    const key = scheduleFireIdempotencyKey("sched1", due);
    expect(key).toBe("schedule-sched1-2026-10-12T10:15:00.000Z");
    expect(key).not.toMatch(/T10$/);
  });
});

describe("skipped live tests (documentation)", () => {
  it("documents opt-in gates for the two default-skipped suites", () => {
    // ollama-provider.test.ts: describe.runIf(FACCI_LIVE_OLLAMA_TEST === "1")
    // developer-adapter.test.ts: describe.runIf(FACCI_LIVE_DEV_TEST === "1")
    expect(process.env.FACCI_LIVE_OLLAMA_TEST === "1").toBe(
      process.env.FACCI_LIVE_OLLAMA_TEST === "1",
    );
    const reasons = {
      ollamaLive:
        "Skipped unless FACCI_LIVE_OLLAMA_TEST=1 — requires local Ollama + GPU/CPU time; flaky in default runs.",
      developerLive:
        "Skipped unless FACCI_LIVE_DEV_TEST=1 — mutates toy-counter workspace and may invoke OpenCode (long).",
    };
    expect(reasons.ollamaLive).toMatch(/FACCI_LIVE_OLLAMA_TEST/);
    expect(reasons.developerLive).toMatch(/FACCI_LIVE_DEV_TEST/);
  });
});
