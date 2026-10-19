"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./AppShell";
import { ArtifactViewer } from "./ArtifactViewer";
import { LoadingGate } from "./LoadingGate";
import { PageHeader } from "./PageHeader";
import { StatusBadge } from "./StatusBadge";
import { TechnicalDetails } from "./TechnicalDetails";
import { isActiveStatus, stepPlainSummary } from "./status";
import { useOverview } from "./useOverview";

type Filter = "active" | "waiting" | "done" | "all";

export function TasksView() {
  const search = useSearchParams();
  const { data, error, setError, loading, setLoading, refresh } = useOverview();
  const [filter, setFilter] = useState<Filter>("active");
  const [projectFilter, setProjectFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [artifactContent, setArtifactContent] = useState<string | null>(null);
  const [artifactTitle, setArtifactTitle] = useState<string | null>(null);
  const [artifactKind, setArtifactKind] = useState<string | null>(null);
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [artifactRef, setArtifactRef] = useState<string | null>(null);

  useEffect(() => {
    const id = search.get("id");
    const project = search.get("project");
    if (id) setSelectedId(id);
    if (project) {
      setProjectFilter(project);
      setFilter("all");
    }
  }, [search]);

  const tasks = useMemo(() => {
    if (!data) return [];
    return data.tasks.filter((t) => {
      if (t.origin === "validation") return false;
      if (projectFilter !== "all" && t.projectId !== projectFilter) return false;
      if (filter === "active") {
        return isActiveStatus(t.status);
      }
      if (filter === "waiting") return t.status === "waiting_approval";
      if (filter === "done") return t.status === "completed";
      return true;
    });
  }, [data, filter, projectFilter]);

  const selected = useMemo(() => {
    if (!data) return null;
    const allOps = data.tasks.filter((t) => t.origin !== "validation");
    return (
      allOps.find((t) => t.id === selectedId) ??
      tasks[0] ??
      allOps[0] ??
      null
    );
  }, [data, selectedId, tasks]);

  async function cancelTask(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Annulleret fra Opgaver" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Annullering fejlede");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  async function openArtifact(id: string, titleText: string, kind?: string, ref?: string) {
    setArtifactId(id);
    setArtifactKind(kind ?? null);
    setArtifactTitle(titleText);
    setArtifactRef(ref ?? null);
    if (kind === "generated-image") {
      setArtifactContent(null);
      return;
    }
    const res = await fetch(`/api/artifacts/${id}/content`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Artefakt mangler");
      return;
    }
    setArtifactContent(json.content);
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

  const projects = data.organization?.projects ?? [];
  const canCancel =
    selected &&
    ["queued", "planning", "running", "waiting_approval", "verifying"].includes(
      selected.status,
    );

  return (
    <AppShell planner={data.planner} approvalCount={data.approvals.length}>
      {error ? (
        <div className="mb-4 panel px-4 py-3 text-sm text-[var(--danger)]">{error}</div>
      ) : null}

      <PageHeader
        title="Opgaver"
        description="Status, resultater og forløb — uden valideringsstøj som standard."
        actions={
          <select
            className="field !py-1.5 !text-xs w-auto min-w-[10rem]"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">Alle projekter</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="chip-row">
        {(
          [
            ["active", "Aktive"],
            ["waiting", "Afventer dig"],
            ["done", "Færdige"],
            ["all", "Alle"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`chip${filter === key ? " active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="panel p-3 max-h-[70vh] overflow-auto scrollbar-thin">
          <div className="panel-head px-1">
            <h2 className="panel-title">Liste</h2>
            <span className="text-xs text-[var(--text-dim)] tabular-nums">{tasks.length}</span>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)] p-2">Ingen opgaver i dette filter.</p>
          ) : (
            <ul className="space-y-1.5">
              {tasks.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`list-row${selected?.id === t.id ? " active" : ""}`}
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <span className="list-row-title">{t.title}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="list-row-meta">{t.project.name}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected ? (
          <section className="panel p-5 md:p-6 slide-up">
            <div className="flex flex-wrap justify-between gap-3 mb-5">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight">{selected.title}</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
                  {selected.objective}
                </p>
                <p className="text-xs text-[var(--text-dim)] mt-2">
                  {selected.project.name}
                  {selected.assignedAgent ? ` · ${selected.assignedAgent.name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-start">
                <StatusBadge status={selected.status} />
                {canCancel ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-danger-ghost text-xs !py-1"
                    onClick={() => void cancelTask(selected.id)}
                  >
                    Annuller
                  </button>
                ) : null}
              </div>
            </div>

            {(selected.runs[0]?.errorMessage || selected.latestRunMeta?.errorMessage) && (
              <p className="text-sm text-[var(--warn)] mb-4">
                {selected.runs[0]?.errorMessage ?? selected.latestRunMeta?.errorMessage}
              </p>
            )}

            <div className="panel-title mb-2">Resultater</div>
            <div className="space-y-2 mb-5">
              {selected.artifacts.length === 0 ? (
                <p className="text-sm text-[var(--text-dim)]">Ingen resultater endnu.</p>
              ) : (
                selected.artifacts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="list-row"
                    onClick={() => void openArtifact(a.id, a.title, a.kind, a.storageRef)}
                  >
                    <span className="list-row-title">{a.title}</span>
                    <span className="list-row-meta">{a.kind ?? "resultat"}</span>
                  </button>
                ))
              )}
            </div>

            <div className="panel-title mb-2">Forløb</div>
            <ol className="space-y-2 mb-4">
              {(selected.runs[0]?.steps ?? []).map((s) => (
                <li key={s.id} className="list-row !cursor-default">
                  <div className="flex justify-between gap-2">
                    <span className="text-sm">{stepPlainSummary(s)}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <TechnicalDetails>
                    <p>actionType: {s.actionType}</p>
                    {s.inputSummary ? <p>input: {s.inputSummary}</p> : null}
                    {s.outputSummary ? <p>output: {s.outputSummary}</p> : null}
                  </TechnicalDetails>
                </li>
              ))}
              {(selected.runs[0]?.steps?.length ?? 0) === 0 ? (
                <li className="text-sm text-[var(--text-dim)]">
                  Afventer worker… (kør npm run worker)
                </li>
              ) : null}
            </ol>

            {selected.latestPlan ? (
              <TechnicalDetails title="AI-plan">
                <p>
                  {selected.latestPlan.isLiveModel ? "Live model" : "Ikke live / demo"}
                  {selected.latestPlan.modelId ? ` · ${selected.latestPlan.modelId}` : ""}
                  {selected.latestRunMeta?.planLatencyMs != null
                    ? ` · ${selected.latestRunMeta.planLatencyMs} ms`
                    : ""}
                </p>
                {selected.latestPlan.reasoningSummary ? (
                  <p className="whitespace-pre-wrap">{selected.latestPlan.reasoningSummary}</p>
                ) : null}
                <p>Plan ≠ automatisk udførelse — kun trin med evidence ovenfor er kørt.</p>
              </TechnicalDetails>
            ) : null}
          </section>
        ) : null}
      </div>

      <ArtifactViewer
        title={artifactTitle ?? ""}
        kind={artifactKind}
        id={artifactId}
        content={artifactContent}
        storageRef={artifactRef}
        onClose={() => {
          setArtifactContent(null);
          setArtifactTitle(null);
          setArtifactKind(null);
          setArtifactId(null);
          setArtifactRef(null);
        }}
      />
    </AppShell>
  );
}
