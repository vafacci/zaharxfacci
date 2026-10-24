"use client";

import Link from "next/link";
import { useState } from "react";
import { CONCEPTS, PARTNERSHIP } from "@/data/partner-briefing";
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
  const [copied, setCopied] = useState(false);
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

      <section className="partner-section" aria-labelledby="cta-heading">
        <div className="partner-cta">
          <div>
            <h2 id="cta-heading" className="partner-h2">
              Klar til at give point?
            </h2>
            <p className="partner-hint">
              Rangeringen har fået sin egen side med plads til point og noter.
            </p>
          </div>
          <Link href="/partner/rangering" className="partner-btn solid">
            Gå til rangering
          </Link>
        </div>
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
