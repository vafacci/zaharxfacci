export type ApprovalLike = {
  actionType: string;
  actionSummary: string;
  riskLevel: string;
  task: { title: string; project: { name: string } };
};

export function approvalTitle(actionType: string): string {
  if (actionType === "enable_recurring_job") return "Aktivér gentagen opgave?";
  if (actionType === "publish_post" || actionType === "request_publish_post") {
    return "Må FACCI registrere en publicering?";
  }
  if (actionType === "merge_code" || actionType === "request_merge_code") {
    return "Må FACCI registrere en kode-merge?";
  }
  return "Skal FACCI gå videre?";
}

export function approvalConsequence(actionType: string): string {
  if (actionType === "enable_recurring_job") {
    return "Ja aktiverer den lokale tidsplan. Nej lader den være slået fra.";
  }
  if (
    /publish|merge|push|deploy/i.test(actionType) &&
    actionType !== "enable_recurring_job"
  ) {
    return "Ja gemmer din godkendelse. FACCI publicerer eller merger ikke automatisk.";
  }
  return "Ja lader FACCI fortsætte. Nej stopper den her.";
}

export function approvalContext(a: ApprovalLike): string {
  return `${a.task.project.name} · ${a.task.title}`;
}

/** Short owner-facing body; raw technical summary stays collapsed. */
export function approvalBody(a: ApprovalLike): string {
  const raw = a.actionSummary?.trim() ?? "";
  if (!raw) return "FACCI beder dig tage stilling før næste skridt.";
  // Prefer first sentence / short clause
  const cut = raw.split(/(?<=[.!?])\s+/)[0] ?? raw;
  return cut.length > 160 ? `${cut.slice(0, 157)}…` : cut;
}

export function isExternalApproval(actionType: string): boolean {
  return (
    /publish|merge|push|deploy/i.test(actionType) &&
    actionType !== "enable_recurring_job"
  );
}
