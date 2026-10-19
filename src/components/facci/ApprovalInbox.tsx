"use client";

import { useEffect, useState } from "react";
import { ApprovalCard } from "./ApprovalCard";
import { approvalTitle, type ApprovalLike } from "./approvalCopy";

type Item = ApprovalLike & { id: string };

export function ApprovalInbox({
  approvals,
  busy,
  onDecide,
}: {
  approvals: Item[];
  busy: boolean;
  onDecide: (id: string, decision: "approved" | "rejected") => void;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!approvals.length) {
      setFocusId(null);
      return;
    }
    if (!focusId || !approvals.some((a) => a.id === focusId)) {
      setFocusId(approvals[0].id);
    }
  }, [approvals, focusId]);

  if (approvals.length === 0) {
    return (
      <section className="approval-empty panel">
        <div className="approval-empty-mark" aria-hidden>
          ✓
        </div>
        <h2 className="approval-empty-title">Intet at godkende</h2>
        <p className="approval-empty-text">
          Når FACCI har brug for dig, dukker det op her — én beslutning ad gangen.
        </p>
      </section>
    );
  }

  const focused = approvals.find((a) => a.id === focusId) ?? approvals[0];
  const rest = approvals.filter((a) => a.id !== focused.id);

  return (
    <section className="approval-inbox panel slide-up">
      <header className="approval-inbox-head">
        <div>
          <p className="panel-title">Din beslutning</p>
          <p className="approval-inbox-sub">
            {approvals.length === 1
              ? "1 ting venter"
              : `${approvals.length} ting venter — tag den øverste først`}
          </p>
        </div>
        <span className="approval-count">{approvals.length}</span>
      </header>

      <ApprovalCard approval={focused} busy={busy} onDecide={onDecide} />

      {rest.length > 0 ? (
        <div className="approval-queue">
          <p className="approval-queue-label">Derefter</p>
          <ul className="approval-queue-list">
            {rest.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="approval-queue-item"
                  onClick={() => setFocusId(a.id)}
                >
                  <span className="approval-queue-title">
                    {approvalTitle(a.actionType)}
                  </span>
                  <span className="approval-queue-meta">
                    {a.task.project.name} · {a.task.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
