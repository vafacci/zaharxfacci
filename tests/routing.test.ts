import { describe, expect, it } from "vitest";
import {
  classifyOwnerIntent,
  resolveSpecialistTemplateKey,
  resolveTaskOrigin,
  reasoningForIntent,
} from "@/domain/routing";
import { sanitizeOllamaPlanForTest } from "@/providers/ollama-provider";
import { DemoPlannerProvider } from "@/providers/demo-planner";
import { StructuredPlanSchema } from "@/domain/schemas";

const AUTIQ_SPECIALISTS = [
  "social",
  "image",
  "developer",
  "marketing",
  "automation",
  "analytics",
  "security-qa",
];

describe("deterministic specialist routing", () => {
  it("routes merge/push to developer, not marketing", () => {
    const intent = classifyOwnerIntent(
      "Merge toy-counter fix to main",
      "Merge the toy-counter changes into main and push to remote.",
    );
    expect(intent.wantsExternal).toBe(true);
    expect(intent.wantsMerge).toBe(true);
    expect(intent.wantsPublish).toBe(false);
    const specialist = resolveSpecialistTemplateKey(intent, AUTIQ_SPECIALISTS, "marketing");
    expect(specialist).toBe("developer");
    expect(reasoningForIntent(intent, specialist)).toMatch(/approval/i);
  });

  it("routes publish to marketing/social", () => {
    const intent = classifyOwnerIntent(
      "Publish social post now",
      "Publish this caption to Instagram immediately",
    );
    expect(intent.wantsPublish).toBe(true);
    expect(resolveSpecialistTemplateKey(intent, AUTIQ_SPECIALISTS, "developer")).toBe(
      "marketing",
    );
  });

  it("routes coding fixes to developer", () => {
    const intent = classifyOwnerIntent(
      "Fix toy-counter add bug",
      "In the allowlisted toy-counter workspace, fix src/counter.js so add(a,b) returns a+b.",
    );
    expect(intent.wantsCoding).toBe(true);
    expect(intent.wantsExternal).toBe(false);
    expect(resolveSpecialistTemplateKey(intent, AUTIQ_SPECIALISTS, "marketing")).toBe(
      "developer",
    );
  });

  it("routes research intents to research when available", () => {
    const specialists = ["research", "marketing", "developer"];
    const intent = classifyOwnerIntent(
      "Research competitors",
      "Investigate and research three competitor approaches",
    );
    expect(intent.wantsResearch).toBe(true);
    expect(resolveSpecialistTemplateKey(intent, specialists, "marketing")).toBe("research");
  });

  it("sanitizer overrides wrong LLM marketing specialist on merge plans", () => {
    const plan = sanitizeOllamaPlanForTest(
      {
        specialistTemplateKey: "marketing",
        reasoningSummary: "Marketing specialist is best suited for drafting content ideas as markdown.",
        steps: [
          {
            sequence: 1,
            agentRole: "ceo",
            agentTemplateKey: "ceo",
            actionType: "receive_owner_request",
            summary: "Receive merge request",
          },
          {
            sequence: 2,
            agentRole: "specialist",
            agentTemplateKey: "marketing",
            actionType: "write_local_artifact",
            summary: "Draft ideas",
            produceArtifact: {
              kind: "markdown",
              title: "ideas",
              filename: "ideas.md",
              content: "ideas",
            },
          },
        ],
      },
      {
        projectSlug: "autiq",
        projectName: "AUTIQ",
        title: "Merge toy-counter fix to main",
        objective: "Merge the toy-counter changes into main and push to remote.",
        availableSpecialists: AUTIQ_SPECIALISTS,
      },
    );
    expect(plan.specialistTemplateKey).toBe("developer");
    expect(plan.reasoningSummary).not.toMatch(/content ideas/i);
    expect(plan.steps.some((s) => s.requiresApproval && s.approvalActionType === "merge_code")).toBe(
      true,
    );
    expect(plan.steps.every((s) => s.actionType !== "run_developer_task")).toBe(true);
    expect(plan.steps.every((s) => !s.produceArtifact)).toBe(true);
    expect(() => StructuredPlanSchema.parse(plan)).not.toThrow();
  });

  it("sanitizer puts run_developer_task before verify on coding plans", () => {
    const plan = sanitizeOllamaPlanForTest(
      {
        specialistTemplateKey: "developer",
        reasoningSummary: "coding",
        steps: [
          {
            sequence: 1,
            agentRole: "ceo",
            agentTemplateKey: "ceo",
            actionType: "receive_owner_request",
            summary: "Receive",
          },
          {
            sequence: 2,
            agentRole: "manager",
            agentTemplateKey: "manager",
            actionType: "delegate_to_specialist",
            summary: "Delegate",
          },
          {
            sequence: 3,
            agentRole: "specialist",
            agentTemplateKey: "developer",
            actionType: "write_local_artifact",
            summary: "Draft note",
            produceArtifact: {
              kind: "markdown",
              title: "note",
              filename: "note.md",
              content: "note",
            },
          },
          {
            sequence: 4,
            agentRole: "specialist",
            agentTemplateKey: "developer",
            actionType: "verify_artifact",
            summary: "Verify early",
          },
        ],
      },
      {
        projectSlug: "autiq",
        projectName: "AUTIQ",
        title: "AUTIQ website (allowlisted)",
        objective:
          "Append FACCI note to docs/PRODUCT.md in autiq-web. Do not touch .env.",
        availableSpecialists: AUTIQ_SPECIALISTS,
      },
    );
    const types = plan.steps.map((s) => s.actionType);
    expect(types).toContain("run_developer_task");
    expect(types.indexOf("run_developer_task")).toBeLessThan(
      types.includes("verify_artifact")
        ? types.indexOf("verify_artifact")
        : Number.POSITIVE_INFINITY,
    );
    expect(types).not.toContain("write_local_artifact");
    expect(plan.steps.find((s) => s.actionType === "run_developer_task")?.developerTask?.workspaceId).toBe(
      "autiq-web",
    );
  });

  it("demo planner merge uses merge_code approval with developer", async () => {
    const demo = new DemoPlannerProvider();
    const plan = await demo.generateStructuredPlan({
      projectSlug: "autiq",
      projectName: "AUTIQ",
      title: "Merge toy-counter fix to main",
      objective: "Merge and push to remote.",
      availableSpecialists: AUTIQ_SPECIALISTS,
    });
    expect(plan.specialistTemplateKey).toBe("developer");
    expect(plan.steps.some((s) => s.approvalActionType === "merge_code")).toBe(true);
  });
});

describe("task origin classification", () => {
  it("marks m3 idempotency keys as validation", () => {
    expect(
      resolveTaskOrigin({
        idempotencyKey: "m3-dev-20261012",
        title: "Fix toy-counter add bug",
      }),
    ).toBe("validation");
  });

  it("keeps normal UI tasks operational", () => {
    expect(
      resolveTaskOrigin({
        idempotencyKey: "ui-cmv123-Draft 3 content ideas-123",
        title: "Draft 3 content ideas",
      }),
    ).toBe("operational");
  });

  it("respects explicit operational over matching title", () => {
    expect(
      resolveTaskOrigin({
        explicitOrigin: "operational",
        title: "Merge toy-counter fix to main",
      }),
    ).toBe("operational");
  });

  it("classifies known harness titles without key", () => {
    expect(resolveTaskOrigin({ title: "Fix toy-counter add bug" })).toBe("validation");
  });
});
