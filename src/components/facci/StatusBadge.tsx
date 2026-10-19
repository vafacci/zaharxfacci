import { statusLabel } from "./status";

function toneFor(status: string): string {
  if (
    ["completed", "approved", "online", "success"].includes(status) ||
    status === "enabled"
  ) {
    return "tone-success";
  }
  if (
    ["waiting_approval", "pending", "queued", "planning", "verifying", "warn"].includes(
      status,
    ) ||
    status === "research_only"
  ) {
    return "tone-warn";
  }
  if (["failed", "blocked", "cancelled", "rejected", "offline", "danger"].includes(status)) {
    return "tone-danger";
  }
  if (["running"].includes(status)) return "tone-info";
  if (["not_configured", "not_connected", "disabled"].includes(status)) return "tone-accent";
  return "";
}

export function StatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  return (
    <span className={`status-pill ${toneFor(status)} ${className}`.trim()}>
      {statusLabel(status)}
    </span>
  );
}
