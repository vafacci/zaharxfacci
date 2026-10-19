import { StructuredPlanSchema, type StructuredPlan } from "@/domain/schemas";
import {
  classifyOwnerIntent,
  resolveSpecialistTemplateKey,
  reasoningForIntent,
} from "@/domain/routing";
import { buildSpecialistReport } from "@/domain/specialist-reports";
import { buildWeeklyContentLoopSteps } from "@/domain/content-loop";
import {
  buildDreamitResearchLoopSteps,
  buildGrupviUxLoopSteps,
} from "@/domain/project-loops";
import {
  brandPackReadinessSummary,
  loadAutiqBrandPack,
} from "@/tools/autiq-brand";
import type { ModelProvider, PlanContext } from "@/providers/types";
import { pickDeveloperWorkspaceId } from "@/tools/workspace-routing";

function draftContent(projectName: string, title: string, objective: string): string {
  return `# ${title}

> Genereret af **Demo Planner** (deterministisk — ikke en live LLM).
> Projekt: ${projectName}

## Mål
${objective}

## Tre indholdsideer
1. **Problem → løsning**
2. **Behind the scenes**
3. **Evidence-first**

---
_FACCI Demo Planner artefakt (fallback / tests only)_
`;
}

function specialistArtifact(
  input: PlanContext,
  templateKey: string,
): { kind: string; title: string; filename: string; content: string } {
  return buildSpecialistReport({
    projectName: input.projectName,
    projectSlug: input.projectSlug,
    title: input.title,
    objective: input.objective,
    templateKey,
    projectMission: input.projectMission ?? null,
    plannerLabel: "Demo Planner (deterministic — not a live LLM)",
  });
}

/**
 * Deterministic planner retained for unit tests and explicit FACCI_PLANNER=demo.
 * Must never be presented as a live model.
 */
export class DemoPlannerProvider implements ModelProvider {
  id = "demo-planner";
  label = "Demo Planner (deterministic — not a live LLM)";
  isLiveModel = false;

  async checkHealth() {
    return {
      healthy: true,
      details: "Deterministic local planner ready (no model inference).",
    };
  }

  async generateStructuredPlan(input: PlanContext): Promise<StructuredPlan> {
    const intent = classifyOwnerIntent(input.title, input.objective);
    const specialist = resolveSpecialistTemplateKey(
      intent,
      input.availableSpecialists,
      input.availableSpecialists[0] ?? "developer",
    );

    if (intent.wantsGrupviUxLoop) {
      return StructuredPlanSchema.parse({
        plannerId: "demo-planner",
        labeledAs: this.label,
        isLiveModel: false,
        projectSlug: input.projectSlug,
        specialistTemplateKey: specialist,
        reasoningSummary: reasoningForIntent(intent, specialist),
        steps: buildGrupviUxLoopSteps(input, { plannerLabel: this.label }),
        planningOnly: false,
      });
    }

    if (intent.wantsDreamitResearchLoop) {
      return StructuredPlanSchema.parse({
        plannerId: "demo-planner",
        labeledAs: this.label,
        isLiveModel: false,
        projectSlug: input.projectSlug,
        specialistTemplateKey: specialist,
        reasoningSummary: reasoningForIntent(intent, specialist),
        steps: buildDreamitResearchLoopSteps(input, { plannerLabel: this.label }),
        planningOnly: false,
      });
    }

    if (intent.wantsWeeklyContentLoop) {
      const pack =
        input.projectSlug === "autiq" ? loadAutiqBrandPack() : null;
      const brandPackReady = pack ? pack.ready : true;
      const brandPackNote = pack ? brandPackReadinessSummary(pack) : null;
      return StructuredPlanSchema.parse({
        plannerId: "demo-planner",
        labeledAs: this.label,
        isLiveModel: false,
        projectSlug: input.projectSlug,
        specialistTemplateKey: specialist,
        reasoningSummary: reasoningForIntent(intent, specialist),
        steps: buildWeeklyContentLoopSteps(input, {
          plannerLabel: this.label,
          brandPackReady,
          brandPackNote,
          brief: brandPackReady
            ? {
                theme: "[Demo Planner] Practical AI automation, one workflow at a time",
                audience: "[Demo Planner] Existing AUTIQ followers (not measured)",
                angles: ["Problem to solution", "Behind the scenes", "How-to in three steps"],
                captions: [
                  "[Demo] One repetitive task you can hand to AI this week.",
                  "[Demo] What we learned automating our own content workflow.",
                  "[Demo] Three steps to try your first AI automation.",
                ],
                successSignal: "[Demo Planner] Owner approves at least one caption",
              }
            : null,
        }),
        blockedReason: brandPackReady
          ? undefined
          : `Brand pack not ready — ${brandPackNote}`,
        planningOnly: false,
      });
    }

    if (intent.wantsExternal) {
      const actionType = intent.wantsMerge ? "request_merge_code" : "request_publish_post";
      const approvalActionType = intent.wantsMerge ? "merge_code" : "publish_post";
      return StructuredPlanSchema.parse({
        plannerId: "demo-planner",
        labeledAs: "Demo Planner (deterministic — not a live LLM)",
        isLiveModel: false,
        projectSlug: input.projectSlug,
        specialistTemplateKey: specialist,
        reasoningSummary: reasoningForIntent(intent, specialist),
        steps: [
          {
            sequence: 1,
            agentRole: "ceo",
            agentTemplateKey: "ceo",
            actionType: "receive_owner_request",
            summary: `FACCI CEO modtog opgave for ${input.projectName}: ${input.title}`,
            requiresApproval: false,
          },
          {
            sequence: 2,
            agentRole: "manager",
            agentTemplateKey: "manager",
            actionType: "delegate_to_specialist",
            summary: `Manager delegerer til projekt-lokal specialist (${specialist})`,
            requiresApproval: false,
          },
          {
            sequence: 3,
            agentRole: "specialist",
            agentTemplateKey: specialist,
            actionType,
            summary: `Policy gate: ${approvalActionType} kræver menneskelig godkendelse — udføres ikke automatisk`,
            requiresApproval: true,
            approvalActionType,
            riskLevel: "high",
          },
        ],
        blockedReason: `Ekstern handling ${approvalActionType} kræver menneskelig godkendelse og udføres ikke automatisk.`,
        planningOnly: false,
      });
    }

    if (intent.wantsCoding && input.availableSpecialists.includes("developer")) {
      return StructuredPlanSchema.parse({
        plannerId: "demo-planner",
        labeledAs: "Demo Planner (deterministic — not a live LLM)",
        isLiveModel: false,
        projectSlug: input.projectSlug,
        specialistTemplateKey: "developer",
        reasoningSummary: reasoningForIntent(intent, "developer"),
        steps: [
          {
            sequence: 1,
            agentRole: "ceo",
            agentTemplateKey: "ceo",
            actionType: "receive_owner_request",
            summary: `FACCI CEO modtog developer-opgave for ${input.projectName}`,
            requiresApproval: false,
          },
          {
            sequence: 2,
            agentRole: "manager",
            agentTemplateKey: "manager",
            actionType: "delegate_to_specialist",
            summary: "Manager delegerer til developer-agent",
            requiresApproval: false,
          },
          {
            sequence: 3,
            agentRole: "specialist",
            agentTemplateKey: "developer",
            actionType: "run_developer_task",
            summary: "Developer agent kører scoped edit i allowlistet workspace",
            requiresApproval: false,
            developerTask: {
              workspaceId: pickDeveloperWorkspaceId({
                projectSlug: input.projectSlug,
                title: input.title,
                objective: input.objective,
              }),
              prompt: `${input.title}\n\n${input.objective}`,
              runTests: true,
              preferOpenCode: process.env.FACCI_PREFER_OPENCODE === "1",
            },
          },
        ],
        planningOnly: false,
      });
    }

    if (intent.wantsContentPipeline || intent.wantsImage) {
      const imageKey = input.availableSpecialists.includes("image")
        ? "image"
        : specialist;
      const socialKey = input.availableSpecialists.includes("social")
        ? "social"
        : input.availableSpecialists.includes("marketing")
          ? "marketing"
          : specialist;
      return StructuredPlanSchema.parse({
        plannerId: "demo-planner",
        labeledAs: "Demo Planner (deterministic — not a live LLM)",
        isLiveModel: false,
        projectSlug: input.projectSlug,
        specialistTemplateKey: specialist,
        reasoningSummary: reasoningForIntent(intent, specialist),
        steps: [
          {
            sequence: 1,
            agentRole: "ceo",
            agentTemplateKey: "ceo",
            actionType: "receive_owner_request",
            summary: `FACCI CEO modtog content/image-opgave for ${input.projectName}`,
            requiresApproval: false,
          },
          {
            sequence: 2,
            agentRole: "manager",
            agentTemplateKey: "manager",
            actionType: "delegate_to_specialist",
            summary: "Manager delegerer til image/social specialister",
            requiresApproval: false,
          },
          {
            sequence: 3,
            agentRole: "specialist",
            agentTemplateKey: imageKey,
            actionType: "run_image_studio_task",
            summary: "Image agent kalder AI Image Studio adapter",
            requiresApproval: false,
            imageStudioTask: {
              prompt: `${input.title}. ${input.objective}`.slice(0, 2000),
              mode: "txt2img",
              workflowKey: "txt2img",
              execute: true,
            },
          },
          ...(intent.wantsContentPipeline
            ? [
                {
                  sequence: 4,
                  agentRole: "specialist" as const,
                  agentTemplateKey: socialKey,
                  actionType: "stage_social_draft" as const,
                  summary:
                    "Social agent stage caption/calendar (Postiz draft hvis konfigureret)",
                  requiresApproval: false,
                  socialDraft: {
                    caption: `# ${input.title}\n\n${input.objective}\n\n_AI draft — ikke publiceret._`,
                    channel: "instagram",
                    title: input.title,
                    attemptPostizDraft: true,
                  },
                },
              ]
            : []),
        ],
        planningOnly: false,
      });
    }

    if (intent.wantsAutomation) {
      return StructuredPlanSchema.parse({
        plannerId: "demo-planner",
        labeledAs: "Demo Planner (deterministic — not a live LLM)",
        isLiveModel: false,
        projectSlug: input.projectSlug,
        specialistTemplateKey: specialist,
        reasoningSummary: reasoningForIntent(intent, specialist),
        steps: [
          {
            sequence: 1,
            agentRole: "ceo",
            agentTemplateKey: "ceo",
            actionType: "receive_owner_request",
            summary: `FACCI CEO modtog automation-opgave for ${input.projectName}`,
            requiresApproval: false,
          },
          {
            sequence: 2,
            agentRole: "specialist",
            agentTemplateKey: specialist,
            actionType: "prepare_n8n_workflow",
            summary: "Automation agent forbereder n8n dry-run",
            requiresApproval: false,
            n8nJob: {
              dryRun: true,
              liveExecute: false,
              notes: `${input.title}\n${input.objective}`,
            },
          },
        ],
        planningOnly: false,
      });
    }

    const useSpecialistReport =
      intent.wantsResearch ||
      intent.wantsUx ||
      intent.wantsQa ||
      intent.wantsAnalytics ||
      ["research", "ux-design", "design", "qa", "security-qa", "analytics"].includes(
        specialist,
      );

    const artifact = useSpecialistReport
      ? specialistArtifact(input, specialist)
      : {
          kind: "markdown",
          title: input.title,
          filename: `${Date.now()}-${input.projectSlug}-draft.md`,
          content: draftContent(input.projectName, input.title, input.objective),
        };

    return StructuredPlanSchema.parse({
      plannerId: "demo-planner",
      labeledAs: "Demo Planner (deterministic — not a live LLM)",
      isLiveModel: false,
      projectSlug: input.projectSlug,
      specialistTemplateKey: specialist,
      reasoningSummary: reasoningForIntent(intent, specialist),
      steps: [
        {
          sequence: 1,
          agentRole: "ceo",
          agentTemplateKey: "ceo",
          actionType: "receive_owner_request",
          summary: `FACCI CEO prioriterede og sendte opgaven til ${input.projectName} Manager`,
          requiresApproval: false,
        },
        {
          sequence: 2,
          agentRole: "manager",
          agentTemplateKey: "manager",
          actionType: "delegate_to_specialist",
          summary: `${input.projectName} Manager delegerede til ${specialist}-agent`,
          requiresApproval: false,
        },
        {
          sequence: 3,
          agentRole: "specialist",
          agentTemplateKey: specialist,
          actionType: "write_local_artifact",
          summary: useSpecialistReport
            ? `M5 ${artifact.kind}: specialist skrev evidence-first rapport`
            : "Specialist skrev projekt-scoped markdown-artefakt via Demo Planner",
          requiresApproval: false,
          produceArtifact: artifact,
        },
        {
          sequence: 4,
          agentRole: "manager",
          agentTemplateKey: "manager",
          actionType: "verify_artifact",
          summary: "Manager verificerede at artefaktfilen findes i projektets workspace",
          requiresApproval: false,
        },
      ],
      planningOnly: false,
    });
  }
}
