"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CONCEPTS, SCORE_CRITERIA, maxTotal, totalFor } from "@/data/partner-briefing";
import {
  GENERAL_NOTE_ID,
  STATE_CHANGED_EVENT,
  VERSIONS_CHANGED_EVENT,
  formatDateTime,
  kvToData,
  type PartnerVersion,
} from "@/lib/partner-shared";

function summarize(version: PartnerVersion) {
  const { scores, notes } = kvToData(version.data);
  const rows = CONCEPTS.map((c) => ({
    id: c.id,
    name: c.name,
    scores: scores[c.id],
    total: totalFor(scores[c.id]),
    note: notes[c.id]?.trim() ?? "",
  })).sort((a, b) => b.total - a.total);
  return { rows, general: notes[GENERAL_NOTE_ID]?.trim() ?? "" };
}

/** Gem og gendan versioner af rangering og fælles noter. */
export function PartnerVersions() {
  const [versions, setVersions] = useState<PartnerVersion[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const ceiling = maxTotal();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/versions", { cache: "no-store" });
      if (res.status === 401) {
        window.location.assign(`/partner-login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { versions: PartnerVersion[] };
      setVersions(body.versions);
    } catch {
      setVersions((v) => v ?? []);
      setMessage({ tone: "error", text: "Kunne ikke hente versioner." });
    }
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(VERSIONS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(VERSIONS_CHANGED_EVENT, onChange);
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      // Giv ventende tekst (gemmes efter ca. 0,7 sek.) tid til at nå serveren først
      await new Promise((r) => setTimeout(r, 1000));
      const res = await fetch("/api/partner/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, kind: "manual" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setLabel("");
      setMessage({ tone: "ok", text: "Versionen er gemt." });
      await load();
    } catch {
      setMessage({ tone: "error", text: "Versionen kunne ikke gemmes. Prøv igen." });
    }
    setBusy(false);
  }

  async function restore(v: PartnerVersion) {
    if (
      !window.confirm(
        `Gendan “${v.label}”? Point og noter bliver sat tilbage til den version for jer begge. Nuværende stilling gemmes først automatisk, så intet går tabt.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/partner/versions/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      window.dispatchEvent(new Event(STATE_CHANGED_EVENT));
      setMessage({ tone: "ok", text: `“${v.label}” er gendannet. Den tidligere stilling ligger som version.` });
      await load();
    } catch {
      setMessage({ tone: "error", text: "Kunne ikke gendanne versionen." });
    }
    setBusy(false);
  }

  return (
    <section className="ver" aria-labelledby="ver-title">
      <div className="ver-head">
        <h2 id="ver-title">Gemte versioner</h2>
        <p>Gem en version, før I ændrer noget stort. Så kan I altid gå tilbage og se – eller gendanne – den.</p>
      </div>

      <form className="ver-form" onSubmit={save}>
        <input
          className="partner-note ver-input"
          type="text"
          value={label}
          maxLength={120}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Navn (valgfrit), fx “Efter mødet i dag”"
          aria-label="Navn på version"
        />
        <button type="submit" className="partner-btn solid" disabled={busy}>
          {busy ? "Arbejder…" : "Gem version"}
        </button>
      </form>

      {message ? (
        <p className={`ver-msg ${message.tone}`} role="status">
          {message.text}
        </p>
      ) : null}

      {versions === null ? (
        <p className="partner-hint">Henter versioner…</p>
      ) : versions.length === 0 ? (
        <p className="partner-hint">Ingen versioner endnu.</p>
      ) : (
        <ul className="ver-list">
          {versions.map((v) => {
            const sum = summarize(v);
            const isOpen = open === v.id;
            return (
              <li key={v.id} className="ver-item">
                <div className="ver-row">
                  <div className="ver-meta">
                    <strong>{v.label}</strong>
                    <span>
                      {formatDateTime(v.createdAt)}
                      {v.kind === "auto" ? <em className="ver-auto">automatisk</em> : null}
                    </span>
                    <span className="ver-top">
                      {sum.rows
                        .slice(0, 3)
                        .map((r, i) => `${i + 1}. ${r.name} (${r.total})`)
                        .join(" · ")}
                    </span>
                  </div>
                  <div className="ver-actions">
                    <button
                      type="button"
                      className="partner-btn ghost"
                      onClick={() => setOpen(isOpen ? null : v.id)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? "Skjul" : "Se"}
                    </button>
                    <button type="button" className="partner-btn ghost" onClick={() => restore(v)} disabled={busy}>
                      Gendan
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="ver-detail">
                    <table className="ver-table">
                      <thead>
                        <tr>
                          <th>Idé</th>
                          {SCORE_CRITERIA.map((c) => (
                            <th key={c.key}>{c.label}</th>
                          ))}
                          <th>Sum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sum.rows.map((r) => (
                          <tr key={r.id}>
                            <th scope="row">{r.name}</th>
                            {SCORE_CRITERIA.map((c) => (
                              <td key={c.key}>{r.scores[c.key] || "–"}</td>
                            ))}
                            <td>
                              <b>{r.total}</b>/{ceiling}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {sum.rows.some((r) => r.note) || sum.general ? (
                      <div className="ver-notes">
                        {sum.rows
                          .filter((r) => r.note)
                          .map((r) => (
                            <div key={r.id}>
                              <p className="pr-note-label">{r.name}</p>
                              <p className="res-notes">{r.note}</p>
                            </div>
                          ))}
                        {sum.general ? (
                          <div>
                            <p className="pr-note-label">Fælles noter</p>
                            <p className="res-notes">{sum.general}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="partner-hint">Ingen noter i denne version.</p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}