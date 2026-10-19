import { describe, expect, it } from "vitest";
import {
  buildDreamitResearchLoopSteps,
  buildGrupviUxLoopSteps,
  DREAMIT_RESEARCH_LOOP_TEMPLATE,
  GRUPVI_UX_LOOP_TEMPLATE,
  isDreamitResearchLoop,
  isGrupviUxLoop,
} from "@/domain/project-loops";
import { classifyOwnerIntent, resolveSpecialistTemplateKey } from "@/domain/routing";
import { sanitizeOllamaPlanForTest } from "@/providers/ollama-provider";
import { DemoPlannerProvider } from "@/providers/demo-planner";
import type { PlanContext } from "@/providers/types";

const GRUPVI_TEAM = ["ux-design", "qa", "developer", "research"];
const DREAMIT_TEAM = ["research", "qa", "analytics", "developer"];

describe("project-loops markers", () => {
  it("detects Grupvi UX loop and DreamIT research loop", () => {
    expect(
      isGrupviUxLoop(GRUPVI_UX_LOOP_TEMPLATE.title, GRUPVI_UX_LOOP_TEMPLATE.objective),
    ).toBe(true);
    expect(
      isDreamitResearchLoop(
        DREAMIT_RESEARCH_LOOP_TEMPLATE.title,
        DREAMIT_RESEARCH_LOOP_TEMPLATE.objective,
      ),
    ).toBe(true);
    expect(isGrupviUxLoop("chat", "fix bug in app")).toBe(false);
  });

  it("routes intents to UX / research specialists", () => {
    const g = classifyOwnerIntent(
      GRUPVI_UX_LOOP_TEMPLATE.title,
      GRUPVI_UX_LOOP_TEMPLATE.objective,
    );
    expect(g.wantsGrupviUxLoop).toBe(true);
    expect(g.wantsCoding).toBe(false);
    expect(resolveSpecialistTemplateKey(g, GRUPVI_TEAM, "marketing")).toBe("ux-design");

    const d = classifyOwnerIntent(
      DREAMIT_RESEARCH_LOOP_TEMPLATE.title,
      DREAMIT_RESEARCH_LOOP_TEMPLATE.objective,
    );
    expect(d.wantsDreamitResearchLoop).toBe(true);
    expect(resolveSpecialistTemplateKey(d, DREAMIT_TEAM, "marketing")).toBe("research");
  });
});

describe("project-loops plan shape", () => {
  it("builds Grupvi steps with vault append", () => {
    const ctx: PlanContext = {
      projectSlug: "grupvi",
      projectName: "Grupvi",
      projectMission: "Group study",
      title: GRUPVI_UX_LOOP_TEMPLATE.title,
      objective: GRUPVI_UX_LOOP_TEMPLATE.objective,
      availableSpecialists: GRUPVI_TEAM,
    };
    const steps = buildGrupviUxLoopSteps(ctx, { plannerLabel: "test" });
    const actions = steps.map((s) => s.actionType);
    expect(actions).toContain("write_local_artifact");
    expect(actions).toContain("append_allowlisted_note");
    expect(actions).toContain("verify_artifact");
    expect(actions).not.toContain("request_publish_post");
    expect(actions).not.toContain("run_developer_task");
    const append = steps.find((s) => s.actionType === "append_allowlisted_note");
    expect(append?.appendAllowlistedNote?.workspaceId).toBe("grupvi");
    expect(append?.appendAllowlistedNote?.relativePath).toBe("product/ux-notes.md");
  });

  it("builds DreamIT steps with vault append", () => {
    const ctx: PlanContext = {
      projectSlug: "dreamit",
      projectName: "DreamIT",
      title: DREAMIT_RESEARCH_LOOP_TEMPLATE.title,
      objective: DREAMIT_RESEARCH_LOOP_TEMPLATE.objective,
      availableSpecialists: DREAMIT_TEAM,
    };
    const steps = buildDreamitResearchLoopSteps(ctx, { plannerLabel: "test" });
    expect(steps.some((s) => s.actionType === "append_allowlisted_note")).toBe(true);
    expect(steps.some((s) => s.actionType === "request_publish_post")).toBe(false);
  });

  it("sanitize + demo planner honor Grupvi loop without GPU brief", async () => {
    const ctx: PlanContext = {
      projectSlug: "grupvi",
      projectName: "Grupvi",
      title: GRUPVI_UX_LOOP_TEMPLATE.title,
      objective: GRUPVI_UX_LOOP_TEMPLATE.objective,
      availableSpecialists: GRUPVI_TEAM,
    };
    const plan = sanitizeOllamaPlanForTest(
      { specialistTemplateKey: "ux-design", steps: [] },
      ctx,
    );
    expect(plan.steps.some((s) => s.actionType === "append_allowlisted_note")).toBe(true);
    expect(plan.specialistTemplateKey).toBe("ux-design");

    const demo = await new DemoPlannerProvider().generateStructuredPlan(ctx);
    expect(demo.steps.some((s) => s.produceArtifact?.kind === "ux-review")).toBe(true);
  });
});
