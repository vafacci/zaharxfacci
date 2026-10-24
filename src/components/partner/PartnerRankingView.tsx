"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CONCEPTS,
  SCORE_CRITERIA,
  SCORE_MAX_POINTS,
  emptyScores,
  maxTotal,
  totalFor,
  type ScoreKey,
} from "@/data/partner-briefing";
import {
  GENERAL_NOTE_ID,
  NOTE_MAX_LENGTH,
  VERSIONS_CHANGED_EVENT,
  noteKey,
  scoreKey,
} from "@/lib/partner-shared";
import { PartnerVersions } from "./PartnerVersions";
import { usePartnerState, type SaveStatus } from "./usePartnerState";

const SCORE_VALUES = Array.from({ length: SCORE_MAX_POINTS }, (_, i) => i + 1);

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

function saveLabel(status: SaveStatus, savedAt: Date | null): string {
  switch (status) {
    case "loading":
      return "Henter…";
    case "saving":
      return "Gemmer…";
    case "error":
      return "Kunne ikke gemme – prøver igen";
    case "unavailable":
      return "Gemning er ikke sat op";
    default: {
      if (!savedAt) return "Alt er gemt";
      const time = new Intl.DateTimeFormat("da-DK", {
        timeZone: "Europe/Copenhagen",
        hour: "2-digit",
        minute: "2-digit",
      }).format(savedAt);
      return `Gemt kl. ${time}`;
    }
  }
}

export function PartnerRankingView() {
  const { data, status, savedAt, ready, edit, flushNow } = usePartnerState();
  const { scores, notes } = data;
  const [copied, setCopied] = useState(false);

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
    [scores],
  );

  const anyScored = ranking.some((r) => r.total > 0);
  const scoredCount = ranking.filter((r) => r.filled).length;

  function setScore(conceptId: string, key: ScoreKey, value: number) {
    const current = scores[conceptId]?.[key] ?? 0;
    // Tryk på samme tal igen fjerner pointet
    edit(scoreKey(conceptId, key), String(current === value ? 0 : value), "score");
  }

  function setNote(id: string, value: string) {
    edit(noteKey(id), value.slice(0, NOTE_MAX_LENGTH), "note");
  }

  async function resetAll() {
    if (
      !window.confirm(
        "Nulstil alle point? Noter bliver stående. Nuværende stilling gemmes først som en version, så du kan gendanne den.",
      )
    ) {
      return;
    }
    try {
      await flushNow();
      await fetch("/api/partner/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Før nulstilling af point", kind: "auto" }),
      });
      window.dispatchEvent(new Event(VERSIONS_CHANGED_EVENT));
    } catch {
      /* hvis versionen ikke kunne gemmes, nulstiller vi ikke */
      return;
    }
    for (const c of CONCEPTS) {
      for (const k of SCORE_CRITERIA) {
        if ((scores[c.id]?.[k.key] ?? 0) !== 0) edit(scoreKey(c.id, k.key), "0", "score");
      }
    }
  }

  async function copyResult() {
    const lines = ranking.map(
      (r, i) =>
        `${i + 1}. ${r.name} — ${r.total}/${ceiling}${notes[r.id]?.trim() ? ` — ${notes[r.id].trim()}` : ""}`,
    );
    const general = notes[GENERAL_NOTE_ID]?.trim();
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
            dårligt. Rækkefølgen opdaterer sig selv, og alt gemmes automatisk, så I begge ser det
            samme.
          </p>
          <p className={`pr-status ${status}`} role="status" aria-live="polite">
            <span className="pr-status-dot" aria-hidden />
            {saveLabel(status, savedAt)}
          </p>
        </div>
        <div className="pr-head-actions">
          <Link href="/partner/resultat" className="partner-btn ghost">
            Se gemt resultat
          </Link>
          <button type="button" className="partner-btn solid" onClick={copyResult} disabled={!anyScored}>
            {copied ? "Kopieret" : "Kopiér resultat"}
          </button>
          <button type="button" className="partner-btn ghost" onClick={resetAll} disabled={!ready}>
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
                            disabled={!ready}
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
                readOnly={!ready}
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
          value={notes[GENERAL_NOTE_ID] ?? ""}
          onChange={(e) => setNote(GENERAL_NOTE_ID, e.target.value)}
          readOnly={!ready}
          placeholder="Beslutninger, næste skridt, tanker fra mødet…"
          aria-label="Fælles noter"
        />
        <p className="partner-hint">
          Alt gemmes automatisk og deles mellem jer. Skriver I i samme felt samtidig, vinder den
          sidste ændring – brug “Gem version” herunder, når I vil kunne vende tilbage til en
          bestemt stilling.
        </p>
      </section>

      <PartnerVersions />
    </div>
  );
}
