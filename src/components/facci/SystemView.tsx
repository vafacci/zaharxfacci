"use client";

import { useState } from "react";
import { AppShell } from "./AppShell";
import { LoadingGate } from "./LoadingGate";
import { PageHeader } from "./PageHeader";
import { StatStrip } from "./StatStrip";
import { StatusBadge } from "./StatusBadge";
import { TechnicalDetails } from "./TechnicalDetails";
import { useOverview } from "./useOverview";
import {
  AUTIQ_WEEKLY_LOOP_SCHEDULE_TITLE,
  DREAMIT_RESEARCH_LOOP_SCHEDULE_TITLE,
  GRUPVI_UX_LOOP_SCHEDULE_TITLE,
} from "@/domain/loop-titles";

export function SystemView() {
  const { data, error, setError, loading, setLoading, refresh } = useOverview();
  const [busy, setBusy] = useState(false);
  const [perfProjectId, setPerfProjectId] = useState("");
  const [perfNote, setPerfNote] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [loopNote, setLoopNote] = useState<string | null>(null);

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

  const projects = data.organization?.projects ?? [];
  const orgBudget = (data.budgets ?? []).find((b) => !b.projectId);
  const validationTasks = data.tasks.filter((t) => t.origin === "validation");
  const autiqLoopSchedule = (data.schedules ?? []).find(
    (s) => s.project.slug === "autiq" && s.title === AUTIQ_WEEKLY_LOOP_SCHEDULE_TITLE,
  );
  const grupviLoopSchedule = (data.schedules ?? []).find(
    (s) => s.project.slug === "grupvi" && s.title === GRUPVI_UX_LOOP_SCHEDULE_TITLE,
  );
  const dreamitLoopSchedule = (data.schedules ?? []).find(
    (s) => s.project.slug === "dreamit" && s.title === DREAMIT_RESEARCH_LOOP_SCHEDULE_TITLE,
  );

  async function toggleSchedule(id: string, enabled: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fejl");
      if (json.pendingApprovalId) {
        setError(
          json.message ?? "Tidsplan afventer ejergodkendelse (gentagen opgave).",
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  async function autiqLoop(action: "request_enable" | "run_now") {
    setBusy(true);
    setLoopNote(null);
    try {
      const res = await fetch("/api/schedules/autiq-weekly-loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fejl");
      setLoopNote(
        action === "run_now"
          ? "Opgave sat i kø. Den stopper ved ejergodkendelse før publicering."
          : json.pendingApprovalId
            ? "Aktivering afventer din godkendelse under Godkendelser."
            : "AUTIQ-hjulet er aktivt.",
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  async function projectLoop(
    project: "grupvi" | "dreamit",
    action: "request_enable" | "run_now",
  ) {
    setBusy(true);
    setLoopNote(null);
    try {
      const res = await fetch("/api/schedules/project-loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fejl");
      const label = project === "grupvi" ? "Grupvi UX-loop" : "DreamIT research-loop";
      setLoopNote(
        action === "run_now"
          ? `${label} sat i kø (kun drafts — ingen publish).`
          : json.pendingApprovalId
            ? `${label}: aktivering afventer godkendelse.`
            : `${label} er aktivt.`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  async function runBackup() {
    setBusy(true);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "system" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Backup fejlede");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRemoteConsent() {
    if (!orgBudget) return;
    setBusy(true);
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthKey: data!.monthKey,
          remoteModelConsent: !orgBudget.remoteModelConsent,
          remoteModelMaxCalls: orgBudget.remoteModelConsent
            ? 0
            : Math.max(orgBudget.remoteModelMaxCalls, 5),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Budget-opdatering fejlede");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  async function runTeamPerformance() {
    const projectId = perfProjectId || projects[0]?.id;
    if (!projectId) return;
    setBusy(true);
    setPerfNote(null);
    try {
      const res = await fetch("/api/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, windowDays: 30 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Performance fejlede");
      setPerfNote(
        `Rapport gemt for ${projects.find((p) => p.id === projectId)?.name ?? "projekt"} (30 dage).`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  async function runPublishValidation() {
    const projectId = projects.find((p) => p.slug === "autiq")?.id ?? projects[0]?.id;
    if (!projectId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: "Publish social post now",
          objective: "Publish a finished caption to Instagram immediately.",
          origin: "validation",
          idempotencyKey: `validation-publish-${Date.now()}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Oprettelse fejlede");
      setShowValidation(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell planner={data.planner} approvalCount={data.approvals.length}>
      {error ? (
        <div className="mb-4 panel px-4 py-3 text-sm text-[var(--danger)]">{error}</div>
      ) : null}

      <PageHeader
        title="System"
        description="Avanceret drift: integrationer, tidsplaner, budgetter, metrics, backup og testværktøjer."
      />

      <StatStrip
        items={[
          { label: "I kø", value: data.counts.queued },
          { label: "Kører", value: data.counts.running, tone: "info" },
          {
            label: "Godkendelser",
            value: data.counts.waitingApproval,
            tone: data.counts.waitingApproval > 0 ? "warn" : "default",
          },
          { label: "Blokeret", value: data.counts.blocked, tone: "danger" },
        ]}
      />

      <section className="panel p-5 mb-4">
        <div className="panel-head">
          <h2 className="panel-title">Lokal AI & GPU</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <StatusBadge
            status={
              data.planner.isLiveModel && data.planner.health.healthy
                ? "online"
                : "offline"
            }
          />
          <span className="text-[var(--text-muted)]">{data.planner.label}</span>
          {data.gpuGuard?.comfyUiLikelyRunning ? (
            <span className="status-pill text-[var(--warn)]">ComfyUI aktiv — CPU-offload</span>
          ) : null}
        </div>
        <TechnicalDetails>
          <p>{data.demoLabel}</p>
          <p>plannerMode: {data.plannerMode ?? "—"}</p>
          <p>model: {data.planner.health.modelId ?? "—"}</p>
          <p>{data.planner.health.details ?? data.gpuGuard?.details ?? "—"}</p>
        </TechnicalDetails>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <section className="panel p-5">
          <div className="panel-head">
            <h2 className="panel-title">Integrationer</h2>
          </div>
          <ul className="space-y-2 text-sm">
            {data.tools.map((t) => (
              <li key={t.id} className="list-row !cursor-default">
                <div className="flex items-center justify-between gap-2">
                  <span className="list-row-title">{t.name}</span>
                  <StatusBadge status={t.state} />
                </div>
                {t.liveNote ? (
                  <span className="list-row-meta">{t.liveNote}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-5">
          <div className="panel-head">
            <h2 className="panel-title">Tidsplaner</h2>
            <span className="text-xs text-[var(--text-dim)]">
              {data.metrics?.totals.enabledSchedules ?? 0} aktive
            </span>
          </div>
          <div className="list-row !cursor-default space-y-2 mb-3">
            <div className="list-row-title text-xs">AUTIQ ugentligt content-hjul</div>
            <p className="list-row-meta">
              Marketing → kalender → QA → analytics (næste tema) → stop ved din
              godkendelse. FACCI publicerer aldrig selv.{" "}
              {autiqLoopSchedule
                ? autiqLoopSchedule.enabled
                  ? "Status: aktiv."
                  : "Status: deaktiveret."
                : "Status: ikke oprettet endnu."}
              {autiqLoopSchedule?.nextRunAt
                ? ` Næste kørsel: ${new Date(autiqLoopSchedule.nextRunAt).toLocaleString("da-DK")}.`
                : ""}
            </p>
            {data.flywheel?.nextThemeMemory ? (
              <p className="text-[0.7rem] text-[var(--text-muted)] leading-snug">
                <span className="text-[var(--text-dim)]">Næste tema (fra analytics): </span>
                {data.flywheel.nextThemeMemory.content.length > 280
                  ? `${data.flywheel.nextThemeMemory.content.slice(0, 277)}…`
                  : data.flywheel.nextThemeMemory.content}
              </p>
            ) : (
              <p className="text-[0.65rem] text-[var(--text-dim)]">
                Ingen next-theme memory endnu — kør hjulet én gang for at fylde den.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {!autiqLoopSchedule?.enabled ? (
                <button
                  type="button"
                  disabled={busy}
                  className="chip"
                  onClick={() => void autiqLoop("request_enable")}
                >
                  Anmod om aktivering
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                className="chip"
                onClick={() => void autiqLoop("run_now")}
              >
                Kør én gang nu
              </button>
            </div>
            {loopNote ? (
              <p className="text-[0.65rem] text-[var(--text-dim)]">{loopNote}</p>
            ) : null}
          </div>

          <div className="list-row !cursor-default space-y-2 mb-3">
            <div className="list-row-title text-xs">Grupvi ugentligt UX-loop</div>
            <p className="list-row-meta">
              UX-review → QA → vault-note. Ingen store/deploy.{" "}
              {grupviLoopSchedule
                ? grupviLoopSchedule.enabled
                  ? "Status: aktiv."
                  : "Status: deaktiveret."
                : "Status: ikke oprettet endnu."}
            </p>
            <div className="flex flex-wrap gap-2">
              {!grupviLoopSchedule?.enabled ? (
                <button
                  type="button"
                  disabled={busy}
                  className="chip"
                  onClick={() => void projectLoop("grupvi", "request_enable")}
                >
                  Anmod om aktivering
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                className="chip"
                onClick={() => void projectLoop("grupvi", "run_now")}
              >
                Kør én gang nu
              </button>
            </div>
          </div>

          <div className="list-row !cursor-default space-y-2 mb-3">
            <div className="list-row-title text-xs">DreamIT ugentligt research-loop</div>
            <p className="list-row-meta">
              Research-brief → QA → vault-note. Ingen opfundne metrics/outreach.{" "}
              {dreamitLoopSchedule
                ? dreamitLoopSchedule.enabled
                  ? "Status: aktiv."
                  : "Status: deaktiveret."
                : "Status: ikke oprettet endnu."}
            </p>
            <div className="flex flex-wrap gap-2">
              {!dreamitLoopSchedule?.enabled ? (
                <button
                  type="button"
                  disabled={busy}
                  className="chip"
                  onClick={() => void projectLoop("dreamit", "request_enable")}
                >
                  Anmod om aktivering
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                className="chip"
                onClick={() => void projectLoop("dreamit", "run_now")}
              >
                Kør én gang nu
              </button>
            </div>
          </div>

          {(data.schedules ?? []).length === 0 ? (
            <p className="text-xs text-[var(--text-dim)]">
              Ingen tidsplaner. Seed opretter deaktiverede eksempler.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(data.schedules ?? []).map((s) => (
                <li key={s.id} className="list-row !cursor-default space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="list-row-title text-xs">{s.title}</div>
                      <div className="list-row-meta">
                        {s.project.name} · {s.rule}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      className={`chip${s.enabled ? " active" : ""}`}
                      onClick={() => void toggleSchedule(s.id, s.enabled)}
                    >
                      {s.enabled ? "til" : "fra"}
                    </button>
                  </div>
                  <div className="text-[0.65rem] text-[var(--text-dim)]">
                    Næste:{" "}
                    {s.nextRunAt
                      ? new Date(s.nextRunAt).toLocaleString("da-DK")
                      : "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <section className="panel p-5">
          <div className="panel-head">
            <h2 className="panel-title">Budgetter ({data.monthKey ?? "—"})</h2>
          </div>
          {(data.budgets ?? []).length === 0 ? (
            <p className="text-xs text-[var(--text-dim)]">Ingen budgetter endnu.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(data.budgets ?? []).map((b) => {
                const label =
                  projects.find((p) => p.id === b.projectId)?.name ??
                  (b.projectId ? b.projectId.slice(0, 8) : "Organisation");
                return (
                  <li key={b.id} className="list-row !cursor-default text-xs space-y-1">
                    <div className="list-row-title text-sm">{label}</div>
                    <div>
                      Plan: {b.usedPlanCalls}/{b.maxPlanCalls} · Opgaver:{" "}
                      {b.usedTaskCreates}/{b.maxTaskCreates} · Billeder:{" "}
                      {b.usedImageGens}/{b.maxImageGens}
                    </div>
                    <div>
                      Remote: {b.usedRemoteCalls}/{b.remoteModelMaxCalls}
                      {b.remoteModelConsent ? " · samtykke" : " · intet samtykke"}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {orgBudget ? (
            <button
              type="button"
              disabled={busy}
              className="btn btn-ghost text-xs mt-3"
              onClick={() => void toggleRemoteConsent()}
            >
              {orgBudget.remoteModelConsent
                ? "Fjern remote-model samtykke"
                : "Giv remote-model samtykke (org)"}
            </button>
          ) : null}
        </section>

        <section className="panel p-5">
          <div className="panel-head">
            <h2 className="panel-title">Remote model</h2>
          </div>
          {data.remoteModel ? (
            <div className="text-sm space-y-2">
              <p>
                Status:{" "}
                {data.remoteModel.ready
                  ? "klar"
                  : data.remoteModel.enabled
                    ? "blokeret"
                    : "slået fra"}
              </p>
              {data.remoteModel.blockedReason ? (
                <p className="text-xs text-[var(--warn)]">{data.remoteModel.blockedReason}</p>
              ) : null}
              <TechnicalDetails>
                <p>provider: {data.remoteModel.provider}</p>
                <p>
                  API-nøgle:{" "}
                  {data.remoteModel.apiKeyConfigured ? "konfigureret" : "mangler"}
                </p>
                <p>{data.remoteModel.billingNote}</p>
              </TechnicalDetails>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-dim)]">Ingen remote-model status.</p>
          )}
        </section>
      </div>

      {data.metrics ? (
        <section className="panel p-5 mb-4">
          <div className="panel-head">
            <h2 className="panel-title">Projektmetrics</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            {data.metrics.projects.map((p) => (
              <div key={p.projectId} className="stat-tile">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)] space-y-0.5">
                  <div>
                    Opgaver: {p.tasks.total} · fuldført {p.tasks.completed}
                    {p.tasks.completionRate != null
                      ? ` (${p.tasks.completionRate}%)`
                      : ""}
                  </div>
                  <div>
                    Artefakter: {p.artifacts} · plan latency:{" "}
                    {p.avgPlanLatencyMs != null ? `${p.avgPlanLatencyMs} ms` : "—"}
                  </div>
                  <div>
                    Tidsplaner: {p.schedules.enabled}/{p.schedules.total} aktive
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[0.65rem] text-[var(--text-dim)]">
            Interne FACCI-DB metrics — ikke produkt-KPIs. Opdateret{" "}
            {new Date(data.metrics.generatedAt).toLocaleString("da-DK")}.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              className="field !py-1.5 !text-xs w-auto"
              value={perfProjectId || projects[0]?.id || ""}
              onChange={(e) => setPerfProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || projects.length === 0}
              className="btn btn-ghost text-xs"
              onClick={() => void runTeamPerformance()}
            >
              Gem team-performance (30 dage)
            </button>
            {perfNote ? (
              <span className="text-xs text-[var(--success)]">{perfNote}</span>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <section className="panel p-5">
          <div className="panel-head">
            <h2 className="panel-title">Backup</h2>
            <button
              type="button"
              disabled={busy}
              className="btn btn-ghost text-xs !py-1"
              onClick={() => void runBackup()}
            >
              Kør nu
            </button>
          </div>
          {(data.backups ?? []).length === 0 ? (
            <p className="text-xs text-[var(--text-dim)]">
              Ingen backups endnu. Worker laver også backup ved start.
            </p>
          ) : (
            <ul className="space-y-1 text-[0.65rem] text-[var(--text-muted)] font-mono">
              {(data.backups ?? []).map((b) => (
                <li key={b.relativePath}>
                  {b.relativePath} · {Math.round(b.bytes / 1024)} KB
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <div className="panel-head">
            <h2 className="panel-title">Aktivitet</h2>
          </div>
          <ul className="space-y-2 max-h-[280px] overflow-auto scrollbar-thin text-xs">
            {data.audit.map((e) => (
              <li key={e.id} className="border-b border-[var(--border-soft)] pb-2">
                <div className="text-[var(--text-muted)]">
                  {new Date(e.createdAt).toLocaleString("da-DK")}
                </div>
                <div>
                  <span className="text-[var(--accent)]">{e.actor}</span> {e.verb}{" "}
                  <span className="font-mono text-[var(--text-dim)]">
                    {e.target.slice(0, 12)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel p-5">
        <div className="panel-head">
          <h2 className="panel-title">Testværktøjer</h2>
        </div>
        <p className="text-xs text-[var(--text-dim)] mb-3">
          Valideringsopgaver og sikkerhedschecks — skjult fra Hjem/Opgaver som standard.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            disabled={busy || projects.length === 0}
            className="btn btn-danger-ghost text-xs"
            onClick={() => void runPublishValidation()}
          >
            Test: publish_post (skal blokeres)
          </button>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={showValidation}
              onChange={(e) => setShowValidation(e.target.checked)}
            />
            Vis valideringsopgaver
          </label>
        </div>
        {showValidation ? (
          validationTasks.length === 0 ? (
            <p className="text-xs text-[var(--text-dim)]">Ingen valideringsopgaver endnu.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {validationTasks.slice(0, 12).map((t) => (
                <li
                  key={t.id}
                  className="flex justify-between gap-2 border border-[var(--border-soft)] px-2 py-1.5"
                >
                  <span>{t.title}</span>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )
        ) : null}
        <TechnicalDetails title="Tællere">
          <p>
            projekter {data.counts.projects} · kø {data.counts.queued} · kører{" "}
            {data.counts.running} · godkendelse {data.counts.waitingApproval} · fuldført{" "}
            {data.counts.completed} · blokeret {data.counts.blocked}
          </p>
        </TechnicalDetails>
      </section>
    </AppShell>
  );
}
