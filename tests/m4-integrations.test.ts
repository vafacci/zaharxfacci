import { describe, expect, it } from "vitest";
import { checkImageStudioHealth } from "@/tools/image-studio-adapter";
import { checkPostizHealth, PostizAdapter } from "@/tools/postiz-adapter";
import { checkN8nHealth, N8nAdapter } from "@/tools/n8n-adapter";
import { gateExternalAction } from "@/tools/policy";
import { sanitizeOllamaPlanForTest } from "@/providers/ollama-provider";
import { DemoPlannerProvider } from "@/providers/demo-planner";
import { StructuredPlanSchema } from "@/domain/schemas";

const AUTIQ = [
  "social",
  "image",
  "developer",
  "marketing",
  "automation",
  "analytics",
  "security-qa",
];

describe("M4 integration health (live probes, honest status)", () => {
  it("probes Image Studio readiness without inventing success", async () => {
    const h = await checkImageStudioHealth();
    expect(h.baseUrl).toMatch(/127\.0\.0\.1:3000|localhost:3000/);
    expect(typeof h.available).toBe("boolean");
    expect(typeof h.connected).toBe("boolean");
    expect(h.details.length).toBeGreaterThan(5);
    // If studio is up in this environment, Comfy connection should be reported truthfully
    if (h.available && h.connected) {
      expect(h.checkpoints.length).toBeGreaterThan(0);
    }
  }, 20_000);

  it("reports Postiz as not configured when env missing", async () => {
    const prevUrl = process.env.POSTIZ_BASE_URL;
    const prevKey = process.env.POSTIZ_API_KEY;
    delete process.env.POSTIZ_BASE_URL;
    delete process.env.POSTIZ_API_KEY;
    const { resetIntegrationsConfigCache } = await import("@/tools/integrations-config");
    resetIntegrationsConfigCache();
    const h = await checkPostizHealth();
    expect(h.configured).toBe(false);
    expect(h.details).toMatch(/not configured/i);
    if (prevUrl) process.env.POSTIZ_BASE_URL = prevUrl;
    if (prevKey) process.env.POSTIZ_API_KEY = prevKey;
    resetIntegrationsConfigCache();
  });

  it("probes n8n instance without claiming API auth when key missing", async () => {
    const prev = process.env.N8N_API_KEY;
    delete process.env.N8N_API_KEY;
    const { resetIntegrationsConfigCache } = await import("@/tools/integrations-config");
    resetIntegrationsConfigCache();
    const h = await checkN8nHealth();
    expect(h.apiConfigured).toBe(false);
    expect(h.apiAuthorized).toBe(false);
    expect(h.details.length).toBeGreaterThan(5);
    if (prev) process.env.N8N_API_KEY = prev;
    resetIntegrationsConfigCache();
  }, 15_000);

  it("stages local social draft without claiming Postiz success", async () => {
    const adapter = new PostizAdapter();
    const result = await adapter.stageDraft(
      {
        toolId: "postiz",
        action: "stage_draft",
        projectId: "p1",
        agentId: "a1",
        taskId: "t1",
        input: {
          caption: "Test caption for M4 staging",
          channel: "instagram",
          title: "M4 staging",
          attemptPostizDraft: true,
        },
        idempotencyKey: "test-social-1",
      },
      "autiq",
    );
    expect(result.stagedLocally).toBe(true);
    expect(result.postizDraftCreated).toBe(false);
    expect(result.localStagingRef).toMatch(/social-staging/);
    expect(result.evidenceMarkdown).toMatch(/No Postiz draft claimed|Postiz not configured/i);
  });

  it("n8n prepare never live-executes", async () => {
    const adapter = new N8nAdapter();
    const result = await adapter.prepare({
      toolId: "n8n",
      action: "prepare",
      projectId: "p1",
      agentId: "a1",
      taskId: "t1",
      input: { dryRun: true, liveExecute: true, notes: "should refuse" },
      idempotencyKey: "test-n8n-1",
    });
    expect(result.liveExecuted).toBe(false);
    expect(result.dryRun).toBe(true);
  }, 15_000);

  it("blocks schedule/publish style actions in policy", () => {
    expect(gateExternalAction("publish_post").allowed).toBe(false);
    expect(gateExternalAction("schedule_post").allowed).toBe(false);
    expect(gateExternalAction("postiz_now").allowed).toBe(false);
    expect(gateExternalAction("n8n_live_trigger").allowed).toBe(false);
  });
});

describe("M4 planner wiring", () => {
  it("sanitizer builds image+social pipeline for content calendar tasks", () => {
    const plan = sanitizeOllamaPlanForTest(
      {
        specialistTemplateKey: "marketing",
        reasoningSummary: "content ideas",
        steps: [
          {
            sequence: 1,
            agentRole: "ceo",
            agentTemplateKey: "ceo",
            actionType: "receive_owner_request",
            summary: "recv",
          },
        ],
      },
      {
        projectSlug: "autiq",
        projectName: "AUTIQ",
        title: "Weekly content pipeline draft",
        objective:
          "Create image and caption for Instagram content calendar; stage social draft; do not publish.",
        availableSpecialists: AUTIQ,
      },
    );
    expect(plan.steps.some((s) => s.actionType === "run_image_studio_task")).toBe(true);
    expect(plan.steps.some((s) => s.actionType === "stage_social_draft")).toBe(true);
    expect(plan.steps.every((s) => !s.requiresApproval)).toBe(true);
    expect(() => StructuredPlanSchema.parse(plan)).not.toThrow();
  });

  it("repairs model stage_social_draft steps missing socialDraft payload", () => {
    const plan = sanitizeOllamaPlanForTest(
      {
        specialistTemplateKey: "social",
        steps: [
          {
            sequence: 1,
            agentRole: "ceo",
            agentTemplateKey: "ceo",
            actionType: "receive_owner_request",
            summary: "recv",
          },
          {
            sequence: 2,
            agentRole: "specialist",
            agentTemplateKey: "image",
            actionType: "run_image_studio_task",
            summary: "gen image",
            // missing imageStudioTask on purpose
          },
          {
            sequence: 3,
            agentRole: "specialist",
            agentTemplateKey: "social",
            actionType: "stage_social_draft",
            summary: "stage caption",
            // missing socialDraft on purpose
          },
        ],
      },
      {
        projectSlug: "autiq",
        projectName: "AUTIQ",
        title: "Instagram content draft with AI image",
        objective:
          "Create image and caption for Instagram content calendar; do not publish.",
        availableSpecialists: AUTIQ,
      },
    );
    const img = plan.steps.find((s) => s.actionType === "run_image_studio_task");
    const social = plan.steps.find((s) => s.actionType === "stage_social_draft");
    expect(img?.imageStudioTask?.prompt).toBeTruthy();
    expect(social?.socialDraft?.caption).toBeTruthy();
    expect(() => StructuredPlanSchema.parse(plan)).not.toThrow();
  });

  it("demo planner content pipeline includes Image Studio step", async () => {
    const demo = new DemoPlannerProvider();
    const plan = await demo.generateStructuredPlan({
      projectSlug: "autiq",
      projectName: "AUTIQ",
      title: "Campaign draft with image and caption",
      objective: "Prepare social draft and content calendar for AUTIQ",
      availableSpecialists: AUTIQ,
    });
    expect(plan.steps.some((s) => s.actionType === "run_image_studio_task")).toBe(true);
    expect(plan.steps.some((s) => s.actionType === "stage_social_draft")).toBe(true);
  });
});
