const STATUS_DA: Record<string, string> = {
  draft: "kladde",
  queued: "i kø",
  planning: "planlægger",
  waiting_approval: "afventer dig",
  running: "kører",
  verifying: "verificerer",
  completed: "fuldført",
  failed: "fejlet",
  blocked: "blokeret",
  cancelled: "annulleret",
  pending: "afventer",
  approved: "godkendt",
  rejected: "afvist",
  online: "online",
  offline: "offline",
  not_configured: "ikke konfigureret",
  not_connected: "ikke forbundet",
  research_only: "kun forskning",
  disabled: "deaktiveret",
};

export function statusLabel(s: string) {
  return STATUS_DA[s] ?? s;
}

const ACTIVE = new Set(["queued", "planning", "running", "verifying"]);

export function isActiveStatus(s: string) {
  return ACTIVE.has(s);
}

export function approvalPlainLabel(actionType: string): string {
  // Kept for any remaining call sites; prefer approvalCopy.approvalTitle for UI.
  if (actionType === "enable_recurring_job") return "Aktivér gentagen opgave";
  if (actionType === "publish_post" || actionType === "request_publish_post") {
    return "Publicér indhold";
  }
  if (actionType === "merge_code" || actionType === "request_merge_code") {
    return "Merge / push kode";
  }
  return actionType.replace(/_/g, " ");
}

export function stepPlainSummary(step: {
  agent: { name: string } | null;
  actionType: string;
  inputSummary: string | null;
  outputSummary: string | null;
}): string {
  const who = step.agent?.name ?? "FACCI";
  const out = step.outputSummary?.trim();
  if (out) return `${who}: ${out}`;
  const inp = step.inputSummary?.trim();
  if (inp) return `${who}: ${inp}`;
  return `${who} · ${step.actionType.replace(/_/g, " ")}`;
}
