"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./AppShell";
import { LoadingGate } from "./LoadingGate";
import { PageHeader } from "./PageHeader";
import { StatusBadge } from "./StatusBadge";
import { TechnicalDetails } from "./TechnicalDetails";
import { useOverview } from "./useOverview";

type Memory = {
  id: string;
  category: string;
  content: string;
  sourceRef: string | null;
  lastVerifiedAt: string | null;
};

export function ProjectsView() {
  const { data, error, setError, loading, setLoading, refresh } = useOverview();
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memCategory, setMemCategory] = useState("note");
  const [memContent, setMemContent] = useState("");
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [priority, setPriority] = useState(0);

  const projects = data?.organization?.projects ?? [];
  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? projects[0] ?? null,
    [projects, selectedId],
  );

  useEffect(() => {
    if (!selectedId && projects.length) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setPriority(
      data?.portfolio?.find((p) => p.id === selected.id)?.priority ?? 0,
    );
    void (async () => {
      try {
        const res = await fetch(`/api/memories?projectId=${selected.id}`);
        const json = await res.json();
        if (res.ok) setMemories(json.memories ?? []);
      } catch {
        // ignore
      }
    })();
  }, [selected, data?.portfolio]);

  const manager = selected?.agents.find((a) => a.role === "manager");
  const specialists = selected?.agents.filter((a) => a.role === "specialist") ?? [];
  const projectTasks = useMemo(
    () =>
      (data?.tasks ?? []).filter(
        (t) => t.projectId === selected?.id && t.origin !== "validation",
      ),
    [data, selected],
  );

  async function createProject() {
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          slug: newSlug,
          mission: `Nyt forretningsprojekt: ${newName}`,
          teamTemplates: ["developer", "marketing", "qa"],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Projektfejlede");
      setNewName("");
      setNewSlug("");
      setSelectedId(json.project.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  async function saveMemory() {
    if (!selected || !memContent.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selected.id,
          category: memCategory.trim() || "note",
          content: memContent.trim(),
          verify: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Hukommelse fejlede");
      setMemContent("");
      setMemories((prev) => [json.memory, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  async function savePriority() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selected.id, priority }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Prioritet fejlede");
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
        title="Projekter"
        description="Vælg et forretningsprojekt — se team, mission, hukommelse og seneste arbejde."
      />

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="panel p-3">
            <div className="panel-head px-1">
              <h2 className="panel-title">Portefølje</h2>
            </div>
            <ul className="space-y-1">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`side-nav-btn${selected?.id === p.id ? " active" : ""}`}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-4">
            <div className="panel-head">
              <h2 className="panel-title">Nyt projekt</h2>
            </div>
            <div className="space-y-2">
              <input
                className="field"
                placeholder="Navn"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setNewSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")
                      .slice(0, 40),
                  );
                }}
              />
              <input
                className="field font-mono text-sm"
                placeholder="slug"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !newName || !newSlug}
                onClick={() => void createProject()}
                className="btn btn-ghost w-full border-[var(--accent)] text-[var(--accent)]"
              >
                Opret
              </button>
            </div>
          </section>
        </aside>

        {selected ? (
          <div className="space-y-4">
            <section className="panel p-5 slide-up">
              <h2 className="text-xl font-semibold tracking-tight">{selected.name}</h2>
              <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
                {selected.mission ?? "Ingen mission angivet."}
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="stat-tile">
                  <div className="stat-label">Manager</div>
                  <div className="mt-1 text-sm font-medium">{manager?.name ?? "—"}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Specialister</div>
                  <div className="mt-1 text-sm font-medium tabular-nums">
                    {specialists.length}
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <div className="panel-title mb-2">Team</div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {specialists.map((s) => (
                    <li key={s.id} className="list-row !cursor-default">
                      <span className="list-row-title">{s.name}</span>
                      <span className="list-row-meta">{s.templateKey}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <TechnicalDetails title="Prioritet">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="field w-20"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-ghost text-xs"
                    onClick={() => void savePriority()}
                  >
                    Gem prioritet
                  </button>
                  <span className="text-[var(--text-dim)]">
                    Højere tal = FACCI tager dette projekt først i køen.
                  </span>
                </div>
              </TechnicalDetails>
            </section>

            <section className="panel p-5">
              <div className="panel-head">
                <h3 className="panel-title">Hukommelse</h3>
              </div>
              <div className="grid gap-2 md:grid-cols-[140px_1fr] mb-3">
                <input
                  className="field"
                  value={memCategory}
                  onChange={(e) => setMemCategory(e.target.value)}
                  placeholder="Kategori"
                />
                <input
                  className="field"
                  value={memContent}
                  onChange={(e) => setMemContent(e.target.value)}
                  placeholder="Ny note til projektet…"
                />
              </div>
              <button
                type="button"
                disabled={busy || !memContent.trim()}
                onClick={() => void saveMemory()}
                className="btn btn-ghost text-xs border-[var(--accent)] text-[var(--accent)]"
              >
                Gem note
              </button>
              <ul className="mt-4 space-y-2 max-h-[280px] overflow-auto scrollbar-thin">
                {memories.length === 0 ? (
                  <li className="text-sm text-[var(--text-dim)]">Ingen noter endnu.</li>
                ) : (
                  memories.slice(0, 20).map((m) => (
                    <li key={m.id} className="list-row !cursor-default">
                      <div className="text-xs text-[var(--text-dim)] mb-1">{m.category}</div>
                      <div className="text-sm text-[var(--text-muted)] whitespace-pre-wrap">
                        {m.content.slice(0, 400)}
                        {m.content.length > 400 ? "…" : ""}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="panel p-5">
              <div className="panel-head">
                <h3 className="panel-title">Seneste arbejde</h3>
                <Link href={`/tasks?project=${selected.id}`} className="text-xs text-[var(--accent)]">
                  Se i Opgaver
                </Link>
              </div>
              {projectTasks.length === 0 ? (
                <p className="text-sm text-[var(--text-dim)]">Ingen opgaver endnu.</p>
              ) : (
                <ul className="space-y-2">
                  {projectTasks.slice(0, 8).map((t) => (
                    <li key={t.id}>
                      <Link href={`/tasks?id=${t.id}`} className="list-row">
                        <div className="flex justify-between gap-2 items-start">
                          <span className="list-row-title">{t.title}</span>
                          <StatusBadge status={t.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
