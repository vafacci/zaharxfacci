"use client";

import { useState, type FormEvent } from "react";

export function PartnerLoginForm({ next }: { next: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, next }),
      });
      if (res.ok) {
        const data = (await res.json()) as { next?: string };
        window.location.assign(data.next ?? "/partner");
        return;
      }
      setError(res.status === 401 ? "Forkert kode. Prøv igen." : "Noget gik galt. Prøv igen om lidt.");
    } catch {
      setError("Ingen forbindelse. Prøv igen.");
    }
    setBusy(false);
  }

  return (
    <form className="pl-form" onSubmit={submit}>
      <label className="pr-note-label" htmlFor="partner-code">
        Adgangskode
      </label>
      <input
        id="partner-code"
        className="partner-note pl-input"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      {error ? (
        <p className="pl-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="partner-btn solid" disabled={busy || !code.trim()}>
        {busy ? "Tjekker…" : "Åbn"}
      </button>
    </form>
  );
}
