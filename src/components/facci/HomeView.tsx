"use client";

import { useState } from "react";
import { AppShell } from "./AppShell";
import { ChatPanel } from "./ChatPanel";
import { LoadingGate } from "./LoadingGate";
import { useOverview } from "./useOverview";

export function HomeView() {
  const { data, error, setError, loading, setLoading, refresh } = useOverview();
  const [busy, setBusy] = useState(false);

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

      <ChatPanel
        data={data}
        busy={busy}
        setBusy={setBusy}
        setError={setError}
        refresh={refresh}
      />
    </AppShell>
  );
}
