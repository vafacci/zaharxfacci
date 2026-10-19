/**
 * M5 — evidence-oriented specialist report templates for UX / QA / research / analytics.
 * Provenance labels: observed | inferred | proposed | blocked.
 */

import { brandPackReportSource } from "@/tools/brand-pack";

export type Provenance = "observed" | "inferred" | "proposed" | "blocked";

export type VerifiedSource = {
  label: string;
  ref: string;
  provenance: Provenance;
  note?: string;
};

export function specialistReportKind(
  templateKey: string,
): "ux-review" | "qa-checklist" | "research-brief" | "analytics-snapshot" | "markdown" {
  if (templateKey === "ux-design" || templateKey === "design") return "ux-review";
  if (templateKey === "qa" || templateKey === "security-qa") return "qa-checklist";
  if (templateKey === "research") return "research-brief";
  if (templateKey === "analytics") return "analytics-snapshot";
  return "markdown";
}

export function buildSpecialistReport(params: {
  projectName: string;
  projectSlug: string;
  title: string;
  objective: string;
  templateKey: string;
  /** When provided, cited as observed mission text; otherwise project source is limited. */
  projectMission?: string | null;
  sources?: VerifiedSource[];
  plannerLabel?: string;
}): { kind: string; filename: string; title: string; content: string } {
  const kind = specialistReportKind(params.templateKey);
  const stamp = Date.now();
  const planner = params.plannerLabel ?? "FACCI specialist report";
  const mission = params.projectMission?.trim();
  const packSource = brandPackReportSource(params.projectSlug);
  const defaultSources: VerifiedSource[] =
    params.sources ??
    [
      {
        label: "Owner objective (this task)",
        ref: `task://objective`,
        provenance: "observed",
        note: "Verbatim owner request text inlined below — not invented requirements.",
      },
      mission
        ? {
            label: "Project mission (FACCI record)",
            ref: `project://${params.projectSlug}#mission`,
            provenance: "observed" as const,
            note: "Mission string from FACCI Project row (inlined under Context).",
          }
        : {
            label: "Project mission (FACCI record)",
            ref: `project://${params.projectSlug}`,
            provenance: "blocked" as const,
            note: "Mission text not supplied to this report builder — do not invent one.",
          },
      ...(packSource ? [packSource] : []),
      {
        label: "Live product UI / screenshots",
        ref: "unavailable",
        provenance: "blocked",
        note: "No automatic UI capture in M5 — findings about screens are proposed/hypotheses only.",
      },
      {
        label: "External web / competitor primary sources",
        ref: "unavailable",
        provenance: "blocked",
        note: "No live web fetch in M5 core path — do not invent citations.",
      },
      {
        label: "External product telemetry / customer analytics",
        ref: "unavailable",
        provenance: "blocked",
        note: "No live customer analytics connector — do not invent KPIs or user counts.",
      },
      {
        label: "FACCI internal task/artifact metrics",
        ref: "facci://metrics",
        provenance: kind === "analytics-snapshot" ? "observed" : "inferred",
        note:
          kind === "analytics-snapshot"
            ? "Consult Dashboard Projektmetrics (local DB). Not product growth metrics."
            : "Available in Dashboard; not automatically queried into this artifact body.",
      },
    ];

  const sourceTable = defaultSources
    .map(
      (s) =>
        `| ${s.label} | \`${s.ref}\` | **${s.provenance}** | ${s.note ?? "—"} |`,
    )
    .join("\n");

  let body: string;
  if (kind === "ux-review") {
    body = `# UX review — ${params.title}

> ${planner} · project **${params.projectName}** · specialist \`${params.templateKey}\`

## Objective
${params.objective}

## Context
- Project: **${params.projectName}** (\`${params.projectSlug}\`)
- Mission: ${mission ? mission : "_not supplied to report (blocked)_"}

## Scope (proposed)
- Review stated UX goals from the owner request only.
- Do **not** invent user research interviews or analytics that were not provided.
- Prefer actionable UI/flow hypotheses tied to the named product surface.
- Without screenshots/repo access, UI-specific claims stay **proposed** or **blocked**.

## Findings
1. **Clarity** *(proposed)* — Restate the primary user job in one sentence; confirm it matches the objective.
2. **Friction** *(inferred)* — List likely drop-off points implied by the objective (mark as hypotheses).
3. **Accessibility / readability** *(proposed)* — Note contrast, hierarchy, and mobile constraints to verify later.
4. **Evidence gaps** *(blocked)* — Call out missing screenshots, repo path, or user feedback.

## Recommended next tasks
- [ ] Capture 2–3 screenshots or a short walkthrough of the current UI
- [ ] Confirm acceptance criteria with owner before developer work
- [ ] Optional: scoped developer task once criteria are written

## Verified sources
| Source | Ref | Provenance | Note |
|---|---|---|---|
${sourceTable}

---
_M5 specialist report — evidence-first; no fabricated customer data._
`;
  } else if (kind === "qa-checklist") {
    body = `# QA checklist — ${params.title}

> ${planner} · project **${params.projectName}** · specialist \`${params.templateKey}\`

## Objective
${params.objective}

## Context
- Project: **${params.projectName}** (\`${params.projectSlug}\`)
- Mission: ${mission ? mission : "_not supplied to report (blocked)_"}

## Acceptance criteria (proposed)
1. Happy path matches the stated objective.
2. Failure / empty states are honest (no fake success).
3. No cross-project data leakage in UI or artifacts.
4. Sensitive actions remain approval-gated.

## Test matrix
| Case | Steps | Expected | Provenance |
|---|---|---|---|
| Smoke | Open relevant surface; perform primary action | Completes or shows clear blocker | proposed |
| Isolation | Filter/tasks for this project only | Other projects' private items absent | proposed |
| Regression | Re-run prior related task if any | Status + artifact still consistent | inferred |
| Negative | Attempt forbidden external action | waiting_approval or blocked — never claimed success | proposed |

## Limitations
- This artifact is a **checklist plan**, not proof that tests ran.
- Rows stay **proposed** until command/output evidence is attached.

## Evidence to attach later
- Command/test output paths (when developer workspace is configured)
- Artifact IDs from FACCI
- Explicit **blocked** notes when workspace/repo path is missing

## Verified sources
| Source | Ref | Provenance | Note |
|---|---|---|---|
${sourceTable}

---
_M5 QA report — checklists only; does not claim tests were executed unless evidence exists._
`;
  } else if (kind === "research-brief") {
    body = `# Research brief — ${params.title}

> ${planner} · project **${params.projectName}** · specialist \`${params.templateKey}\`

## Objective
${params.objective}

## Context
- Project: **${params.projectName}** (\`${params.projectSlug}\`)
- Mission: ${mission ? mission : "_not supplied to report (blocked)_"}

## Method
- Prefer public, citable sources and owner-supplied facts.
- Label every claim: **observed** / **inferred** / **proposed** / **blocked**.
- Never invent competitors' private metrics or customer quotes.

## Key questions
1. What problem is stated in the owner objective?
2. What is already known inside FACCI project memory?
3. What must be verified externally before acting?

## Findings
### Observed
- Owner objective as written (see sources).
${mission ? `- Project mission: ${mission}` : "- Project mission: not supplied to this report."}

### Inferred
- Likely priorities implied by wording — treat as hypotheses until confirmed.

### Proposed follow-ups
- Narrow one concrete investigation with a verifiable source.
- Convert confirmed findings into scoped tasks (developer / UX / marketing).

### Blocked
- Live web fetch / REA deep analysis not auto-enabled in M5 core path.
- No proprietary API reverse-engineering.
- No fabricated competitor quotes, rankings, or market-share numbers.

## Verified sources
| Source | Ref | Provenance | Note |
|---|---|---|---|
${sourceTable}

---
_M5 research brief — cite or mark blocked; no invented market data._
`;
  } else if (kind === "analytics-snapshot") {
    body = `# Analytics snapshot — ${params.title}

> ${planner} · project **${params.projectName}** · specialist \`${params.templateKey}\`

## Objective
${params.objective}

## Context
- Project: **${params.projectName}** (\`${params.projectSlug}\`)
- Mission: ${mission ? mission : "_not supplied to report (blocked)_"}

## Honest data posture
FACCI M5 exposes **internal** project metrics (tasks, artifacts, plan latency) from the local database via Dashboard → Projektmetrics / \`/api/metrics\`.
This template does **not** embed a live metrics snapshot unless a caller injects one.
External product analytics are **blocked** until an authorized connector exists.

## Internal metrics to consult (not auto-pasted here)
- Per-project task status mix, completion rate, artifact count, avg plan latency
- Do not present internal FACCI queue depth as user growth or revenue

## Recommendations
1. Open Dashboard Projektmetrics for stalled / failed tasks *(observed in FACCI DB when viewed)*.
2. Define 1–2 product KPIs the owner actually wants — then wire a real source later *(proposed)*.
3. Avoid vanity charts without a verified feed *(blocked)*.

## Verified sources
| Source | Ref | Provenance | Note |
|---|---|---|---|
${sourceTable}

---
_M5 analytics — internal DB metrics only unless a verified external source is configured._
`;
  } else {
    body = `# ${params.title}

> ${planner} · project **${params.projectName}**

## Objective
${params.objective}

## Notes
Draft specialist output. Label claims with provenance when making factual assertions.

## Verified sources
| Source | Ref | Provenance | Note |
|---|---|---|---|
${sourceTable}
`;
  }

  return {
    kind,
    title: params.title,
    filename: `${stamp}-${params.projectSlug}-${kind}.md`,
    content: body,
  };
}
