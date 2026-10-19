import { describe, expect, it } from "vitest";
import {
  assertProjectScope,
  gateExternalAction,
  hashPayload,
} from "@/tools/policy";
import { DemoPlannerProvider } from "@/providers/demo-planner";
import { StructuredPlanSchema } from "@/domain/schemas";

describe("policy gate", () => {
  it("blocks publish_post from executing", () => {
    const gate = gateExternalAction("publish_post");
    expect(gate.allowed).toBe(false);
    expect(gate.requiresApproval).toBe(true);
  });

  it("allows local draft writes", () => {
    const gate = gateExternalAction("write_local_artifact");
    expect(gate.allowed).toBe(true);
  });

  it("enforces project isolation", () => {
    expect(() => assertProjectScope("a", "b")).toThrow(/isolation/i);
  });

  it("invalidates changed approval payloads via hash", () => {
    const h1 = hashPayload({ action: "publish_post", text: "a" });
    const h2 = hashPayload({ action: "publish_post", text: "b" });
    expect(h1).not.toEqual(h2);
  });
});

describe("demo planner", () => {
  it("labels itself as non-LLM and drafts content for AUTIQ", async () => {
    const planner = new DemoPlannerProvider();
    expect(planner.isLiveModel).toBe(false);
    const plan = await planner.generateStructuredPlan({
      projectSlug: "autiq",
      projectName: "AUTIQ",
      title: "Draft 3 content ideas",
      objective: "Draft a content outline for AUTIQ",
      availableSpecialists: [
        "social",
        "image",
        "developer",
        "marketing",
        "automation",
        "analytics",
        "security-qa",
      ],
    });
    expect(plan.labeledAs).toContain("Demo Planner");
    expect(plan.isLiveModel).toBe(false);
    expect(plan.specialistTemplateKey).toBe("marketing");
    expect(plan.steps.some((s) => s.produceArtifact)).toBe(true);
    expect(() => StructuredPlanSchema.parse(plan)).not.toThrow();
  });

  it("routes publish requests to approval", async () => {
    const planner = new DemoPlannerProvider();
    const plan = await planner.generateStructuredPlan({
      projectSlug: "autiq",
      projectName: "AUTIQ",
      title: "Publish social post",
      objective: "Publish this caption now",
      availableSpecialists: ["social", "marketing"],
    });
    expect(plan.steps.some((s) => s.requiresApproval)).toBe(true);
  });
});

describe("structured plan schema", () => {
  it("rejects plans with no evidence path", () => {
    expect(() =>
      StructuredPlanSchema.parse({
        plannerId: "x",
        labeledAs: "x",
        isLiveModel: true,
        projectSlug: "autiq",
        specialistTemplateKey: "marketing",
        planningOnly: false,
        steps: [
          {
            sequence: 1,
            agentRole: "ceo",
            agentTemplateKey: "ceo",
            actionType: "receive_owner_request",
            summary: "only talk",
            requiresApproval: false,
          },
        ],
      }),
    ).toThrow();
  });
});
