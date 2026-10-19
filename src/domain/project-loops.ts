/**
 * Project loops for Grupvi (UX) and DreamIT (research).
 * Deterministic plan shape — specialist report artifacts, no external publish.
 * Optional Ollama is not required; vault notes are cited as observed when present.
 */
import fs from "fs";
import path from "path";
import { buildSpecialistReport } from "@/domain/specialist-reports";
import type { StructuredPlan } from "@/domain/schemas";
import type { PlanContext } from "@/providers/types";
import {
  brandPackReadinessSummary,
  loadBrandPack,
} from "@/tools/brand-pack";
import { isPathAllowed, resolveWorkspace } from "@/tools/workspace";

type Step = StructuredPlan["steps"][number];

export {
  GRUPVI_UX_LOOP_SCHEDULE_TITLE,
  DREAMIT_RESEARCH_LOOP_SCHEDULE_TITLE,
} from "@/domain/loop-titles";
export const GRUPVI_UX_LOOP_RULE = "every_168h";
export const GRUPVI_UX_LOOP_TEMPLATE = {
  title: "Grupvi weekly UX loop: review, acceptance criteria, vault note",
  objective: [
    "Run the Grupvi weekly UX loop.",
    "1) UX specialist reviews StudieChat/Grupvi chat clarity and friction (evidence-first).",
    "2) Propose acceptance criteria for the next small improvement — do not invent user interviews.",
    "3) QA checkpoint: provenance labels, no secrets, no app publish/store release claimed.",
    "4) Append a short proposed note to the allowlisted grupvi vault (product/ux-notes.md) when safe.",
    "5) Do not merge, deploy, or ship to stores — drafts only.",
  ].join("\n"),
  origin: "operational" as const,
};

export const DREAMIT_RESEARCH_LOOP_RULE = "every_168h";
export const DREAMIT_RESEARCH_LOOP_TEMPLATE = {
  title: "DreamIT weekly research loop: problems, priorities, vault note",
  objective: [
    "Run the DreamIT weekly research loop.",
    "1) Research specialist lists candidate product problems and priorities with provenance.",
    "2) Do not invent customers, metrics, or unverified competitor claims.",
    "3) QA checkpoint: every claim labeled observed/inferred/proposed/blocked.",
    "4) Append a short proposed note to the allowlisted dreamit vault (product/notes.md) when safe.",
    "5) Do not publish externally or do customer outreach.",
  ].join("\n"),
  origin: "operational" as const,
};

const GRUPVI_MARKER =
  /\b(grupvi\s+weekly\s+ux\s+loop|weekly\s+grupvi\s+ux|grupvi\s+ux\s+loop|ugentlig[et]?\s+grupvi\s+ux)\b/i;
const DREAMIT_MARKER =
  /\b(dreamit\s+weekly\s+research\s+loop|weekly\s+dreamit\s+research|dreamit\s+research\s+loop|ugentlig[et]?\s+dreamit\s+research)\b/i;

export function isGrupviUxLoop(title: string, objective: string): boolean {
  return GRUPVI_MARKER.test(`${title}\n${objective}`);
}

export function isDreamitResearchLoop(title: string, objective: string): boolean {
  return DREAMIT_MARKER.test(`${title}\n${objective}`);
}

function pick(available: string[], preferred: string[], fallback: string): string {
  return preferred.find((k) => available.includes(k)) ?? fallback;
}

function readVaultExcerpt(workspaceId: string, relativePath: string, maxChars = 1200): string | null {
  try {
    const { config, absolutePath: root } = resolveWorkspace(workspaceId);
    if (!isPathAllowed(config, relativePath)) return null;
    const abs = path.join(root, relativePath);
    if (!fs.existsSync(abs)) return null;
    const raw = fs.readFileSync(abs, "utf8").trim();
    if (!raw) return null;
    return raw.slice(0, maxChars);
  } catch {
    return null;
  }
}

export function grupviUxLoopReasoning(specialist: string): string {
  return `Grupvi UX loop: ${specialist} review → QA → optional vault note. No app publish/store release.`;
}

export function dreamitResearchLoopReasoning(specialist: string): string {
  return `DreamIT research loop: ${specialist} brief → QA → optional vault note. No invented customers/metrics.`;
}

export function buildGrupviUxLoopSteps(
  input: PlanContext,
  opts: { plannerLabel: string },
): Step[] {
  const avail = input.availableSpecialists;
  const ux = pick(avail, ["ux-design", "design", "research"], avail[0] ?? "ux-design");
  const qa = pick(avail, ["qa", "security-qa"], ux);
  const stamp = Date.now();
  const vault = readVaultExcerpt("grupvi", "product/ux-notes.md");
  const pack = loadBrandPack("grupvi");
  const packNote = brandPackReadinessSummary(pack);

  const uxReport = buildSpecialistReport({
    projectName: input.projectName,
    projectSlug: input.projectSlug,
    title: `UX loop: ${input.title}`,
    objective: input.objective,
    templateKey: ux,
    projectMission: input.projectMission ?? null,
    plannerLabel: opts.plannerLabel,
    sources: [
      {
        label: "Owner / schedule objective",
        ref: "task://objective",
        provenance: "observed",
      },
      {
        label: "Grupvi brand pack",
        ref: "workspace://grupvi/brand/",
        provenance: pack.ready ? "observed" : "blocked",
        note: pack.ready
          ? pack.promptText.slice(0, 600)
          : packNote,
      },
      vault
        ? {
            label: "Vault product/ux-notes.md",
            ref: "workspace://grupvi/product/ux-notes.md",
            provenance: "observed",
            note: vault.slice(0, 400),
          }
        : {
            label: "Vault product/ux-notes.md",
            ref: "workspace://grupvi/product/ux-notes.md",
            provenance: "blocked",
            note: "File missing or empty — do not invent prior UX findings.",
          },
      {
        label: "Live StudieChat UI",
        ref: "unavailable",
        provenance: "blocked",
        note: "No automatic UI capture — screen claims stay proposed.",
      },
    ],
  });

  const qaReport = buildSpecialistReport({
    projectName: input.projectName,
    projectSlug: input.projectSlug,
    title: `QA checkpoint: Grupvi UX loop`,
    objective:
      "Check UX loop artifacts: provenance labels present, no invented interviews, no secrets, no store/deploy claimed.",
    templateKey: qa,
    projectMission: input.projectMission ?? null,
    plannerLabel: opts.plannerLabel,
  });

  const note =
    "Weekly UX loop: prefer one concrete clarity/friction fix next; no invented user quotes. (proposed)";

  const steps: Omit<Step, "sequence">[] = [
    {
      agentRole: "ceo",
      agentTemplateKey: "ceo",
      actionType: "receive_owner_request",
      summary: `FACCI CEO received Grupvi weekly UX loop for ${input.projectName}`,
      requiresApproval: false,
    },
    {
      agentRole: "manager",
      agentTemplateKey: "manager",
      actionType: "delegate_to_specialist",
      summary: `${input.projectName} Manager delegates UX loop: ${ux} → ${qa}`,
      requiresApproval: false,
    },
    {
      agentRole: "specialist",
      agentTemplateKey: ux,
      actionType: "write_local_artifact",
      summary: "UX specialist writes weekly review + proposed acceptance criteria",
      requiresApproval: false,
      produceArtifact: {
        kind: uxReport.kind,
        title: uxReport.title,
        filename: `${stamp}-${input.projectSlug}-ux-loop.md`,
        content: uxReport.content,
      },
    },
    {
      agentRole: "specialist",
      agentTemplateKey: qa,
      actionType: "write_local_artifact",
      summary: "QA checkpoint on UX loop drafts",
      requiresApproval: false,
      produceArtifact: {
        kind: qaReport.kind,
        title: qaReport.title,
        filename: `${stamp}-${input.projectSlug}-ux-loop-qa.md`,
        content: qaReport.content,
      },
    },
  ];

  if (input.projectSlug === "grupvi") {
    steps.push({
      agentRole: "specialist",
      agentTemplateKey: ux,
      actionType: "append_allowlisted_note",
      summary: "Append short proposed UX note to grupvi vault (allowlisted)",
      requiresApproval: false,
      riskLevel: "low",
      appendAllowlistedNote: {
        workspaceId: "grupvi",
        relativePath: "product/ux-notes.md",
        note,
      },
    });
  }

  steps.push({
    agentRole: "manager",
    agentTemplateKey: "manager",
    actionType: "verify_artifact",
    summary: "Manager verifies UX loop artifacts exist on disk",
    requiresApproval: false,
  });

  return steps.map((s, i) => ({ ...s, sequence: i + 1 }) as Step);
}

export function buildDreamitResearchLoopSteps(
  input: PlanContext,
  opts: { plannerLabel: string },
): Step[] {
  const avail = input.availableSpecialists;
  const research = pick(avail, ["research", "analytics"], avail[0] ?? "research");
  const qa = pick(avail, ["qa", "security-qa"], research);
  const stamp = Date.now();
  const vault = readVaultExcerpt("dreamit", "product/notes.md");
  const pack = loadBrandPack("dreamit");
  const packNote = brandPackReadinessSummary(pack);

  const researchReport = buildSpecialistReport({
    projectName: input.projectName,
    projectSlug: input.projectSlug,
    title: `Research loop: ${input.title}`,
    objective: input.objective,
    templateKey: research,
    projectMission: input.projectMission ?? null,
    plannerLabel: opts.plannerLabel,
    sources: [
      {
        label: "Owner / schedule objective",
        ref: "task://objective",
        provenance: "observed",
      },
      {
        label: "DREAMit brand pack",
        ref: "workspace://dreamit/brand/",
        provenance: pack.ready ? "observed" : "blocked",
        note: pack.ready
          ? pack.promptText.slice(0, 600)
          : packNote,
      },
      vault
        ? {
            label: "Vault product/notes.md",
            ref: "workspace://dreamit/product/notes.md",
            provenance: "observed",
            note: vault.slice(0, 400),
          }
        : {
            label: "Vault product/notes.md",
            ref: "workspace://dreamit/product/notes.md",
            provenance: "blocked",
            note: "File missing or empty — do not invent prior research.",
          },
      {
        label: "External web / competitor primary sources",
        ref: "unavailable",
        provenance: "blocked",
        note: "No live web fetch in this loop — keep claims proposed/blocked.",
      },
    ],
  });

  const qaReport = buildSpecialistReport({
    projectName: input.projectName,
    projectSlug: input.projectSlug,
    title: `QA checkpoint: DreamIT research loop`,
    objective:
      "Check research loop artifacts: no invented customers/metrics, provenance labels, no outreach claimed.",
    templateKey: qa,
    projectMission: input.projectMission ?? null,
    plannerLabel: opts.plannerLabel,
  });

  const note =
    "DREAMit weekly research loop: next focus = hobby→webshop friction candidates (proposed, not measured).";

  const steps: Omit<Step, "sequence">[] = [
    {
      agentRole: "ceo",
      agentTemplateKey: "ceo",
      actionType: "receive_owner_request",
      summary: `FACCI CEO received DreamIT weekly research loop for ${input.projectName}`,
      requiresApproval: false,
    },
    {
      agentRole: "manager",
      agentTemplateKey: "manager",
      actionType: "delegate_to_specialist",
      summary: `${input.projectName} Manager delegates research loop: ${research} → ${qa}`,
      requiresApproval: false,
    },
    {
      agentRole: "specialist",
      agentTemplateKey: research,
      actionType: "write_local_artifact",
      summary: "Research specialist writes weekly problems/priorities brief",
      requiresApproval: false,
      produceArtifact: {
        kind: researchReport.kind,
        title: researchReport.title,
        filename: `${stamp}-${input.projectSlug}-research-loop.md`,
        content: researchReport.content,
      },
    },
    {
      agentRole: "specialist",
      agentTemplateKey: qa,
      actionType: "write_local_artifact",
      summary: "QA checkpoint on research loop drafts",
      requiresApproval: false,
      produceArtifact: {
        kind: qaReport.kind,
        title: qaReport.title,
        filename: `${stamp}-${input.projectSlug}-research-loop-qa.md`,
        content: qaReport.content,
      },
    },
  ];

  if (input.projectSlug === "dreamit") {
    steps.push({
      agentRole: "specialist",
      agentTemplateKey: research,
      actionType: "append_allowlisted_note",
      summary: "Append short proposed research note to dreamit vault (allowlisted)",
      requiresApproval: false,
      riskLevel: "low",
      appendAllowlistedNote: {
        workspaceId: "dreamit",
        relativePath: "product/notes.md",
        note,
      },
    });
  }

  steps.push({
    agentRole: "manager",
    agentTemplateKey: "manager",
    actionType: "verify_artifact",
    summary: "Manager verifies research loop artifacts exist on disk",
    requiresApproval: false,
  });

  return steps.map((s, i) => ({ ...s, sequence: i + 1 }) as Step);
}
