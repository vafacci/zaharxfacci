"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Checkpoint = { id: string; label: string; done: boolean };
type Todo = { id: string; task: string; owner: string; status: string };
type Done = { id: string; task: string; date: string; owner?: string };
type Resource = { id: string; title: string; url: string; note: string };

type Workspace = {
  liveApp: string;
  liveLanding: string;
  exampleProject: string;
  focus: string;
  notes: string;
  checkpoints: Checkpoint[];
  todos: Todo[];
  done: Done[];
  resources: Resource[];
};

const OWNERS = [
  { value: "", label: "Hvem?" },
  { value: "Dayan", label: "Dayan" },
  { value: "Zahar", label: "Zahar" },
  { value: "Begge", label: "Begge" },
] as const;

/** How many completed tasks to show before "Vis alle". */
const DONE_PREVIEW = 8;

function ownerKey(owner: string | undefined): string {
  const o = (owner ?? "").toLowerCase();
  return o === "dayan" || o === "zahar" || o === "begge" ? o : "none";
}

function OwnerChip({ owner }: { owner?: string }) {
  if (!owner) return null;
  return (
    <span className={`gws-chip gws-chip-${ownerKey(owner)}`}>
      <span className="gws-chip-dot" aria-hidden />
      {owner}
    </span>
  );
}

function dayDiff(iso: string): number | null {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

function dayLabel(iso: string): string {
  const diff = dayDiff(iso);
  if (diff === 0) return "I dag";
  if (diff === 1) return "I går";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso || "Uden dato";
  return d.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" });
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PartnerGrupviView() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedHint, setSavedHint] = useState("");
  const [focus, setFocusLocal] = useState("");
  const [notes, setNotesLocal] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newResourceTitle, setNewResourceTitle] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [newResourceNote, setNewResourceNote] = useState("");
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [showAllDone, setShowAllDone] = useState(false);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/partner/grupvi/hq", { cache: "no-store" });
    if (res.status === 401) {
      window.location.assign(`/partner-login?next=${encodeURIComponent("/partner/grupvi")}`);
      return;
    }
    const json = (await res.json()) as Workspace & { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Kunne ikke hente Grupvi");
    setWs(json);
    setFocusLocal(json.focus ?? "");
    setNotesLocal(json.notes ?? "");
  }, []);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Fejl"));
  }, [load]);

  async function patch(body: Record<string, unknown>, opts?: { silent?: boolean }) {
    if (!opts?.silent) {
      setBusy(true);
      setError("");
    }
    try {
      const res = await fetch("/api/partner/grupvi/hq", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.status === 401) {
        window.location.assign(`/partner-login?next=${encodeURIComponent("/partner/grupvi")}`);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Kunne ikke gemme");
      await load();
      setSavedHint("Gemt");
      window.setTimeout(() => setSavedHint(""), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      if (!opts?.silent) setBusy(false);
    }
  }

  function scheduleSave(op: "focus" | "notes", value: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSavedHint("Gemmer…");
    saveTimer.current = setTimeout(() => {
      void patch({ op, [op]: value }, { silent: true });
    }, 700);
  }

  const doneCount = ws?.checkpoints.filter((c) => c.done).length ?? 0;
  const totalCp = ws?.checkpoints.length ?? 0;
  const openCount = ws?.todos.length ?? 0;
  const completedCount = ws?.done.length ?? 0;
  const goalPct = totalCp ? Math.round((doneCount / totalCp) * 100) : 0;

  const doneThisWeek = useMemo(
    () =>
      (ws?.done ?? []).filter((d) => {
        const diff = dayDiff(d.date);
        return diff !== null && diff >= 0 && diff < 7;
      }).length,
    [ws?.done],
  );

  /** Completed tasks, newest first, grouped by day. */
  const doneGroups = useMemo(() => {
    const sorted = [...(ws?.done ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const visible = showAllDone ? sorted : sorted.slice(0, DONE_PREVIEW);
    const groups: { date: string; items: Done[] }[] = [];
    for (const d of visible) {
      const last = groups[groups.length - 1];
      if (last && last.date === d.date) last.items.push(d);
      else groups.push({ date: d.date, items: [d] });
    }
    return groups;
  }, [ws?.done, showAllDone]);

  return (
    <div className="partner-page gws">
      <header className="gws-hero">
        <div className="gws-hero-text">
          <p className="gws-kicker">
            <span className="gws-live" aria-hidden />
            FACCI × ZAHAR · Projekt
          </p>
          <h1 className="gws-title">Grupvi</h1>
          <p className="gws-lead">Fokus, opgaver, links og noter — ét sted.</p>
        </div>
        <div className="gws-hero-meta">
          <span className="gws-saved" aria-live="polite">
            {savedHint}
          </span>
          <a
            className="gws-btn"
            href={ws?.liveLanding ?? "https://studiechat.vercel.app/"}
            target="_blank"
            rel="noreferrer"
          >
            Landingside
          </a>
          <a
            className="gws-btn primary"
            href={ws?.liveApp ?? "https://studiechat.vercel.app/app"}
            target="_blank"
            rel="noreferrer"
          >
            Åbn appen ↗
          </a>
        </div>
      </header>

      {error ? (
        <p className="gws-error" role="alert">
          {error}
        </p>
      ) : null}

      {!ws ? (
        <p className="gws-loading">Henter siden…</p>
      ) : (
        <>
          <section className="gws-kpis" aria-label="Status">
            <div className="gws-kpi">
              <span className="gws-kpi-label">Mål nået</span>
              <strong className="gws-kpi-value">
                {doneCount}
                <small>/{totalCp}</small>
              </strong>
              <div className="gws-meter" aria-hidden>
                <span style={{ width: `${goalPct}%` }} />
              </div>
            </div>
            <div className="gws-kpi">
              <span className="gws-kpi-label">I gang</span>
              <strong className="gws-kpi-value">{openCount}</strong>
              <span className="gws-kpi-sub">åbne opgaver</span>
            </div>
            <div className="gws-kpi">
              <span className="gws-kpi-label">Færdige</span>
              <strong className="gws-kpi-value ok">{completedCount}</strong>
              <span className="gws-kpi-sub">i alt</span>
            </div>
            <div className="gws-kpi">
              <span className="gws-kpi-label">Denne uge</span>
              <strong className="gws-kpi-value">{doneThisWeek}</strong>
              <span className="gws-kpi-sub">færdige de sidste 7 dage</span>
            </div>
          </section>

          <div className="gws-grid">
            <div className="gws-col">
              <section className="gws-card gws-focus-card">
                <h2 className="gws-h">Det vigtigste lige nu</h2>
                <textarea
                  className="gws-focus"
                  value={focus}
                  rows={2}
                  disabled={busy}
                  placeholder="Skriv med almindelige ord, hvad I prioriterer i denne uge…"
                  onChange={(e) => {
                    setFocusLocal(e.target.value);
                    scheduleSave("focus", e.target.value);
                  }}
                />
              </section>

              <section className="gws-card">
                <div className="gws-card-head">
                  <h2 className="gws-h">Opgaver</h2>
                  <span className="gws-count">{openCount}</span>
                </div>

                <ul className="gws-tasks">
                  {ws.todos.length === 0 ? (
                    <li className="gws-empty">Ingen åbne opgaver. Skriv den næste herunder.</li>
                  ) : (
                    ws.todos.map((t) => (
                      <li key={t.id} className="gws-task">
                        <button
                          type="button"
                          className="gws-task-check"
                          title="Markér som færdig"
                          disabled={busy}
                          onClick={() => void patch({ op: "todo_complete", id: t.id })}
                          aria-label={`Markér som færdig: ${t.task}`}
                        >
                          <CheckIcon />
                        </button>
                        <span className="gws-task-text">{t.task}</span>
                        <select
                          className={`gws-owner gws-owner-${ownerKey(t.owner)}`}
                          value={t.owner}
                          disabled={busy}
                          aria-label="Hvem tager den?"
                          onChange={(e) =>
                            void patch({ op: "todo_owner", id: t.id, owner: e.target.value })
                          }
                        >
                          {OWNERS.map((o) => (
                            <option key={o.value || "none"} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="gws-icon-btn"
                          disabled={busy}
                          title="Slet opgave"
                          aria-label={`Slet opgave: ${t.task}`}
                          onClick={() => void patch({ op: "todo_delete", id: t.id })}
                        >
                          ×
                        </button>
                      </li>
                    ))
                  )}
                </ul>

                <form
                  className="gws-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newTask.trim()) return;
                    void patch({ op: "todo_add", task: newTask, owner: newOwner }).then(() => {
                      setNewTask("");
                    });
                  }}
                >
                  <input
                    className="gws-input"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="+ Ny opgave…"
                    disabled={busy}
                  />
                  <select
                    className="gws-owner"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    disabled={busy}
                    aria-label="Hvem tager den?"
                  >
                    {OWNERS.map((o) => (
                      <option key={o.value || "none"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="gws-btn primary" disabled={busy || !newTask.trim()}>
                    Tilføj
                  </button>
                </form>
              </section>

              <section className="gws-card gws-done-card">
                <div className="gws-card-head">
                  <h2 className="gws-h">Færdige opgaver</h2>
                  <span className="gws-count ok">{completedCount}</span>
                </div>

                {completedCount === 0 ? (
                  <p className="gws-empty">
                    Når I krydser en opgave af, havner den her — med dato og hvem der lavede den.
                  </p>
                ) : (
                  <>
                    <div className="gws-timeline">
                      {doneGroups.map((g) => (
                        <div key={g.date} className="gws-day">
                          <p className="gws-day-label">{dayLabel(g.date)}</p>
                          <ul className="gws-done-list">
                            {g.items.map((d) => (
                              <li key={`${d.id}-${d.date}`} className="gws-done-item">
                                <span className="gws-done-mark" aria-hidden>
                                  <CheckIcon />
                                </span>
                                <span className="gws-done-text">{d.task}</span>
                                <OwnerChip owner={d.owner} />
                                <button
                                  type="button"
                                  className="gws-undo"
                                  disabled={busy}
                                  title="Flyt tilbage til opgaver"
                                  onClick={() => void patch({ op: "todo_reopen", id: d.id })}
                                >
                                  Fortryd
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    {completedCount > DONE_PREVIEW ? (
                      <button
                        type="button"
                        className="gws-more"
                        onClick={() => setShowAllDone((v) => !v)}
                      >
                        {showAllDone ? "Vis færre" : `Vis alle ${completedCount}`}
                      </button>
                    ) : null}
                  </>
                )}
              </section>
            </div>

            <div className="gws-col">
              <section className="gws-card">
                <div className="gws-card-head">
                  <h2 className="gws-h">Mål</h2>
                  <span className="gws-pct">{goalPct}%</span>
                </div>
                <div className="gws-meter lg" aria-hidden>
                  <span style={{ width: `${goalPct}%` }} />
                </div>
                <ul className="gws-checks">
                  {ws.checkpoints.map((c) => (
                    <li key={c.id}>
                      <label className={`gws-check${c.done ? " done" : ""}`}>
                        <input
                          type="checkbox"
                          checked={c.done}
                          disabled={busy}
                          onChange={(e) =>
                            void patch({ op: "checkpoint", id: c.id, done: e.target.checked })
                          }
                        />
                        <span className="gws-check-box" aria-hidden>
                          <CheckIcon />
                        </span>
                        <span>{c.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="gws-card">
                <div className="gws-card-head">
                  <h2 className="gws-h">Links</h2>
                  <button
                    type="button"
                    className="gws-link-btn"
                    onClick={() => setShowResourceForm((v) => !v)}
                  >
                    {showResourceForm ? "Luk" : "+ Tilføj"}
                  </button>
                </div>

                {showResourceForm ? (
                  <form
                    className="gws-resource-add"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newResourceTitle.trim() || !newResourceUrl.trim()) return;
                      void patch({
                        op: "resource_add",
                        title: newResourceTitle,
                        url: newResourceUrl,
                        note: newResourceNote,
                      }).then(() => {
                        setNewResourceTitle("");
                        setNewResourceUrl("");
                        setNewResourceNote("");
                        setShowResourceForm(false);
                      });
                    }}
                  >
                    <input
                      className="gws-input"
                      value={newResourceTitle}
                      onChange={(e) => setNewResourceTitle(e.target.value)}
                      placeholder="Titel (fx Brand pack)"
                      disabled={busy}
                    />
                    <input
                      className="gws-input"
                      value={newResourceUrl}
                      onChange={(e) => setNewResourceUrl(e.target.value)}
                      placeholder="Link (https://…)"
                      disabled={busy}
                      inputMode="url"
                    />
                    <input
                      className="gws-input"
                      value={newResourceNote}
                      onChange={(e) => setNewResourceNote(e.target.value)}
                      placeholder="Kort note (valgfri)"
                      disabled={busy}
                    />
                    <button
                      type="submit"
                      className="gws-btn primary"
                      disabled={busy || !newResourceTitle.trim() || !newResourceUrl.trim()}
                    >
                      Gem link
                    </button>
                  </form>
                ) : null}

                <ul className="gws-resources">
                  {(ws.resources ?? []).length === 0 ? (
                    <li className="gws-empty">Ingen links endnu.</li>
                  ) : (
                    (ws.resources ?? []).map((r) => (
                      <li key={r.id} className="gws-resource">
                        <div className="gws-resource-main">
                          <input
                            className="gws-resource-title"
                            value={titleDrafts[r.id] ?? r.title}
                            disabled={busy}
                            aria-label="Link-titel"
                            onChange={(e) =>
                              setTitleDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                            }
                            onBlur={() => {
                              const next = (titleDrafts[r.id] ?? r.title).trim();
                              if (!next) {
                                setTitleDrafts((d) => {
                                  const copy = { ...d };
                                  delete copy[r.id];
                                  return copy;
                                });
                                return;
                              }
                              if (next === r.title) return;
                              void patch(
                                { op: "resource_title", id: r.id, title: next },
                                { silent: true },
                              ).then(() => {
                                setTitleDrafts((d) => {
                                  const copy = { ...d };
                                  delete copy[r.id];
                                  return copy;
                                });
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                          {r.note ? <span className="gws-resource-note">{r.note}</span> : null}
                          <a className="gws-resource-url" href={r.url} target="_blank" rel="noreferrer">
                            {r.url.replace(/^https?:\/\//i, "")}
                          </a>
                        </div>
                        <button
                          type="button"
                          className="gws-icon-btn"
                          disabled={busy}
                          title="Fjern link"
                          aria-label={`Fjern link: ${r.title}`}
                          onClick={() => void patch({ op: "resource_delete", id: r.id })}
                        >
                          ×
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <section className="gws-card">
                <div className="gws-card-head">
                  <h2 className="gws-h">Noter</h2>
                  <span className="gws-muted">Gemmes automatisk</span>
                </div>
                <textarea
                  className="gws-notes"
                  value={notes}
                  rows={10}
                  disabled={busy}
                  placeholder={
                    "Skriv her, hvad I aftaler og husker.\n\nFx:\n- Næste møde: gennemgå appen sammen\n- Content: film invitation med QR på campus"
                  }
                  onChange={(e) => {
                    setNotesLocal(e.target.value);
                    scheduleSave("notes", e.target.value);
                  }}
                />
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
