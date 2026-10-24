import type { Metadata } from "next";
import Link from "next/link";
import { PartnerVersions } from "@/components/partner/PartnerVersions";
import {
  RESULT_CRITERIA,
  RESULT_MAX,
  RESULT_META,
  rankedResult,
} from "@/data/partner-result";

export const metadata: Metadata = {
  title: "Resultat — FACCI × ZAHAR",
  description: "Gemt, endelig rangering af de seks idéer.",
  robots: { index: false, follow: false },
};

export default function ResultPage() {
  const ranking = rankedResult();

  return (
    <div className="partner-page partner-wide">
      <header className="pr-head">
        <div>
          <p className="partner-kicker">Gemt {RESULT_META.savedOn}</p>
          <h1 className="partner-title">{RESULT_META.title}</h1>
          <p className="partner-lead">{RESULT_META.note}</p>
        </div>
        <div className="pr-head-actions">
          <Link href="/partner/rangering" className="partner-btn ghost">
            Til rangeringen
          </Link>
        </div>
      </header>

      <section className="pr-board" aria-label="Endelig rækkefølge">
        <div className="pr-board-top">
          <h2>Rækkefølge</h2>
          <span>Max {RESULT_MAX} point</span>
        </div>
        <ol className="pr-board-list">
          {ranking.map((r) => {
            const pct = Math.round((r.total / RESULT_MAX) * 100);
            return (
              <li key={r.idea.id} className={r.place === 1 ? "leader" : undefined}>
                <a href={`#res-${r.idea.id}`}>
                  <span className="pr-pos">{r.place}</span>
                  <span className="pr-board-name">
                    {r.idea.name}
                    {r.shared ? <small className="res-shared"> delt</small> : null}
                  </span>
                  <span className="pr-bar" aria-hidden>
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="pr-board-score">
                    {r.total}
                    <small>/{RESULT_MAX}</small>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="pr-grid" aria-label="Point og noter pr. idé">
        {ranking.map((r) => (
          <article key={r.idea.id} id={`res-${r.idea.id}`} className="pr-card">
            <div className="pr-card-top">
              <div>
                <h3>{r.idea.name}</h3>
                <p>
                  {r.place}. plads{r.shared ? " (delt)" : ""}
                </p>
              </div>
              <div className="pr-total-num">
                {r.total}
                <small>/{RESULT_MAX}</small>
              </div>
            </div>

            <ul className="res-rows">
              {RESULT_CRITERIA.map((c) => {
                const v = r.idea.scores[c.key];
                return (
                  <li key={c.key}>
                    <span>{c.label}</span>
                    <span className="res-dots" aria-label={`${v} af ${RESULT_META.maxPerCriterion}`}>
                      {Array.from({ length: RESULT_META.maxPerCriterion }, (_, i) => (
                        <i key={i} className={i < v ? "on" : undefined} />
                      ))}
                      <b>{v}</b>
                    </span>
                  </li>
                );
              })}
            </ul>

            {r.idea.notes ? (
              <div>
                <p className="pr-note-label">Noter</p>
                <p className="res-notes">{r.idea.notes}</p>
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <PartnerVersions />
    </div>
  );
}
