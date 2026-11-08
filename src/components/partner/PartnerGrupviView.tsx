"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Checkpoint = { id: string; label: string; done: boolean };
type Todo = { id: string; task: string; owner: string; status: string };
type Done = { id: string; task: string; date: string };
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
  const [showDone, setShowDone] = useState(false);
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
    saveTimer.current = setTimeout(() => {
      void patch({ op, [op]: value }, { silent: true });
    }, 700);
  }

  const doneCount = ws?.checkpoints.filter((c) => c.done).length ?? 0;
  const totalCp = ws?.checkpoints.length ?? 0;
  const openCount = ws?.todos.length ?? 0;

  return (
    <div className="partner-page gws">
      <header className="gws-hero">
        <div>
          <p className="partner-kicker">FACCI × ZAHAR</p>
          <h1 className="partner-title">Grupvi</h1>
          <p className="partner-lead">
            Her følger I Grupvi sammen: fokus, opgaver, noter og alle jeres links og dokumenter ét sted.
          </p>
        </div>
        <div className="gws-hero-meta">
          {savedHint ? <span className="gws-saved">{savedHint}</span> : null}
          <a className="partner-btn ghost" href={ws?.liveLanding ?? "https://studiechat.vercel.app/"} target="_blank" rel="noreferrer">
            Landingside
          </a>
          <a className="partner-btn solid" href={ws?.liveApp ?? "https://studiechat.vercel.app/app"} target="_blank" rel="noreferrer">
            Åbn appen
          </a>
        </div>
      </header>

      {error ? (
        <p className="pl-error" role="alert">
          {error}
        </p>
      ) : null}

      {!ws ? (
        <p className="partner-hint">Henter siden…</p>
      ) : (
        <>
          <section className="gws-strip" aria-label="Status">
            <div>
              <span className="gws-stat-label">Mål nået</span>
              <strong>
                {doneCount}/{totalCp}
              </strong>
            </div>
            <div>
              <span className="gws-stat-label">Opgaver i gang</span>
              <strong>{openCount}</strong>
            </div>
            <div>
              <span className="gws-stat-label">Færdige</span>
              <strong>{ws.done.length}</strong>
            </div>
          </section>

          <section className="gws-block">
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

          <section className="gws-block">
            <div className="gws-block-head">
              <h2 className="gws-h">Mål</h2>
              <span className="gws-muted">
                {doneCount} af {totalCp} færdige
              </span>
            </div>
            <div className="gws-progress" aria-hidden>
              <span style={{ width: totalCp ? `${(doneCount / totalCp) * 100}%` : "0%" }} />
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
                    <span>{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="gws-block">
            <div className="gws-block-head">
              <h2 className="gws-h">Opgaver</h2>
              <span className="gws-muted">
                {openCount === 0 ? "Ingen lige nu" : `${openCount} i gang`}
              </span>
            </div>

            <ul className="gws-tasks">
              {ws.todos.length === 0 ? (
                <li className="gws-empty">Ingen opgaver endnu. Skriv den næste herunder.</li>
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
                    />
                    <span className="gws-task-text">{t.task}</span>
                    <select
                      className="gws-owner"
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
                      className="gws-task-del"
                      disabled={busy}
                      title="Fjern opgave"
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
                className="gws-add-input"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Hvad skal gøres?"
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
              <button
                type="submit"
                className="partner-btn solid"
                disabled={busy || !newTask.trim()}
              >
                Tilføj
              </button>
            </form>
          </section>

          <section className="gws-block">
            <div className="gws-block-head">
              <h2 className="gws-h">Ressourcer</h2>
              <span className="gws-muted">
                {(ws.resources ?? []).length === 0
                  ? "Tilføj links og dokumenter"
                  : `${ws.resources.length} gemt`}
              </span>
            </div>
            <p className="gws-resource-hint">
              Samlepunkt for Drive, Notion, Figma, docs og andre links I begge skal kunne finde.
            </p>
            <ul className="gws-resources">
              {(ws.resources ?? []).length === 0 ? (
                <li className="gws-empty">Ingen ressourcer endnu. Tilføj det første link herunder.</li>
              ) : (
                (ws.resources ?? []).map((r) => (
                  <li key={r.id} className="gws-resource">
                    <a
                      className="gws-resource-link"
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <strong>{r.title}</strong>
                      {r.note ? <span>{r.note}</span> : null}
                      <em>{r.url.replace(/^https?:\/\//i, "")}</em>
                    </a>
                    <button
                      type="button"
                      className="gws-task-del"
                      disabled={busy}
                      title="Fjern ressource"
                      onClick={() => void patch({ op: "resource_delete", id: r.id })}
                    >
                      ×
                    </button>
                  </li>
                ))
              )}
            </ul>
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
                });
              }}
            >
              <input
                className="gws-add-input"
                value={newResourceTitle}
                onChange={(e) => setNewResourceTitle(e.target.value)}
                placeholder="Titel (fx Brand pack)"
                disabled={busy}
              />
              <input
                className="gws-add-input"
                value={newResourceUrl}
                onChange={(e) => setNewResourceUrl(e.target.value)}
                placeholder="Link (https://…)"
                disabled={busy}
                inputMode="url"
              />
              <input
                className="gws-add-input"
                value={newResourceNote}
                onChange={(e) => setNewResourceNote(e.target.value)}
                placeholder="Kort note (valgfri)"
                disabled={busy}
              />
              <button
                type="submit"
                className="partner-btn solid"
                disabled={busy || !newResourceTitle.trim() || !newResourceUrl.trim()}
              >
                Tilføj
              </button>
            </form>
          </section>

          <section className="gws-block">
            <div className="gws-block-head">
              <h2 className="gws-h">Noter</h2>
              <span className="gws-muted">Gemmes af sig selv</span>
            </div>
            <textarea
              className="gws-notes"
              value={notes}
              rows={12}
              disabled={busy}
              placeholder={
                "Skriv her, hvad I aftaler og husker.\n\nFor eksempel:\n- Næste møde: gennemgå appen sammen\n- Content: film invitation med QR på campus\n- Åbent spørgsmål: hvem inviterer den første studiegruppe?"
              }
              onChange={(e) => {
                setNotesLocal(e.target.value);
                scheduleSave("notes", e.target.value);
              }}
            />
          </section>

          <section className="gws-block gws-done-block">
            <button
              type="button"
              className="gws-done-toggle"
              onClick={() => setShowDone((v) => !v)}
            >
              Færdige opgaver ({ws.done.length}) {showDone ? "▾" : "▸"}
            </button>
            {showDone ? (
              <ul className="gws-done-list">
                {ws.done.length === 0 ? (
                  <li className="gws-empty">I har ikke markeret noget som færdigt endnu.</li>
                ) : (
                  ws.done.map((d) => (
                    <li key={`${d.id}-${d.date}`} className="gws-done-item">
                      <span>{d.task}</span>
                      <em>{d.date}</em>
                      <button
                        type="button"
                        className="partner-btn ghost"
                        disabled={busy}
                        onClick={() => void patch({ op: "todo_reopen", id: d.id })}
                      >
                        Sæt tilbage
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
