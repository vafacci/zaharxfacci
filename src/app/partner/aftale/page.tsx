import type { Metadata } from "next";
import {
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
    <div className="partner-page">
      <article className="doc">
        <header className="doc-head">
          <p className="doc-tag">{CONTRACT_META.status}</p>
          <h1>FACCI × ZAHAR</h1>
          <h2 className="doc-subtitle">{CONTRACT_META.title}</h2>
          <p>
            <strong>Parter:</strong> {CONTRACT_META.parties}
            <br />
            <strong>Ikrafttræden:</strong> {CONTRACT_META.effective}
          </p>
          <p className="doc-links">
            <a href={CONTRACT_PDF_HREF} target="_blank" rel="noopener noreferrer">
              Åbn PDF
            </a>
            <span aria-hidden> · </span>
            <a href={CONTRACT_PDF_HREF} download>
              Download PDF
            </a>
          </p>
        </header>

        {CONTRACT_SECTIONS.map((s) => (
          <section key={s.id} id={s.id}>
            <h3>
              {s.number}. {s.title}
            </h3>

            {s.paragraphs?.map((p) => (
              <p key={p}>{p}</p>
            ))}

            {s.items ? (
              <ul>
                {s.items.map((it) => (
                  <li key={it.label}>
                    <strong>{it.label}:</strong> {it.value}
                  </li>
                ))}
              </ul>
            ) : null}

            {s.bullets ? (
              <ul>
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}

            {s.after?.map((p) => (
              <p key={p}>{p}</p>
            ))}

            {s.id === "underskrifter" ? (
              <div className="doc-sign">
                <div>
                  <span />
                  <p>Dayan Vafai</p>
                  <small>Dato: ____________</small>
                </div>
                <div>
                  <span />
                  <p>Zahar [fulde navn]</p>
                  <small>Dato: ____________</small>
                </div>
              </div>
            ) : null}
          </section>
        ))}

        <p className="doc-note">{CONTRACT_META.note}</p>
      </article>
    </div>
  );
}
