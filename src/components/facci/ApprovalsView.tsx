"use client";

import { useState } from "react";
import { AppShell } from "./AppShell";
import { ApprovalInbox } from "./ApprovalInbox";
import { LoadingGate } from "./LoadingGate";
import { PageHeader } from "./PageHeader";
import { useOverview } from "./useOverview";

export function ApprovalsView() {
  const { data, error, setError, loading, setLoading, refresh } = useOverview();
  const [busy, setBusy] = useState(false);

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(true);
    try {
      const res = await fetch(`/api/approvals/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, decidedBy: "Human Owner" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Beslutning fejlede");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <LoadingGate
        loading={loading}
        error={error}
        onRetry={() => {
          setLoading(true);
          setError(null);
          void refresh();
        }}
      />
    );
  }

  return (
    <AppShell planner={data.planner} approvalCount={data.approvals.length}>
      {error ? (
        <div className="mb-4 panel px-4 py-3 text-sm text-[var(--danger)]">{error}</div>
      ) : null}

      <PageHeader
        title="Mine beslutninger"
        description="Én ting ad gangen. Godkendelse publicerer eller merger ikke automatisk — medmindre det er en lokal gentagen opgave."
      />

      <div className="max-w-2xl">
        <ApprovalInbox
          approvals={data.approvals}
          busy={busy}
          onDecide={decide}
        />
      </div>
    </AppShell>
  );
}
