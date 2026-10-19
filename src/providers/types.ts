import type { StructuredPlan } from "@/domain/schemas";

export type PlanContext = {
  projectSlug: string;
  projectName: string;
  projectMission?: string | null;
  title: string;
  objective: string;
  /** Project-local specialist template keys only */
  availableSpecialists: string[];
  /** Project-scoped memory snippets (never cross-project) */
  projectMemories?: { category: string; content: string }[];
};

export interface ModelProvider {
  id: string;
  label: string;
  isLiveModel: boolean;
  checkHealth(): Promise<{
    healthy: boolean;
    details?: string;
    modelId?: string;
    models?: string[];
    gpuGuard?: string;
  }>;
  listModels?(): Promise<string[]>;
  generateStructuredPlan(input: PlanContext): Promise<StructuredPlan>;
}
