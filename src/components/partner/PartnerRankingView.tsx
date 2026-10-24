"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CONCEPTS,
  SCORE_CRITERIA,
  SCORE_MAX_POINTS,
  emptyScores,
  maxTotal,
  totalFor,
  type ScoreKey,
} from "@/data/partner-briefing";

// Samme nøgler som før, så allerede givne point og noter bevares.
const STORAGE_KEY = "facci-partner-scores-v3";
const NOTES_KEY = "facci-partner-notes-v1";
const SCORE_VALUES = Array.from({ length: SCORE_MAX_POINTS }, (_, i) => i + 1);

type ScoreMap = Record<string, Record<ScoreKey, number>>;
/** Noter pr. idé (id) + "_general" til fælles noter. */
type NotesMap = Record<string, string>;

function statusLabel(status: string): string {
  switch (status) {
    case "klar":
      return "Klar til at vise";
    case "undervejs":
      return "I gang";
    case "tidlig":
      return "Tidligt";
    default:
      return "Skal snakkes";
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "klar":
      return "partner-pill ok";
    case "undervejs":
      return "partner-pill mid";
    case "tidlig":
      return "partner-pill early";
    default:
      return "partner-pill unknown";
  }
}

export function PartnerRankingView() {
  const [scores, setScores] = useState<ScoreMap>(emptyScores);
  const [notes, setNotes] = useState<NotesMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setScores({ ...emptyScores(), ...(JSON.parse(raw) as ScoreMap) });
      const rawNotes = localStorage.getItem(NOTES_KEY);
      if (rawNotes) setNotes(JSON.parse(rawNotes) as NotesMap);
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }, [scores, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes, hydrated]);

  const ceiling = maxTotal();

  const ranking = useMemo(
    () =>
      CONCEPTS.map((c) => {
        const s = scores[c.id] ?? emptyScores()[c.id];
        return {
          id: c.id,
          name: c.name,
          total: totalFor(s),
          filled: SCORE_CRITERIA.every((k) => (s[k.key] ?? 0) > 0),
        };
      }).sort((a, b) => b.total - a.total),
    [scores, ceiling],
  );

  const anyScored = ranking.some((r) => r.total > 0);
  const scoredCount = ranking.filter((r) => r.filled).length;

  function setScore(conceptId: string, key: ScoreKey, value: number) {
    setScores((prev) => ({
      ...prev,
      [conceptId]: {
        ...(prev[conceptId] ?? emptyScores()[conceptId]),
        // Tryk på samme tal igen fjerner pointet
        [key]: prev[conceptId]?.[key] === value ? 0 : value,
      },
    }));
  }

  function setNote(id: string, value: string) {
    setNotes((prev) => ({ ...prev, [id]: value }));
  }

  function resetAll() {
    if (!window.confirm("Nulstil alle point? Noter bliver stående.")) return;
    setScores(emptyScores());
    localStorage.removeItem(STORAGE_KEY);
  }

  async function copyResult() {
    const lines = ranking.map(
      (r, i) =>
        `${i + 1}. ${r.name} — ${r.total}/${ceiling}${notes[r.id]?.trim() ? ` — ${notes[r.id].trim()}` : ""}`,
    );
    const general = notes._general?.trim();
    const text = `${lines.join("\n")}${general ? `\n\nNoter:\n${general}` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="partner-page partner-wide">
      <header className="pr-head">
        <div>
          <p className="partner-kicker">Til mødet</p>
          <h1 className="partner-title">Rangering</h1>
          <p className="partner-lead">
            Giv hver idé 1–{SCORE_MAX_POINTS} point på fem ting. {SCORE_MAX_POINTS} er godt, 1 er
            dårligt. Rækkefølgen opdaterer sig selv.
          </p>
        </div>
        <div className="pr-head-actions">
          <Link href="/partner/resultat" className="partner-btn ghost">
            Se gemt resultat
          </Link>
          <button type="button" className="partner-btn solid" onClick={copyResult} disabled={!anyScored}>
            {copied ? "Kopieret" : "Kopiér resultat"}
          </button>
          <button type="button" className="partner-btn ghost" onClick={resetAll}>
            Nulstil point
          </button>
        </div>
      </header>

      <section className="pr-board" aria-label="Lige nu">
        <div className="pr-board-top">
          <h2>Lige nu ligger de her</h2>
          <span>
            {scoredCount} af {CONCEPTS.length} fuldt scoret
          </span>
        </div>
        <ol className="pr-board-list">
          {ranking.map((r, i) => {
            const pct = ceiling ? Math.round((r.total / ceiling) * 100) : 0;
            const leader = anyScored && i === 0;
            return (
              <li key={r.id} className={leader ? "leader" : undefined}>
                <a href={`#idea-${r.id}`}>
                  <span className="pr-pos">{anyScored ? i + 1 : "–"}</span>
                  <span className="pr-board-name">{r.name}</span>
                  <span className="pr-bar" aria-hidden>
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="pr-board-score">
                    {r.total}
                    <small>/{ceiling}</small>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="pr-grid" aria-label="Idéer">
        {CONCEPTS.map((c) => {
          const s = scores[c.id] ?? emptyScores()[c.id];
          const total = totalFor(s);
          const pct = ceiling ? Math.round((total / ceiling) * 100) : 0;
          return (
            <article key={c.id} id={`idea-${c.id}`} className="pr-card">
              <div className="pr-card-top">
                <div>
                  <h3>{c.name}</h3>
                  <p>{c.oneLiner}</p>
                </div>
                <span className={statusClass(c.status)}>{statusLabel(c.status)}</span>
              </div>

              <div className="pr-total">
                <div className="pr-total-num">
                  {total}
                  <small>/{ceiling}</small>
                </div>
                <div className="pr-bar big" aria-hidden>
                  <span style={{ width: `${pct}%` }} />
                </div>
              </div>

              <ul className="pr-rows">
                {SCORE_CRITERIA.map((crit) => {
                  const val = s[crit.key] ?? 0;
                  return (
                    <li key={crit.key}>
                      <div className="pr-row-label">
                        <span>{crit.label}</span>
                        <small>{crit.hint}</small>
                      </div>
                      <div
                        className="pr-seg"
                        role="group"
                        aria-label={`${c.name}: ${crit.label}`}
                      >
                        {SCORE_VALUES.map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={val === n ? "active" : val > 0 && n < val ? "under" : undefined}
                            onClick={() => setScore(c.id, crit.key, n)}
                            aria-pressed={val === n}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <label className="pr-note-label" htmlFor={`note-${c.id}`}>
                Noter
              </label>
              <textarea
                id={`note-${c.id}`}
                className="partner-note"
                rows={3}
                value={notes[c.id] ?? ""}
                onChange={(e) => setNote(c.id, e.target.value)}
                placeholder={`Tanker om ${c.name}…`}
              />
            </article>
          );
        })}
      </section>

      <section className="pr-general">
        <h2>Fælles noter</h2>
        <textarea
          className="partner-note wide"
          rows={6}
          value={notes._general ?? ""}
          onChange={(e) => setNote("_general", e.target.value)}
          placeholder="Beslutninger, næste skridt, tanker fra mødet…"
          aria-label="Fælles noter"
        />
        <p className="partner-hint">
          Point og noter gemmes kun i denne browser. Brug “Kopiér resultat”, hvis I vil dele dem.
        </p>
      </section>
    </div>
  );
}
