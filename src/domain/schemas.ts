import { z } from "zod";

export const TaskStatusSchema = z.enum([
  "draft",
  "queued",
  "planning",
  "waiting_approval",
  "running",
  "verifying",
  "completed",
  "failed",
  "blocked",
  "cancelled",
]);

export const CreateTaskInputSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200),
  objective: z.string().min(1).max(4000),
  priority: z.number().int().min(0).max(100).optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
  /** operational (default) vs validation harness — never auto-delete history */
  origin: z.enum(["operational", "validation"]).optional(),
});

export const CreateProjectInputSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  mission: z.string().max(1000).optional(),
  teamTemplates: z.array(z.string()).min(1).max(12).optional(),
});

export const ApprovalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  decidedBy: z.string().min(1).max(120).default("Human Owner"),
});

export const CancelTaskSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** Actions the worker is allowed to materialize after a validated plan. */
export const ALLOWED_ACTION_TYPES = [
  "receive_owner_request",
  "delegate_to_specialist",
  "write_local_artifact",
  "verify_artifact",
  "run_developer_task",
  "update_brand_calendar",
  "append_allowlisted_note",
  "run_image_studio_task",
  "stage_social_draft",
  "prepare_n8n_workflow",
  "request_merge_code",
  "request_publish_post",
  "request_external_action",
  "note_blocker",
] as const;

export const DeveloperTaskSchema = z.object({
  workspaceId: z.string().min(1).max(64),
  prompt: z.string().min(1).max(8000),
  runTests: z.boolean().default(true),
  preferOpenCode: z.boolean().default(true),
});

/** Deterministic AUTIQ weekly calendar write (no LLM patch). */
export const BrandCalendarTaskSchema = z.object({
  workspaceId: z.literal("autiq"),
  theme: z.string().min(1).max(280),
  audience: z.string().min(1).max(280),
  angles: z.array(z.string().min(1).max(280)).min(1).max(3),
  captions: z.array(z.string().min(1).max(280)).min(1).max(3),
  successSignal: z.string().min(1).max(280),
});

/** Deterministic append to an allowlisted text file (app-repo FACCI notes). */
export const AppendAllowlistedNoteSchema = z.object({
  workspaceId: z.string().min(1).max(64),
  relativePath: z.string().min(1).max(200),
  note: z.string().min(3).max(2000),
});

export const ImageStudioTaskSchema = z.object({
  prompt: z.string().min(1).max(8000),
  negativePrompt: z.string().max(4000).optional(),
  mode: z.enum(["txt2img", "img2img", "character", "pose"]).optional(),
  workflowKey: z.string().min(1).max(80).optional(),
  characterId: z.string().min(1).max(80).optional(),
  execute: z.boolean().optional(),
});

export const SocialDraftSchema = z.object({
  caption: z.string().min(1).max(8000),
  channel: z.string().min(1).max(64).default("instagram"),
  calendarSlot: z.string().max(120).optional(),
  title: z.string().max(200).optional(),
  imageUrls: z.array(z.string()).max(8).optional(),
  attemptPostizDraft: z.boolean().default(true),
});

export const N8nJobSchema = z.object({
  workflowId: z.string().min(1).max(120).optional(),
  dryRun: z.boolean().default(true),
  liveExecute: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
});

export const DelegationStepSchema = z.object({
  sequence: z.number().int().positive(),
  agentRole: z.enum(["ceo", "manager", "specialist"]),
  agentTemplateKey: z.string().min(1).max(64),
  actionType: z.enum(ALLOWED_ACTION_TYPES),
  summary: z.string().min(1).max(1000),
  requiresApproval: z.boolean().default(false),
  approvalActionType: z.string().max(80).optional(),
  riskLevel: z.enum(["low", "medium", "high"]).optional(),
  produceArtifact: z
    .object({
      kind: z.string().min(1).max(40),
      title: z.string().min(1).max(200),
      filename: z.string().min(1).max(120),
      content: z.string().min(1).max(20000),
    })
    .optional(),
  developerTask: DeveloperTaskSchema.optional(),
  brandCalendarTask: BrandCalendarTaskSchema.optional(),
  appendAllowlistedNote: AppendAllowlistedNoteSchema.optional(),
  imageStudioTask: ImageStudioTaskSchema.optional(),
  socialDraft: SocialDraftSchema.optional(),
  n8nJob: N8nJobSchema.optional(),
});

export const StructuredPlanSchema = z
  .object({
    plannerId: z.string().min(1),
    labeledAs: z.string().min(1),
    isLiveModel: z.boolean(),
    modelId: z.string().optional(),
    latencyMs: z.number().nonnegative().optional(),
    projectSlug: z.string().min(1),
    specialistTemplateKey: z.string().min(1),
    reasoningSummary: z.string().max(2000).optional(),
    steps: z.array(DelegationStepSchema).min(1).max(12),
    blockedReason: z.string().max(1000).optional(),
    /** True when the plan itself is the deliverable and no side effects should claim "executed work". */
    planningOnly: z.boolean().default(false),
  })
  .superRefine((plan, ctx) => {
    const hasArtifact = plan.steps.some((s) => s.produceArtifact);
    const hasApproval = plan.steps.some((s) => s.requiresApproval);
    const hasDev = plan.steps.some((s) => s.actionType === "run_developer_task");
    const hasCalendar = plan.steps.some((s) => s.actionType === "update_brand_calendar");
    const hasAppend = plan.steps.some((s) => s.actionType === "append_allowlisted_note");
    const hasImage = plan.steps.some((s) => s.actionType === "run_image_studio_task");
    const hasSocial = plan.steps.some((s) => s.actionType === "stage_social_draft");
    const hasN8n = plan.steps.some((s) => s.actionType === "prepare_n8n_workflow");
    if (
      !plan.planningOnly &&
      !hasArtifact &&
      !hasApproval &&
      !hasDev &&
      !hasCalendar &&
      !hasAppend &&
      !hasImage &&
      !hasSocial &&
      !hasN8n &&
      !plan.blockedReason
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Plan must produce an artifact, run a tool step, request approval, set blockedReason, or mark planningOnly",
      });
    }
    for (const step of plan.steps) {
      if (step.requiresApproval && !step.approvalActionType) {
        ctx.addIssue({
          code: "custom",
          message: `Step ${step.sequence} requiresApproval but missing approvalActionType`,
        });
      }
      if (step.actionType === "write_local_artifact" && !step.produceArtifact) {
        ctx.addIssue({
          code: "custom",
          message: `Step ${step.sequence} write_local_artifact missing produceArtifact`,
        });
      }
      if (step.actionType === "run_developer_task" && !step.developerTask) {
        ctx.addIssue({
          code: "custom",
          message: `Step ${step.sequence} run_developer_task missing developerTask`,
        });
      }
      if (step.actionType === "update_brand_calendar" && !step.brandCalendarTask) {
        ctx.addIssue({
          code: "custom",
          message: `Step ${step.sequence} update_brand_calendar missing brandCalendarTask`,
        });
      }
      if (step.actionType === "append_allowlisted_note" && !step.appendAllowlistedNote) {
        ctx.addIssue({
          code: "custom",
          message: `Step ${step.sequence} append_allowlisted_note missing appendAllowlistedNote`,
        });
      }
      if (step.actionType === "run_image_studio_task" && !step.imageStudioTask) {
        ctx.addIssue({
          code: "custom",
          message: `Step ${step.sequence} run_image_studio_task missing imageStudioTask`,
        });
      }
      if (step.actionType === "stage_social_draft" && !step.socialDraft) {
        ctx.addIssue({
          code: "custom",
          message: `Step ${step.sequence} stage_social_draft missing socialDraft`,
        });
      }
      if (step.actionType === "prepare_n8n_workflow" && !step.n8nJob) {
        ctx.addIssue({
          code: "custom",
          message: `Step ${step.sequence} prepare_n8n_workflow missing n8nJob`,
        });
      }
    }
  });

/** @deprecated Use StructuredPlanSchema — kept for older Demo Planner tests */
export const DemoPlanSchema = StructuredPlanSchema;

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type StructuredPlan = z.infer<typeof StructuredPlanSchema>;
export type DemoPlan = StructuredPlan;
