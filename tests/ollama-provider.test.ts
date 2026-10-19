import { describe, expect, it } from "vitest";
import { OllamaProvider } from "@/providers/ollama-provider";
import { StructuredPlanSchema } from "@/domain/schemas";

const runLive = process.env.FACCI_LIVE_OLLAMA_TEST === "1";

describe("ollama provider health", () => {
  it("reports health without throwing", async () => {
    const provider = new OllamaProvider();
    const health = await provider.checkHealth();
    expect(typeof health.healthy).toBe("boolean");
    expect(health.details || health.modelId).toBeTruthy();
  });
});

describe.runIf(runLive)("ollama live structured planning", () => {
  it(
    "produces a validated plan for a simple AUTIQ draft task",
    async () => {
      const provider = new OllamaProvider();
      const health = await provider.checkHealth();
      expect(health.healthy).toBe(true);

      const plan = await provider.generateStructuredPlan({
        projectSlug: "autiq",
        projectName: "AUTIQ",
        projectMission: "Content business",
        title: "Draft 3 content ideas",
        objective: "Write three short content ideas for AUTIQ this week",
        availableSpecialists: [
          "social",
          "image",
          "developer",
          "marketing",
          "automation",
          "analytics",
          "security-qa",
        ],
        projectMemories: [
          { category: "brand", content: "AUTIQ focuses on practical AI automation." },
        ],
      });

      expect(plan.isLiveModel).toBe(true);
      expect(plan.plannerId).toBe("ollama");
      expect(plan.projectSlug).toBe("autiq");
      expect(() => StructuredPlanSchema.parse(plan)).not.toThrow();
      expect(plan.steps.length).toBeGreaterThanOrEqual(2);
      expect(plan.modelId).toBeTruthy();
      expect(plan.latencyMs).toBeGreaterThan(0);
    },
    180_000,
  );
});
