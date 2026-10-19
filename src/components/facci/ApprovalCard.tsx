"use client";

import {
  approvalBody,
  approvalConsequence,
  approvalContext,
  approvalTitle,
  isExternalApproval,
  type ApprovalLike,
} from "./approvalCopy";

export function ApprovalCard({
  approval,
  busy,
  onDecide,
}: {
  approval: ApprovalLike & { id: string };
  busy: boolean;
  onDecide: (id: string, decision: "approved" | "rejected") => void;
}) {
  const external = isExternalApproval(approval.actionType);

  return (
    <article className="approval-card">
      <div className="approval-card-kicker">
        <span className={`approval-dot${external ? " warn" : ""}`} aria-hidden />
        Afventer dig
      </div>
      <h3 className="approval-card-title">{approvalTitle(approval.actionType)}</h3>
      <p className="approval-card-context">{approvalContext(approval)}</p>
      <p className="approval-card-body">{approvalBody(approval)}</p>
      <p className="approval-card-hint">{approvalConsequence(approval.actionType)}</p>

      <div className="approval-actions">
        <button
          type="button"
          disabled={busy}
          className="btn btn-primary approval-yes"
          onClick={() => onDecide(approval.id, "approved")}
        >
          Ja, godkend
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn approval-no"
          onClick={() => onDecide(approval.id, "rejected")}
        >
          Nej
        </button>
      </div>

      <details className="approval-tech">
        <summary>Mere info</summary>
        <p>{approval.actionSummary}</p>
        <p className="font-mono text-[0.65rem] opacity-70">
          {approval.actionType} · risiko {approval.riskLevel}
        </p>
      </details>
    </article>
  );
}
