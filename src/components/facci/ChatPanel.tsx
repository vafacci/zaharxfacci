"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { statusLabel } from "./status";
import type { Overview, Task } from "./types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  taskId?: string;
  at: number;
};

const THREAD_KEY = "facci-chat-thread-v1";

const E2E_PROMPT =
  "Åbn toy-counter, undersøg fejlen i add(), ret den og kør tests.";

const AUTIQ_BRAND_PROMPT =
  "Opdater AUTIQ brand voice med én kort note om klar, professionel dansk tone, og tilføj én caption-idé i content/calendar.md.";

const AUTIQ_WEB_PROMPT =
  "I AUTIQ website (autiq-web): append one short FACCI note to docs/PRODUCT.md saying edits must stay allowlisted and never touch .env. Do not change app/ or components/.";

const GRUPVI_VAULT_PROMPT =
  "Opdater Grupvi product/ux-notes.md med én kort note om klar gruppechat-UX og lave friktion — ingen opfundne brugerinterviews.";

const GRUPVI_APP_PROMPT =
  "I Grupvi app (grupvi-app / studiechat): tilføj én kort FACCI-note i AGENTS.md om at ændringer skal være allowlistede — ingen .env eller supabase.";

const DREAMIT_VAULT_PROMPT =
  "Opdater DreamIT product/notes.md med én kort note om næste produktproblem at undersøge — ingen opdigtede kunder eller metrics.";

const DREAMIT_WEB_PROMPT =
  "I DreamIT website (dreamit-web): tilføj én kort FACCI-note i AGENTS.md om allowlistede edits — ingen .env.";

function loadThread(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(THREAD_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

function saveThread(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(THREAD_KEY, JSON.stringify(messages.slice(-40)));
  } catch {
    // ignore
  }
}

function taskStatusNote(task: Task): string {
  const steps = task.runs[0]?.steps ?? [];
  const last = steps[steps.length - 1];
  if (task.status === "completed") {
    const art = task.artifacts[0];
    return art
      ? `Færdig. Resultat: ${art.title}`
      : "Færdig. Se detaljer under Opgaver.";
  }
  if (task.status === "waiting_approval") {
    return "Afventer din godkendelse før FACCI går videre.";
  }
  if (task.status === "failed" || task.status === "blocked") {
    return (
      task.runs[0]?.errorMessage ??
      task.latestRunMeta?.errorMessage ??
      `Stoppet: ${statusLabel(task.status)}`
    );
  }
  if (last?.outputSummary) return last.outputSummary;
  if (last?.inputSummary) return `${statusLabel(task.status)} — ${last.inputSummary}`;
  return `Status: ${statusLabel(task.status)}`;
}

function ownerGreeting(): string {
  const h = new Date().getHours();
  if (h < 10) return "God morgen";
  if (h < 18) return "Hej";
  return "God aften";
}

export function ChatPanel({
  data,
  busy,
  setBusy,
  setError,
  refresh,
}: {
  data: Overview;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  refresh: () => Promise<void>;
}) {
  const projects = data.organization?.projects ?? [];
  const ownerName = data.organization?.ownerName?.split(" ")[0] ?? "Owner";
  const [projectId, setProjectId] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [watched, setWatched] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const announcedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setMessages(loadThread());
  }, []);

  useEffect(() => {
    if (!projectId && projects.length) {
      setProjectId(projects.find((p) => p.slug === "autiq")?.id ?? projects[0].id);
    }
  }, [projects, projectId]);

  useEffect(() => {
    saveThread(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const taskById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of data.tasks) map.set(t.id, t);
    return map;
  }, [data.tasks]);

  const recent = useMemo(
    () =>
      data.tasks
        .filter((t) => t.origin !== "validation")
        .slice(0, 8),
    [data.tasks],
  );

  useEffect(() => {
    for (const id of watched) {
      const task = taskById.get(id);
      if (!task) continue;
      const key = `${task.id}:${task.status}:${task.artifacts[0]?.id ?? ""}`;
      if (announcedRef.current.has(key)) continue;
      if (["queued", "draft"].includes(task.status) && !task.runs[0]?.steps?.length) {
        continue;
      }
      announcedRef.current.add(key);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${key}`,
          role: "system",
          text: taskStatusNote(task),
          taskId: task.id,
          at: Date.now(),
        },
      ]);
    }
  }, [watched, taskById]);

  function projectIdForSlug(slug: string): string | undefined {
    return projects.find((p) => p.slug === slug)?.id;
  }

  async function sendForProject(slug: string, message: string, prepareDemoBug = false) {
    const id = projectIdForSlug(slug);
    if (id) setProjectId(id);
    // Allow state to settle; send uses explicit id below via override
    await send(message, prepareDemoBug, id);
  }

  async function send(
    message: string,
    prepareDemoBug = false,
    projectIdOverride?: string,
  ) {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      at: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          projectId: projectIdOverride || projectId || undefined,
          prepareDemoBug,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Chat fejlede");
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: json.reply,
          taskId: json.task?.id,
          at: Date.now(),
        },
      ]);
      if (json.task?.id) {
        setWatched((prev) =>
          prev.includes(json.task.id) ? prev : [...prev, json.task.id],
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat fejlede");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "system",
          text: err instanceof Error ? err.message : "Chat fejlede",
          at: Date.now(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`chat-layout${recent.length ? " has-history" : ""}`}>
      <div className="flex flex-col gap-4 min-w-0">
        {data.approvals.length > 0 ? (
          <Link href="/approvals" className="chat-decision-banner panel">
            <span className="chat-decision-banner-dot" aria-hidden />
            <span>
              <strong>{data.approvals.length}</strong> beslutning
              {data.approvals.length === 1 ? "" : "er"} venter — åbn Beslutninger
            </span>
            <span className="chat-decision-banner-go">→</span>
          </Link>
        ) : null}

        <section className="chat-shell panel slide-up">
          <header className="chat-shell-head">
            <div className="chat-title-pill">
              <span className="chat-orb-mini" aria-hidden />
              FACCI Chat
            </div>
            <select
              className="field chat-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              aria-label="Projekt"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </header>

          <div className="chat-thread scrollbar-thin">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-orb" aria-hidden />
                <h1 className="chat-greeting">
                  <span>
                    {ownerGreeting()}, {ownerName}
                  </span>
                  <br />
                  Hvad skal FACCI gøre?
                </h1>
                <p className="chat-empty-hint">
                  Skriv naturligt. FACCI opretter en ægte opgave og udfører den lokalt
                  via Ollama + worker — ikke bare et chat-svar. Sig også{" "}
                  <em>game mode on/off</em> for at frigøre GPU til spil.
                </p>
                <div className="chip-row">
                  <button
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => void sendForProject("autiq", AUTIQ_BRAND_PROMPT)}
                  >
                    AUTIQ brand
                  </button>
                  <button
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => void sendForProject("grupvi", GRUPVI_VAULT_PROMPT)}
                  >
                    Grupvi UX-note
                  </button>
                  <button
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => void sendForProject("dreamit", DREAMIT_VAULT_PROMPT)}
                  >
                    DreamIT note
                  </button>
                  <button
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => void send(E2E_PROMPT, true)}
                  >
                    Demo
                  </button>
                  <button
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => void send("facci status")}
                  >
                    Runtime
                  </button>
                  <button
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => void send("game mode on")}
                  >
                    Game on
                  </button>
                  <button
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => void send("game mode off")}
                  >
                    Game off
                  </button>
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const task = m.taskId ? taskById.get(m.taskId) : undefined;
                return (
                  <div key={m.id} className={`chat-bubble role-${m.role}`}>
                    <div>{m.text}</div>
                    {task ? (
                      <div className="chat-task-card">
                        <div className="chat-task-row">
                          <span className="chat-task-title">{task.title}</span>
                          <StatusBadge status={task.status} />
                        </div>
                        <Link
                          href={`/tasks?id=${task.id}`}
                          className={`chat-task-link${task.artifacts[0] ? "" : " muted"}`}
                        >
                          {task.artifacts[0] ? "Åbn resultat →" : "Følg opgave →"}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <div className="chat-composer-box">
              <textarea
                className="field chat-input"
                rows={2}
                value={input}
                disabled={busy}
                placeholder="Start din forespørgsel — lad FACCI håndtere resten…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
              />
              <div className="chat-composer-actions">
                <div className="chat-composer-left">
                  <button
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => void sendForProject("autiq", AUTIQ_WEB_PROMPT)}
                  >
                    AUTIQ web
                  </button>
                  <button
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => void sendForProject("grupvi", GRUPVI_APP_PROMPT)}
                  >
                    Grupvi app
                  </button>
                  <button
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => void sendForProject("dreamit", DREAMIT_WEB_PROMPT)}
                  >
                    DreamIT web
                  </button>
                </div>
                <button
                  type="submit"
                  className="btn-send"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  title="Send"
                >
                  ↑
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>

      {recent.length > 0 ? (
        <aside className="chat-history panel">
          <h2 className="chat-history-title">Seneste arbejde</h2>
          <ul className="chat-history-list scrollbar-thin">
            {recent.map((t) => (
              <li key={t.id}>
                <Link href={`/tasks?id=${t.id}`} className="chat-history-item">
                  <strong>{t.title}</strong>
                  {t.project.name} · {statusLabel(t.status)}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
