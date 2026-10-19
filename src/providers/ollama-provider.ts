import {
  ALLOWED_ACTION_TYPES,
  StructuredPlanSchema,
  type StructuredPlan,
} from "@/domain/schemas";
import {
  classifyOwnerIntent,
  reasoningForIntent,
  resolveSpecialistTemplateKey,
} from "@/domain/routing";
import { buildSpecialistReport } from "@/domain/specialist-reports";
import {
  buildWeeklyBriefUserPrompt,
  buildWeeklyContentLoopSteps,
  parseAndSanitizeWeeklyBrief,
  parseWeeklyBrief,
  WEEKLY_BRIEF_SYSTEM_PROMPT,
} from "@/domain/content-loop";
import {
  buildDreamitResearchLoopSteps,
  buildGrupviUxLoopSteps,
} from "@/domain/project-loops";
import { inspectGpuGuard } from "@/providers/gpu-guard";
import type { ModelProvider, PlanContext } from "@/providers/types";
import {
  brandPackReadinessSummary,
  loadAutiqBrandPack,
} from "@/tools/autiq-brand";
import { parseAppendNoteFromDeveloperPrompt } from "@/tools/allowlisted-append";
import {
  pickDeveloperWorkspaceId,
  shouldRunWorkspaceTests,
} from "@/tools/workspace-routing";

const ALLOWED = new Set<string>(ALLOWED_ACTION_TYPES);

const DEFAULT_MODEL = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:3b";
const BASE_URL = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(
  /\/$/,
  "",
);

/** Exported for unit tests — wraps sanitize without calling Ollama. */
export function sanitizeOllamaPlanForTest(
  raw: unknown,
  input: PlanContext,
  meta: { modelId: string; latencyMs: number } = { modelId: "test", latencyMs: 1 },
): StructuredPlan {
  return sanitizePlan(raw, input, meta);
}

type OllamaChatResponse = {
  message?: { content?: string };
  model?: string;
  total_duration?: number;
  eval_count?: number;
  error?: string;
};

function extractJsonObject(text: string): unknown {
  const cleaned = text
    .replace(/```json\s*/gi, "```")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Model response did not contain valid JSON");
  }
}

function buildSystemPrompt(availableSpecialists: string[]): string {
  return `You are the FACCI planning brain for a local AI organization OS.
You MUST output a single JSON object only (no markdown, no prose outside JSON).

Hierarchy (preserve always):
Human Owner -> FACCI CEO -> one Project Manager -> project-local specialists.

Rules:
- Plan ONLY for the given project. Never reference other projects' private data.
- specialistTemplateKey MUST be one of: ${availableSpecialists.join(", ") || "(none)"}
- steps must include CEO receive, manager delegate, then specialist work.
- For safe drafting/research/UX/QA/analytics tasks: include write_local_artifact with real markdown content in produceArtifact, then verify_artifact. Cite sources with provenance (observed/inferred/proposed/blocked). Do NOT invent customer data. Do NOT set requiresApproval on drafts.
- For coding/fix/bug/implement/content-file tasks when a developer specialist exists: use actionType run_developer_task with developerTask { workspaceId, prompt, runTests:true }. Workspaces: AUTIQ brand "autiq" / web "autiq-web"; Grupvi vault "grupvi" / app "grupvi-app"; DreamIT vault "dreamit" / web "dreamit-web"; NOFACCI vault "nofacci" / site "nofacci-web"; DailyCap "dailycap"; toy demos "toy-counter". For NOFACCI website/hjemmeside always workspaceId "nofacci-web". Prefer specialistTemplateKey "developer".
- For content pipeline / image+caption / calendar drafts: use run_image_studio_task + stage_social_draft. Never publish.
- For n8n automation prep: use prepare_n8n_workflow with dryRun true. Never live-trigger without approval.
- ONLY if the owner explicitly asks to publish/send/deploy/merge/push/purchase: set requiresApproval=true with approvalActionType (publish_post or merge_code), riskLevel=high, and do NOT claim executed.
- actionType must be one of: receive_owner_request, delegate_to_specialist, write_local_artifact, verify_artifact, run_developer_task, update_brand_calendar, append_allowlisted_note, run_image_studio_task, stage_social_draft, prepare_n8n_workflow, request_merge_code, request_publish_post, request_external_action, note_blocker
- Do not invent tool results. Artifact content must be useful draft text, labeled as AI draft.
- Keep steps <= 8. Filename must be safe: [a-zA-Z0-9._-]+ ending in .md
- planningOnly=false when writing an artifact, running a tool task, or requesting approval.

JSON shape:
{
  "specialistTemplateKey": "marketing",
  "reasoningSummary": "short",
  "planningOnly": false,
  "blockedReason": null,
  "steps": [
    {
      "sequence": 1,
      "agentRole": "ceo",
      "agentTemplateKey": "ceo",
      "actionType": "receive_owner_request",
      "summary": "...",
      "requiresApproval": false
    }
  ]
}`;
}

function buildUserPrompt(input: PlanContext): string {
  const memories =
    input.projectMemories && input.projectMemories.length > 0
      ? input.projectMemories
          .slice(0, 8)
          .map((m) => `- [${m.category}] ${m.content.slice(0, 280)}`)
          .join("\n")
      : "(none)";

  return `Project slug: ${input.projectSlug}
Project name: ${input.projectName}
Mission: ${input.projectMission ?? "(none)"}
Available specialists: ${input.availableSpecialists.join(", ")}
Project memory (this project only):
${memories}

Owner task title: ${input.title}
Owner objective: ${input.objective}

Return the JSON object now.`;
}

function sanitizePlan(
  raw: unknown,
  input: PlanContext,
  meta: { modelId: string; latencyMs: number },
): StructuredPlan {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const stepsIn = Array.isArray(obj.steps) ? obj.steps : [];
  const specialistRaw =
    typeof obj.specialistTemplateKey === "string"
      ? obj.specialistTemplateKey
      : input.availableSpecialists[0] ?? "developer";

  const intent = classifyOwnerIntent(input.title, input.objective);
  const wantsExternal = intent.wantsExternal;
  const wantsCoding =
    intent.wantsCoding && input.availableSpecialists.includes("developer");

  // Deterministic override — small models often leave specialistTemplateKey as "marketing".
  const specialistTemplateKey = resolveSpecialistTemplateKey(
    intent,
    input.availableSpecialists,
    specialistRaw,
  );

  if (intent.wantsGrupviUxLoop) {
    const labeledAs = `Ollama live model (${meta.modelId})`;
    return StructuredPlanSchema.parse({
      plannerId: "ollama",
      labeledAs,
      isLiveModel: true,
      modelId: meta.modelId,
      latencyMs: meta.latencyMs,
      projectSlug: input.projectSlug,
      specialistTemplateKey,
      reasoningSummary: reasoningForIntent(intent, specialistTemplateKey),
      steps: buildGrupviUxLoopSteps(input, { plannerLabel: labeledAs }),
      planningOnly: false,
    });
  }

  if (intent.wantsDreamitResearchLoop) {
    const labeledAs = `Ollama live model (${meta.modelId})`;
    return StructuredPlanSchema.parse({
      plannerId: "ollama",
      labeledAs,
      isLiveModel: true,
      modelId: meta.modelId,
      latencyMs: meta.latencyMs,
      projectSlug: input.projectSlug,
      specialistTemplateKey,
      reasoningSummary: reasoningForIntent(intent, specialistTemplateKey),
      steps: buildDreamitResearchLoopSteps(input, { plannerLabel: labeledAs }),
      planningOnly: false,
    });
  }

  if (intent.wantsWeeklyContentLoop) {
    const labeledAs = `Ollama live model (${meta.modelId})`;
    const pack =
      input.projectSlug === "autiq" ? loadAutiqBrandPack() : null;
    const brandPackReady = pack ? pack.ready : true;
    const brandPackNote = pack ? brandPackReadinessSummary(pack) : null;
    const parsedBrief = brandPackReady
      ? parseAndSanitizeWeeklyBrief(obj.brief ?? obj)
      : null;
    const steps = buildWeeklyContentLoopSteps(input, {
      plannerLabel: labeledAs,
      brief: parsedBrief,
      brandPackReady,
      brandPackNote,
    });
    return StructuredPlanSchema.parse({
      plannerId: "ollama",
      labeledAs,
      isLiveModel: true,
      modelId: meta.modelId,
      latencyMs: meta.latencyMs,
      projectSlug: input.projectSlug,
      specialistTemplateKey,
      reasoningSummary: reasoningForIntent(intent, specialistTemplateKey),
      steps,
      blockedReason: brandPackReady
        ? undefined
        : `Brand pack not ready — ${brandPackNote}. Fill workspaces/autiq/brand/ before calendar drafts.`,
      planningOnly: false,
    });
  }

  const useSpecialistReport =
    intent.wantsResearch ||
    intent.wantsUx ||
    intent.wantsQa ||
    intent.wantsAnalytics ||
    ["research", "ux-design", "design", "qa", "security-qa", "analytics"].includes(
      specialistTemplateKey,
    );

  const specialistFallback = useSpecialistReport
    ? buildSpecialistReport({
        projectName: input.projectName,
        projectSlug: input.projectSlug,
        title: input.title,
        objective: input.objective,
        templateKey: specialistTemplateKey,
        projectMission: input.projectMission ?? null,
        plannerLabel: `Ollama live model (${meta.modelId})`,
      })
    : null;

  const fallbackDraft =
    specialistFallback?.content ??
    `# ${input.title}

## Objective
${input.objective}

## Draft notes
- Project: ${input.projectName} (${input.projectSlug})
- Specialist: ${specialistTemplateKey}
- This draft was completed by FACCI after Ollama returned an incomplete artifact payload.
- Review before any external use.

### Outline
1. Context for ${input.projectName}
2. Concrete next actions derived from the objective
3. Open questions for the human owner
`;

  const fallbackKind = specialistFallback?.kind ?? "markdown";
  const fallbackFilename =
    specialistFallback?.filename ?? `${Date.now()}-${input.projectSlug}-ai-draft.md`;

  let normalizedSteps = stepsIn.map((s, idx) => {
    const step = (s ?? {}) as Record<string, unknown>;
    const role =
      step.agentRole === "ceo" || step.agentRole === "manager" || step.agentRole === "specialist"
        ? step.agentRole
        : idx === 0
          ? "ceo"
          : idx === 1
            ? "manager"
            : "specialist";
    let templateKey =
      typeof step.agentTemplateKey === "string" ? step.agentTemplateKey : role;
    if (role === "specialist") {
      templateKey = input.availableSpecialists.includes(templateKey)
        ? templateKey
        : specialistTemplateKey;
    }
    if (role === "ceo") templateKey = "ceo";
    if (role === "manager") templateKey = "manager";

    let actionType =
      typeof step.actionType === "string" && ALLOWED.has(step.actionType)
        ? step.actionType
        : role === "ceo"
          ? "receive_owner_request"
          : role === "manager"
            ? "delegate_to_specialist"
            : "write_local_artifact";

    let produceArtifact =
      step.produceArtifact && typeof step.produceArtifact === "object"
        ? (step.produceArtifact as Record<string, unknown>)
        : undefined;

    // Small models often omit produceArtifact; repair instead of failing closed on schema only.
    if (
      (actionType === "write_local_artifact" || produceArtifact) &&
      (!produceArtifact || !String((produceArtifact as { content?: unknown }).content ?? "").trim())
    ) {
      actionType = "write_local_artifact";
      produceArtifact = {
        kind: fallbackKind,
        title: input.title,
        filename: fallbackFilename,
        content:
          typeof obj.draftContent === "string" && obj.draftContent.trim()
            ? obj.draftContent
            : fallbackDraft,
      };
    }

    return {
      sequence: typeof step.sequence === "number" ? step.sequence : idx + 1,
      agentRole: role,
      agentTemplateKey: templateKey,
      actionType,
      summary: String(step.summary ?? `Step ${idx + 1}`),
      requiresApproval: Boolean(step.requiresApproval),
      approvalActionType:
        typeof step.approvalActionType === "string"
          ? step.approvalActionType
          : undefined,
      riskLevel:
        step.riskLevel === "low" || step.riskLevel === "medium" || step.riskLevel === "high"
          ? step.riskLevel
          : undefined,
      produceArtifact: produceArtifact
        ? {
            kind: String(produceArtifact.kind ?? "markdown"),
            title: String(produceArtifact.title ?? input.title),
            filename: String(produceArtifact.filename ?? `${Date.now()}-${input.projectSlug}.md`)
              .replace(/[^a-zA-Z0-9._-]/g, "_")
              .slice(0, 120),
            content: String(produceArtifact.content ?? fallbackDraft),
          }
        : undefined,
      developerTask: undefined as
        | {
            workspaceId: string;
            prompt: string;
            runTests: boolean;
            preferOpenCode: boolean;
          }
        | undefined,
      brandCalendarTask: undefined as
        | {
            workspaceId: "autiq";
            theme: string;
            audience: string;
            angles: string[];
            captions: string[];
            successSignal: string;
          }
        | undefined,
      appendAllowlistedNote: undefined as
        | {
            workspaceId: string;
            relativePath: string;
            note: string;
          }
        | undefined,
      imageStudioTask: undefined as
        | {
            prompt: string;
            negativePrompt?: string;
            mode?: "txt2img" | "img2img" | "character" | "pose";
            workflowKey?: string;
            characterId?: string;
            execute?: boolean;
          }
        | undefined,
      socialDraft: undefined as
        | {
            caption: string;
            channel: string;
            calendarSlot?: string;
            title?: string;
            imageUrls?: string[];
            attemptPostizDraft: boolean;
          }
        | undefined,
      n8nJob: undefined as
        | {
            workflowId?: string;
            dryRun: boolean;
            liveExecute: boolean;
            notes?: string;
          }
        | undefined,
    };
  });

  const emptyToolFields = {
    developerTask: undefined,
    brandCalendarTask: undefined,
    appendAllowlistedNote: undefined,
    imageStudioTask: undefined,
    socialDraft: undefined,
    n8nJob: undefined,
  };

  // Coding tasks: ensure a developer step targeting the allowlisted workspace.
  // Never mix with merge/push/publish intents — those must stop at approval only.
  if (wantsCoding && !wantsExternal) {
    // Draft/verify before execution would fail ("no artifacts") — strip until after developer.
    for (const step of normalizedSteps) {
      if (
        step.actionType === "write_local_artifact" ||
        step.actionType === "verify_artifact"
      ) {
        step.actionType = "note_blocker";
        step.produceArtifact = undefined;
        step.summary = `${step.summary} (replaced by developer task)`;
      }
    }
    if (!normalizedSteps.some((s) => s.actionType === "run_developer_task")) {
      normalizedSteps.push({
        sequence: normalizedSteps.length + 1,
        agentRole: "specialist",
        agentTemplateKey: input.availableSpecialists.includes("developer")
          ? "developer"
          : specialistTemplateKey,
        actionType: "run_developer_task",
        summary: "Developer agent applies scoped code change in allowlisted workspace",
        requiresApproval: false,
        approvalActionType: undefined,
        riskLevel: "medium" as const,
        produceArtifact: undefined,
        ...emptyToolFields,
        developerTask: (() => {
          const workspaceId = pickDeveloperWorkspaceId({
            projectSlug: input.projectSlug,
            title: input.title,
            objective: input.objective,
          });
          return {
            workspaceId,
            prompt: `${input.title}\n\n${input.objective}`,
            runTests: shouldRunWorkspaceTests(workspaceId),
            // Default false on constrained local GPUs; set FACCI_PREFER_OPENCODE=1 to try CLI first.
            preferOpenCode: process.env.FACCI_PREFER_OPENCODE === "1",
          };
        })(),
      });
    }
    // Order: receive → delegate → run_developer_task → (drop placeholder note_blockers)
    const head = normalizedSteps.filter(
      (s) =>
        s.actionType === "receive_owner_request" ||
        s.actionType === "delegate_to_specialist",
    );
    const developer = normalizedSteps.filter(
      (s) => s.actionType === "run_developer_task",
    );
    const tail = normalizedSteps.filter(
      (s) =>
        s.actionType !== "receive_owner_request" &&
        s.actionType !== "delegate_to_specialist" &&
        s.actionType !== "run_developer_task" &&
        s.actionType !== "note_blocker",
    );
    normalizedSteps = [...head, ...developer, ...tail].map((s, i) => ({
      ...s,
      sequence: i + 1,
    }));
  }

  // M4 content pipeline: Image Studio + social staging (Postiz draft if configured).
  if (
    intent.wantsContentPipeline &&
    !wantsExternal &&
    !wantsCoding
  ) {
    for (const step of normalizedSteps) {
      if (step.actionType === "write_local_artifact") {
        step.actionType = "note_blocker";
        step.produceArtifact = undefined;
        step.summary = `${step.summary} (replaced by M4 draft pipeline)`;
      }
    }
    if (!normalizedSteps.some((s) => s.actionType === "run_image_studio_task")) {
      normalizedSteps.push({
        sequence: normalizedSteps.length + 1,
        agentRole: "specialist",
        agentTemplateKey: input.availableSpecialists.includes("image")
          ? "image"
          : specialistTemplateKey,
        actionType: "run_image_studio_task",
        summary: "Image agent requests generation via AI Image Studio adapter",
        requiresApproval: false,
        approvalActionType: undefined,
        riskLevel: "medium" as const,
        produceArtifact: undefined,
        ...emptyToolFields,
        imageStudioTask: {
          prompt: `${input.title}. ${input.objective}`.slice(0, 2000),
          mode: "txt2img",
          workflowKey: "txt2img",
          execute: true,
        },
      });
    }
    if (!normalizedSteps.some((s) => s.actionType === "stage_social_draft")) {
      normalizedSteps.push({
        sequence: normalizedSteps.length + 1,
        agentRole: "specialist",
        agentTemplateKey: input.availableSpecialists.includes("social")
          ? "social"
          : input.availableSpecialists.includes("marketing")
            ? "marketing"
            : specialistTemplateKey,
        actionType: "stage_social_draft",
        summary: "Social agent stages caption + calendar (Postiz draft only if configured)",
        requiresApproval: false,
        approvalActionType: undefined,
        riskLevel: "low" as const,
        produceArtifact: undefined,
        ...emptyToolFields,
        socialDraft: {
          caption: `# ${input.title}\n\n${input.objective}\n\n_AI draft caption — review before any publish._`,
          channel: "instagram",
          title: input.title,
          attemptPostizDraft: true,
        },
      });
    }
    // Explicit review stop — publish still requires separate owner intent + approval.
    if (!normalizedSteps.some((s) => s.actionType === "note_blocker")) {
      normalizedSteps.push({
        sequence: normalizedSteps.length + 1,
        agentRole: "manager",
        agentTemplateKey: "manager",
        actionType: "note_blocker",
        summary:
          "Manager review checkpoint: drafts staged; external publish not requested in this task",
        requiresApproval: false,
        approvalActionType: undefined,
        riskLevel: undefined,
        produceArtifact: undefined,
        ...emptyToolFields,
      });
    }
  } else if (
    intent.wantsImage &&
    !wantsExternal &&
    !wantsCoding &&
    !intent.wantsContentPipeline &&
    !normalizedSteps.some((s) => s.actionType === "run_image_studio_task")
  ) {
    for (const step of normalizedSteps) {
      if (step.actionType === "write_local_artifact") {
        step.actionType = "note_blocker";
        step.produceArtifact = undefined;
      }
    }
    normalizedSteps.push({
      sequence: normalizedSteps.length + 1,
      agentRole: "specialist",
      agentTemplateKey: input.availableSpecialists.includes("image")
        ? "image"
        : specialistTemplateKey,
      actionType: "run_image_studio_task",
      summary: "Image agent runs Image Studio generation request",
      requiresApproval: false,
      approvalActionType: undefined,
      riskLevel: "medium" as const,
      produceArtifact: undefined,
      ...emptyToolFields,
      imageStudioTask: {
        prompt: `${input.title}. ${input.objective}`.slice(0, 2000),
        mode: "txt2img",
        workflowKey: "txt2img",
        execute: true,
      },
    });
  } else if (
    intent.wantsAutomation &&
    !wantsExternal &&
    !wantsCoding &&
    !normalizedSteps.some((s) => s.actionType === "prepare_n8n_workflow")
  ) {
    normalizedSteps.push({
      sequence: normalizedSteps.length + 1,
      agentRole: "specialist",
      agentTemplateKey: input.availableSpecialists.includes("automation")
        ? "automation"
        : specialistTemplateKey,
      actionType: "prepare_n8n_workflow",
      summary: "Automation agent prepares n8n dry-run (no live trigger)",
      requiresApproval: false,
      approvalActionType: undefined,
      riskLevel: "low" as const,
      produceArtifact: undefined,
      ...emptyToolFields,
      n8nJob: {
        dryRun: true,
        liveExecute: false,
        notes: `${input.title}\n${input.objective}`,
      },
    });
  }

  // Preserve tool payloads from model output when present; repair missing payloads
  // (small models often emit actionType without the required nested object).
  for (let i = 0; i < normalizedSteps.length; i++) {
    const rawStep = (stepsIn[i] ?? {}) as Record<string, unknown>;
    const dt = rawStep.developerTask;
    const defaultPreferOpenCode = process.env.FACCI_PREFER_OPENCODE === "1";
    const defaultWs = pickDeveloperWorkspaceId({
      projectSlug: input.projectSlug,
      title: input.title,
      objective: input.objective,
    });
    if (dt && typeof dt === "object" && normalizedSteps[i].actionType === "run_developer_task") {
      const d = dt as Record<string, unknown>;
      // Never trust the model's workspaceId — small models often pick toy-counter.
      const ws = defaultWs;
      normalizedSteps[i].developerTask = {
        workspaceId: ws,
        prompt: String(d.prompt ?? `${input.title}\n${input.objective}`),
        runTests: typeof d.runTests === "boolean" ? d.runTests : shouldRunWorkspaceTests(ws),
        preferOpenCode:
          typeof d.preferOpenCode === "boolean" ? d.preferOpenCode : defaultPreferOpenCode,
      };
    }
    if (
      normalizedSteps[i].actionType === "run_developer_task" &&
      !normalizedSteps[i].developerTask
    ) {
      normalizedSteps[i].developerTask = {
        workspaceId: defaultWs,
        prompt: `${input.title}\n\n${input.objective}`,
        runTests: shouldRunWorkspaceTests(defaultWs),
        preferOpenCode: defaultPreferOpenCode,
      };
    }
    // Tiny AGENTS/README notes: prefer deterministic append over bounded-patch on large repos.
    const stepDev = normalizedSteps[i].developerTask;
    if (normalizedSteps[i].actionType === "run_developer_task" && stepDev) {
      const parsed = parseAppendNoteFromDeveloperPrompt(stepDev.prompt);
      if (parsed) {
        normalizedSteps[i] = {
          ...normalizedSteps[i],
          actionType: "append_allowlisted_note",
          summary: "Append FACCI note to allowlisted docs file (deterministic writer)",
          riskLevel: "low",
          appendAllowlistedNote: {
            workspaceId: stepDev.workspaceId,
            relativePath: parsed.relativePath,
            note: parsed.note,
          },
          developerTask: undefined,
        };
      }
    }
    const it = rawStep.imageStudioTask;
    if (it && typeof it === "object" && normalizedSteps[i].actionType === "run_image_studio_task") {
      const d = it as Record<string, unknown>;
      normalizedSteps[i].imageStudioTask = {
        prompt: String(d.prompt ?? `${input.title}\n${input.objective}`),
        negativePrompt: typeof d.negativePrompt === "string" ? d.negativePrompt : undefined,
        mode:
          d.mode === "txt2img" || d.mode === "img2img" || d.mode === "character" || d.mode === "pose"
            ? d.mode
            : "txt2img",
        workflowKey: typeof d.workflowKey === "string" ? d.workflowKey : "txt2img",
        characterId: typeof d.characterId === "string" ? d.characterId : undefined,
        execute: d.execute !== false,
      };
    }
    if (
      normalizedSteps[i].actionType === "run_image_studio_task" &&
      !normalizedSteps[i].imageStudioTask
    ) {
      normalizedSteps[i].imageStudioTask = {
        prompt: `${input.title}. ${input.objective}`.slice(0, 2000),
        mode: "txt2img",
        workflowKey: "txt2img",
        execute: true,
      };
    }
    const sd = rawStep.socialDraft;
    if (sd && typeof sd === "object" && normalizedSteps[i].actionType === "stage_social_draft") {
      const d = sd as Record<string, unknown>;
      normalizedSteps[i].socialDraft = {
        caption: String(d.caption ?? input.objective),
        channel: String(d.channel ?? "instagram"),
        calendarSlot: typeof d.calendarSlot === "string" ? d.calendarSlot : undefined,
        title: typeof d.title === "string" ? d.title : input.title,
        imageUrls: Array.isArray(d.imageUrls)
          ? d.imageUrls.map(String).slice(0, 8)
          : undefined,
        attemptPostizDraft: d.attemptPostizDraft !== false,
      };
    }
    if (
      normalizedSteps[i].actionType === "stage_social_draft" &&
      !normalizedSteps[i].socialDraft
    ) {
      normalizedSteps[i].socialDraft = {
        caption: `# ${input.title}\n\n${input.objective}\n\n_AI draft caption — review before any publish._`,
        channel: "instagram",
        title: input.title,
        attemptPostizDraft: true,
      };
    }
    const nj = rawStep.n8nJob;
    if (nj && typeof nj === "object" && normalizedSteps[i].actionType === "prepare_n8n_workflow") {
      const d = nj as Record<string, unknown>;
      normalizedSteps[i].n8nJob = {
        workflowId: typeof d.workflowId === "string" ? d.workflowId : undefined,
        dryRun: d.dryRun !== false,
        liveExecute: d.liveExecute === true,
        notes: typeof d.notes === "string" ? d.notes : undefined,
      };
    }
    if (
      normalizedSteps[i].actionType === "prepare_n8n_workflow" &&
      !normalizedSteps[i].n8nJob
    ) {
      normalizedSteps[i].n8nJob = {
        dryRun: true,
        liveExecute: false,
        notes: `${input.title}\n${input.objective}`,
      };
    }
  }

  // If model never scheduled an artifact on a safe draft task, append one.
  if (
    !wantsExternal &&
    !wantsCoding &&
    !intent.wantsContentPipeline &&
    !intent.wantsImage &&
    !intent.wantsAutomation &&
    !normalizedSteps.some((s) => s.produceArtifact) &&
    !normalizedSteps.some((s) => s.requiresApproval) &&
    !normalizedSteps.some((s) => s.actionType === "run_developer_task") &&
    !normalizedSteps.some((s) => s.actionType === "run_image_studio_task") &&
    !normalizedSteps.some((s) => s.actionType === "stage_social_draft") &&
    !normalizedSteps.some((s) => s.actionType === "prepare_n8n_workflow")
  ) {
    normalizedSteps.push({
      sequence: normalizedSteps.length + 1,
      agentRole: "specialist",
      agentTemplateKey: specialistTemplateKey,
      actionType: "write_local_artifact",
      summary: "Specialist writes project-scoped markdown draft (sanitizer-added)",
      requiresApproval: false,
      approvalActionType: undefined,
      riskLevel: "low" as const,
      produceArtifact: {
        kind: fallbackKind,
        title: input.title,
        filename: fallbackFilename,
        content: fallbackDraft,
      },
      ...emptyToolFields,
    });
    normalizedSteps.push({
      sequence: normalizedSteps.length + 1,
      agentRole: "manager",
      agentTemplateKey: "manager",
      actionType: "verify_artifact",
      summary: "Manager verifies artifact exists on disk",
      requiresApproval: false,
      approvalActionType: undefined,
      riskLevel: undefined,
      produceArtifact: undefined,
      ...emptyToolFields,
    });
  }

  // Small models invent approvals on safe drafts — strip unless owner intent is high-risk.
  if (!wantsExternal) {
    for (const step of normalizedSteps) {
      if (!step.requiresApproval) continue;
      step.requiresApproval = false;
      step.approvalActionType = undefined;
      if (
        step.actionType === "request_publish_post" ||
        step.actionType === "request_external_action"
      ) {
        step.actionType = "write_local_artifact";
        step.summary = `${step.summary} (spurious approval removed — safe local draft)`;
        if (!step.produceArtifact) {
          step.produceArtifact = {
            kind: "markdown",
            title: input.title,
            filename: `${Date.now()}-${input.projectSlug}-ai-draft.md`,
            content: fallbackDraft,
          };
        }
      }
    }
  }

  // High-risk: approval only — strip developer/artifact/tool execution claims.
  if (wantsExternal) {
    for (const step of normalizedSteps) {
      if (
        step.actionType === "run_developer_task" ||
        step.actionType === "run_image_studio_task" ||
        step.actionType === "stage_social_draft" ||
        step.actionType === "prepare_n8n_workflow"
      ) {
        step.actionType = "note_blocker";
        step.developerTask = undefined;
        step.imageStudioTask = undefined;
        step.socialDraft = undefined;
        step.n8nJob = undefined;
        step.summary = `${step.summary} (blocked — merge/publish requires approval first)`;
      }
      if (step.produceArtifact) {
        step.produceArtifact = undefined;
        if (step.actionType === "write_local_artifact") {
          step.actionType = "note_blocker";
        }
      }
      // Align specialist steps with deterministically resolved specialist
      if (step.agentRole === "specialist") {
        step.agentTemplateKey = specialistTemplateKey;
      }
    }
    const actionType = intent.wantsMerge ? "request_merge_code" : "request_publish_post";
    const approvalActionType = intent.wantsMerge ? "merge_code" : "publish_post";
    if (!normalizedSteps.some((s) => s.requiresApproval)) {
      normalizedSteps.push({
        sequence: normalizedSteps.length + 1,
        agentRole: "specialist",
        agentTemplateKey: specialistTemplateKey,
        actionType,
        summary: `Policy gate: ${approvalActionType} requires human approval and will not auto-execute.`,
        requiresApproval: true,
        approvalActionType,
        riskLevel: "high",
        produceArtifact: undefined,
        ...emptyToolFields,
      });
    } else {
      for (const step of normalizedSteps) {
        if (!step.requiresApproval) continue;
        step.approvalActionType = approvalActionType;
        step.agentTemplateKey = specialistTemplateKey;
        if (
          step.actionType === "request_publish_post" ||
          step.actionType === "request_external_action" ||
          step.actionType === "request_merge_code" ||
          step.actionType === "note_blocker"
        ) {
          step.actionType = actionType;
        }
      }
    }
  }

  // Keep coding specialist keys consistent on developer steps
  if (wantsCoding) {
    for (const step of normalizedSteps) {
      if (step.actionType === "run_developer_task" || step.agentRole === "specialist") {
        if (input.availableSpecialists.includes("developer")) {
          step.agentTemplateKey = "developer";
        }
      }
    }
  }

  // Stamp AI provenance on artifact bodies.
  for (const step of normalizedSteps) {
    if (step.produceArtifact?.content) {
      const stamp = `\n\n---\n_AI draft via Ollama \`${meta.modelId}\` — validated plan, not a claim of external execution._\n`;
      if (!step.produceArtifact.content.includes("AI draft via Ollama")) {
        step.produceArtifact.content = `${step.produceArtifact.content.trim()}${stamp}`;
      }
    }
  }

  return StructuredPlanSchema.parse({
    plannerId: "ollama",
    labeledAs: `Ollama live model (${meta.modelId})`,
    isLiveModel: true,
    modelId: meta.modelId,
    latencyMs: meta.latencyMs,
    projectSlug: input.projectSlug,
    specialistTemplateKey,
    reasoningSummary: reasoningForIntent(
      intent,
      specialistTemplateKey,
      typeof obj.reasoningSummary === "string" ? obj.reasoningSummary : undefined,
    ),
    steps: normalizedSteps,
    blockedReason:
      typeof obj.blockedReason === "string" && obj.blockedReason.length > 0
        ? obj.blockedReason
        : wantsExternal
          ? "External/high-risk action requires approval; not executed by planner."
          : undefined,
    planningOnly:
      Boolean(obj.planningOnly) &&
      !normalizedSteps.some(
        (s) =>
          s.produceArtifact ||
          s.actionType === "run_developer_task" ||
          s.actionType === "update_brand_calendar" ||
          s.actionType === "append_allowlisted_note" ||
          s.actionType === "run_image_studio_task" ||
          s.actionType === "stage_social_draft" ||
          s.actionType === "prepare_n8n_workflow",
      ),
  });
}

export class OllamaProvider implements ModelProvider {
  id = "ollama";
  label = `Ollama (${DEFAULT_MODEL})`;
  isLiveModel = true;
  modelId = DEFAULT_MODEL;

  private async tags(): Promise<string[]> {
    const res = await fetch(`${BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`Ollama /api/tags HTTP ${res.status}`);
    const data = (await res.json()) as { models?: { name?: string }[] };
    return (data.models ?? []).map((m) => m.name ?? "").filter(Boolean);
  }

  async listModels() {
    return this.tags();
  }

  async checkHealth() {
    try {
      const models = await this.tags();
      const guard = await inspectGpuGuard();
      const hasPreferred =
        models.includes(this.modelId) ||
        models.some((m) => m.startsWith(`${this.modelId}:`) || m.startsWith(`${DEFAULT_MODEL}`));
      const preferredPresent = models.some(
        (m) => m === this.modelId || m.startsWith(`${DEFAULT_MODEL}`),
      );
      return {
        healthy: preferredPresent || hasPreferred,
        modelId: this.modelId,
        models,
        gpuGuard: guard.details,
        details: preferredPresent
          ? `Model ${this.modelId} available. ${guard.details}`
          : `Ollama up but preferred model ${this.modelId} missing. Installed: ${models.join(", ") || "(none)"}. ${guard.details}`,
      };
    } catch (err) {
      return {
        healthy: false,
        modelId: this.modelId,
        details: err instanceof Error ? err.message : "Ollama unreachable",
      };
    }
  }

  async generateStructuredPlan(input: PlanContext): Promise<StructuredPlan> {
    if (!input.availableSpecialists.length) {
      throw new Error("No project-local specialists available for planning");
    }

    const health = await this.checkHealth();
    if (!health.healthy) {
      throw new Error(
        `Ollama planner unavailable: ${health.details ?? "unhealthy"}. Task will not be simulated.`,
      );
    }

    const guard = await inspectGpuGuard();
    const options: Record<string, unknown> = {
      temperature: 0.2,
      num_ctx: 4096,
    };
    // Avoid GPU contention with ComfyUI / Image Studio
    if (guard.recommendCpuOffload) {
      options.num_gpu = 0;
    }

    const started = Date.now();
    let lastError: unknown;
    // Weekly loop: plan shape is fixed; the model only writes the structured brief.
    const loopIntent = classifyOwnerIntent(input.title, input.objective);
    // Deterministic project loops: no GPU / Ollama call required.
    if (loopIntent.wantsGrupviUxLoop || loopIntent.wantsDreamitResearchLoop) {
      return sanitizePlan(
        {
          specialistTemplateKey: loopIntent.wantsGrupviUxLoop ? "ux-design" : "research",
        },
        input,
        { modelId: this.modelId, latencyMs: Date.now() - started },
      );
    }
    const weeklyLoop = loopIntent.wantsWeeklyContentLoop;
    const systemPrompt = weeklyLoop
      ? WEEKLY_BRIEF_SYSTEM_PROMPT
      : buildSystemPrompt(input.availableSpecialists);
    const brandPack =
      weeklyLoop && input.projectSlug === "autiq" ? loadAutiqBrandPack() : null;
    // Skip GPU brief generation when brand concept pack is incomplete.
    if (weeklyLoop && brandPack && !brandPack.ready) {
      return sanitizePlan(
        { brief: null, specialistTemplateKey: "marketing" },
        input,
        { modelId: this.modelId, latencyMs: Date.now() - started },
      );
    }
    const userPrompt = weeklyLoop
      ? buildWeeklyBriefUserPrompt(input, brandPack?.promptText ?? null)
      : buildUserPrompt(input);

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(`${BASE_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.modelId,
            stream: false,
            format: "json",
            options,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content:
                  attempt === 1
                    ? userPrompt
                    : `${userPrompt}\n\nPrevious output was invalid. Return ONLY valid JSON matching the schema.`,
              },
            ],
          }),
          signal: AbortSignal.timeout(180_000),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Ollama chat HTTP ${res.status}: ${body.slice(0, 300)}`);
        }

        const data = (await res.json()) as OllamaChatResponse;
        if (data.error) throw new Error(data.error);
        const content = data.message?.content ?? "";
        const parsed = extractJsonObject(content);
        if (weeklyLoop && attempt === 1 && !parseAndSanitizeWeeklyBrief(parsed)) {
          throw new Error("Weekly brief JSON did not match schema");
        }
        const latencyMs = Date.now() - started;
        return sanitizePlan(parsed, input, {
          modelId: data.model ?? this.modelId,
          latencyMs,
        });
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(
      `Ollama structured plan failed after retries: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }
}
