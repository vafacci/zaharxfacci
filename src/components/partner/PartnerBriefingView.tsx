"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CONCEPTS,
  PARTNERSHIP,
  SCORE_CRITERIA,
  SCORE_MAX_POINTS,
  WAITLIST_START_THRESHOLD,
  emptyScores,
  isWaitlisted,
  maxTotal,
  totalFor,
  type ScoreKey,
} from "@/data/partner-briefing";

const STORAGE_KEY = "facci-partner-scores-v2";
const SCORE_VALUES = Array.from({ length: SCORE_MAX_POINTS }, (_, i) => i + 1);

type ScoreMap = Record<string, Record<ScoreKey, number>>;

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

function pejlingLabel(p?: string): string | null {
  switch (p) {
    case "primær-kandidat":
      return "Forslag: godt sted at starte";
    case "sekundær":
      return "Forslag: fin som nr. 2";
    case "parkér":
      return "Forslag: kan godt vente";
    case "udfyld":
      return "Forslag: udfyld sammen først";
    default:
      return null;
  }
}

export function PartnerBriefingView() {
  const [scores, setScores] = useState<ScoreMap>(emptyScores);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ScoreMap;
        setScores({ ...emptyScores(), ...parsed });
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }, [scores, hydrated]);

  const ranking = useMemo(() => {
    return CONCEPTS.map((c) => {
      const s = scores[c.id] ?? emptyScores()[c.id];
      return {
        id: c.id,
        name: c.name,
        total: totalFor(s),
        startSpeed: s.startSpeed || 0,
        waitlisted: isWaitlisted(s),
        filled: SCORE_CRITERIA.every((k) => (s[k.key] ?? 0) > 0),
      };
    }).sort((a, b) => {
      // Venteliste nederst, derefter total, og ved lige total vinder højest "Hurtig opstart"
      if (a.waitlisted !== b.waitlisted) return a.waitlisted ? 1 : -1;
      if (b.total !== a.total) return b.total - a.total;
      return b.startSpeed - a.startSpeed;
    });
  }, [scores]);

  const anyScored = ranking.some((r) => r.total > 0);
  const ceiling = maxTotal();

  function setScore(conceptId: string, key: ScoreKey, value: number) {
    setScores((prev) => ({
      ...prev,
      [conceptId]: { ...prev[conceptId], [key]: value },
    }));
  }

  function resetScores() {
    setScores(emptyScores());
    localStorage.removeItem(STORAGE_KEY);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="partner-page">
      <header className="partner-hero">
        <p className="partner-kicker">Hey — klar til næste snak</p>
        <h1 className="partner-title">{PARTNERSHIP.title}</h1>
        <p className="partner-lead">{PARTNERSHIP.purpose}</p>
        <div className="partner-hero-meta">
          <span>{PARTNERSHIP.subtitle}</span>
          <span aria-hidden>·</span>
          <span>{PARTNERSHIP.updated}</span>
          <button type="button" className="partner-btn ghost" onClick={copyLink}>
            {copied ? "Kopieret" : "Kopiér link"}
          </button>
        </div>
      </header>

      <section className="partner-section" aria-labelledby="roles-heading">
        <h2 id="roles-heading" className="partner-h2">
          Hvordan vi deler det
        </h2>
        <div className="partner-roles">
          <article className="partner-role">
            <h3>{PARTNERSHIP.roles.tech.label}</h3>
            <p className="partner-role-person">{PARTNERSHIP.roles.tech.person}</p>
            <p>{PARTNERSHIP.roles.tech.focus}</p>
          </article>
          <article className="partner-role">
            <h3>{PARTNERSHIP.roles.content.label}</h3>
            <p className="partner-role-person">{PARTNERSHIP.roles.content.person}</p>
            <p>{PARTNERSHIP.roles.content.focus}</p>
          </article>
        </div>
        <p className="partner-callout">{PARTNERSHIP.ruleOfThumb}</p>
      </section>

      <section className="partner-section" aria-labelledby="concepts-heading">
        <h2 id="concepts-heading" className="partner-h2">
          De seks idéer
        </h2>
        <div className="partner-cards">
          {CONCEPTS.map((c) => {
            const pej = pejlingLabel(c.pejling);
            return (
              <article key={c.id} className="partner-card" id={c.id}>
                <div className="partner-card-top">
                  <h3 className="partner-card-name">{c.name}</h3>
                  <span className={statusClass(c.status)}>{statusLabel(c.status)}</span>
                </div>
                {c.aliases?.length ? (
                  <p className="partner-aliases">Også: {c.aliases.join(" · ")}</p>
                ) : null}
                <p className="partner-oneliner">{c.oneLiner}</p>
                {c.links.length > 0 ? (
                  <div className="partner-links">
                    {c.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className={`partner-link${link.primary ? " primary" : ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.label}
                        <span aria-hidden> ↗</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="partner-links-empty">Ingen offentligt link endnu</p>
                )}
                <dl className="partner-dl">
                  <div>
                    <dt>Hvad er problemet?</dt>
                    <dd>{c.problem}</dd>
                  </div>
                  <div>
                    <dt>Hvad gør vi ved det?</dt>
                    <dd>{c.solution}</dd>
                  </div>
                  <div>
                    <dt>Hvor er vi?</dt>
                    <dd>{c.statusNote}</dd>
                  </div>
                  <div>
                    <dt>Til content?</dt>
                    <dd>{c.contentAngle}</dd>
                  </div>
                </dl>
                {c.open.length > 0 ? (
                  <div className="partner-open">
                    <p className="partner-open-label">Vi skal stadig lande</p>
                    <ul>
                      {c.open.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {pej ? <p className="partner-pejling">{pej}</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="partner-section" aria-labelledby="score-heading">
        <div className="partner-section-head">
          <h2 id="score-heading" className="partner-h2">
            Giv dem point (1–{SCORE_MAX_POINTS})
          </h2>
          <button type="button" className="partner-btn ghost" onClick={resetScores}>
            Start forfra
          </button>
        </div>
        <p className="partner-hint">
          Gør det sammen på mødet — tallene huskes i denne browser. Højere er altid bedre
          (også på tid: få timer og hurtig start giver høje point). Total = point × vægt,
          max pr. idé: {ceiling}.
        </p>
        <ul className="partner-hint partner-rules">
          <li>
            Scor først hver for sig, tag gennemsnittet, og tal kun om de punkter, hvor I er mere
            end 3 point fra hinanden.
          </li>
          <li>
            Får en idé {WAITLIST_START_THRESHOLD} eller under på <strong>Hurtig opstart</strong>,
            kommer den på venteliste — uanset total.
          </li>
          <li>Ved lige total vinder den idé, der har højest Hurtig opstart.</li>
        </ul>

        <div className="partner-score-scroll">
          <table className="partner-score-table">
            <thead>
              <tr>
                <th scope="col">Kriterium</th>
                {CONCEPTS.map((c) => (
                  <th key={c.id} scope="col">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCORE_CRITERIA.map((crit) => (
                <tr key={crit.key}>
                  <th scope="row">
                    <span className="partner-crit-label">
                      {crit.label} <span className="partner-crit-weight">×{crit.weight}</span>
                    </span>
                    <span className="partner-crit-hint">{crit.hint}</span>
                  </th>
                  {CONCEPTS.map((c) => {
                    const val = scores[c.id]?.[crit.key] ?? 0;
                    return (
                      <td key={c.id}>
                        <div className="partner-score-btns" role="group" aria-label={`${c.name}: ${crit.label}`}>
                          {SCORE_VALUES.map((n) => (
                            <button
                              key={n}
                              type="button"
                              className={`partner-score-btn${val === n ? " active" : ""}`}
                              onClick={() => setScore(c.id, crit.key, n)}
                              aria-pressed={val === n}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="partner-total-row">
                <th scope="row">Total</th>
                {CONCEPTS.map((c) => (
                  <td key={c.id}>
                    <strong className="partner-total">
                      {totalFor(scores[c.id] ?? emptyScores()[c.id])}
                      <span className="partner-total-max">/{ceiling}</span>
                    </strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="partner-section" aria-labelledby="rank-heading">
        <h2 id="rank-heading" className="partner-h2">
          Lige nu ligger de her
        </h2>
        {!anyScored ? (
          <p className="partner-hint">Giv bare et par point — så dukker rækkefølgen op her.</p>
        ) : (
          <ol className="partner-rank">
            {ranking.map((r, i) => (
              <li key={r.id}>
                <a href={`#${r.id}`} className="partner-rank-link">
                  <span className="partner-rank-pos">{i + 1}</span>
                  <span className="partner-rank-name">{r.name}</span>
                  <span className="partner-rank-score">
                    {r.total}/{ceiling}
                    {r.waitlisted ? (
                      <span className="partner-rank-partial"> venteliste</span>
                    ) : !r.filled && r.total > 0 ? (
                      <span className="partner-rank-partial"> delvis</span>
                    ) : null}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        )}
        <p className="partner-callout soft">
          Tip: vælg <strong>én I starter med</strong> og <strong>én som nr. 2</strong> — brug både
          pointene og jeres mavefornemmelse.
        </p>
      </section>

      <section className="partner-section" aria-labelledby="meet-heading">
        <h2 id="meet-heading" className="partner-h2">
          Det vi skal lande på mødet
        </h2>
        <ol className="partner-agenda">
          {PARTNERSHIP.meetingDecisions.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ol>
      </section>

      <footer className="partner-foot">
        <p>
          Internt papir til jer to. Ingen store tal eller løfter er opdigtet — kun det, vi
          faktisk ved, plus det der stadig er åbent.
        </p>
      </footer>
    </div>
  );
}
