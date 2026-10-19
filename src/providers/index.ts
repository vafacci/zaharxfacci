import { DemoPlannerProvider } from "@/providers/demo-planner";
import { OllamaProvider } from "@/providers/ollama-provider";
import type { ModelProvider } from "@/providers/types";

export type { ModelProvider, PlanContext } from "@/providers/types";
export { DemoPlannerProvider } from "@/providers/demo-planner";
export { OllamaProvider } from "@/providers/ollama-provider";

/**
 * FACCI_PLANNER=ollama|demo|auto (default auto)
 * auto = Ollama when healthy, otherwise honest failure at plan time (worker blocks/fails).
 * demo = deterministic only (tests / offline). Never silently pretend demo is live AI.
 */
export function getActivePlanner(): ModelProvider {
  const mode = (process.env.FACCI_PLANNER ?? "auto").toLowerCase();
  if (mode === "demo") return new DemoPlannerProvider();
  if (mode === "ollama") return new OllamaProvider();
  // auto: prefer live Ollama; health checked at plan time
  return new OllamaProvider();
}

export function getPlannerMode(): string {
  return (process.env.FACCI_PLANNER ?? "auto").toLowerCase();
}
