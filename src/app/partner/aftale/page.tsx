import type { Metadata } from "next";
import {
  CONTRACT_HIGHLIGHTS,
  CONTRACT_META,
  CONTRACT_PDF_HREF,
  CONTRACT_SECTIONS,
} from "@/data/partner-contract";

export const metadata: Metadata = {
  title: "Aftale — FACCI × ZAHAR",
  description: "Samarbejds- og partnerskabsaftale (udkast).",
  robots: { index: false, follow: false },
};

export default function ContractPage() {
  return (
    <div className="partner-page partner-wide">
      <header className="pc-hero">
        <div>
          <p className="partner-kicker">Vores aftale</p>
          <h1 className="partner-title">{CONTRACT_META.title}</h1>
          <p className="partner-lead">
            Parter: {CONTRACT_META.parties}. Ikrafttræden: {CONTRACT_META.effective}.
          </p>
        </div>
        <div className="pc-hero-actions">
          <span className="partner-pill early">{CONTRACT_META.status}</span>
          <a
            className="partner-btn solid"
            href={CONTRACT_PDF_HREF}
            target="_blank"
            rel="noopener noreferrer"
          >
            Åbn PDF
          </a>
          <a className="partner-btn ghost" href={CONTRACT_PDF_HREF} download>
            Download
          </a>
        </div>
      </header>

      <ul className="pc-highlights">
        {CONTRACT_HIGHLIGHTS.map((h) => (
          <li key={h.label}>
            <span className="pc-highlight-value">{h.value}</span>
            <span className="pc-highlight-label">{h.label}</span>
          </li>
        ))}
      </ul>

      <div className="pc-layout">
        <aside className="pc-toc" aria-label="Indhold">
          <p className="pc-toc-title">Indhold</p>
          <ol>
            {CONTRACT_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <span>{s.number}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <article className="pc-body">
          {CONTRACT_SECTIONS.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className={`pc-section${s.id === "underskrifter" ? " wide" : ""}`}
            >
              <h2>
                <span className="pc-num">{s.number}</span>
                {s.title}
              </h2>

              {s.paragraphs?.map((p) => (
                <p key={p}>{p}</p>
              ))}

              {s.items ? (
                <dl className="pc-items">
                  {s.items.map((it) => (
                    <div key={it.label}>
                      <dt>{it.label}</dt>
                      <dd>{it.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {s.bullets ? (
                <ul className="pc-bullets">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}

              {s.after?.map((p) => (
                <p key={p}>{p}</p>
              ))}

              {s.id === "underskrifter" ? (
                <div className="pc-sign">
                  <div>
                    <span className="pc-sign-line" />
                    <p>Dayan Vafai</p>
                    <small>Dato: ____________</small>
                  </div>
                  <div>
                    <span className="pc-sign-line" />
                    <p>Zahar [fulde navn]</p>
                    <small>Dato: ____________</small>
                  </div>
                </div>
              ) : null}
            </section>
          ))}

          <p className="partner-callout soft">{CONTRACT_META.note}</p>
        </article>
      </div>
    </div>
  );
}
