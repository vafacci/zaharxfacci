"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STATE_CHANGED_EVENT, kvToData, type PartnerKv } from "@/lib/partner-shared";

export type SaveStatus = "loading" | "saved" | "saving" | "error" | "unavailable";

const POLL_MS = 6000;
const NOTE_DELAY = 700;
const SCORE_DELAY = 200;

/**
 * Delt tilstand mod serveren. Lokale ændringer vises med det samme og gemmes pr. nøgle.
 * Andres ændringer hentes løbende, men overskriver aldrig det, du selv er ved at skrive.
 */
export function usePartnerState() {
  const [kv, setKv] = useState<PartnerKv>({});
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [ready, setReady] = useState(false);

  const dirty = useRef(new Map<string, string>());
  const inflight = useRef(new Set<string>());
  const lastEdit = useRef(new Map<string, number>());
  const timer = useRef<number | null>(null);
  const flushing = useRef(false);

  const goToLogin = useCallback(() => {
    window.location.assign(`/partner-login?next=${encodeURIComponent(window.location.pathname)}`);
  }, []);

  const refresh = useCallback(async () => {
    const startedAt = Date.now();
    try {
      const res = await fetch("/api/partner/state", { cache: "no-store" });
      if (res.status === 401) return goToLogin();
      if (res.status === 503) {
        setStatus("unavailable");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const { kv: remote } = (await res.json()) as { kv: PartnerKv };
      setKv((prev) => {
        const next: PartnerKv = { ...prev };
        let changed = false;
        for (const [key, value] of Object.entries(remote)) {
          const busy =
            dirty.current.has(key) ||
            inflight.current.has(key) ||
            (lastEdit.current.get(key) ?? 0) >= startedAt - 50;
          if (busy) continue;
          if (next[key] !== value) {
            next[key] = value;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setReady(true);
      setStatus((s) => (s === "loading" || s === "error" || s === "unavailable" ? "saved" : s));
    } catch {
      setStatus((s) => (s === "loading" ? "error" : s));
    }
  }, [goToLogin]);

  const flush = useCallback(async () => {
    if (flushing.current || dirty.current.size === 0) return;
    flushing.current = true;
    const batch = new Map(dirty.current);
    dirty.current.clear();
    batch.forEach((_, key) => inflight.current.add(key));
    setStatus("saving");
    try {
      const res = await fetch("/api/partner/state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: Array.from(batch, ([key, value]) => ({ key, value })) }),
      });
      if (res.status === 401) return goToLogin();
      if (!res.ok) throw new Error(String(res.status));
      setSavedAt(new Date());
      setStatus(dirty.current.size > 0 ? "saving" : "saved");
    } catch {
      // Læg ændringerne tilbage, medmindre de er rettet igen i mellemtiden
      batch.forEach((value, key) => {
        if (!dirty.current.has(key)) dirty.current.set(key, value);
      });
      setStatus("error");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        void flush();
      }, 4000);
    } finally {
      batch.forEach((_, key) => inflight.current.delete(key));
      flushing.current = false;
      if (dirty.current.size > 0 && !timer.current) {
        timer.current = window.setTimeout(() => {
          timer.current = null;
          void flush();
        }, 300);
      }
    }
  }, [goToLogin]);

  const schedule = useCallback(
    (delay: number) => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        void flush();
      }, delay);
    },
    [flush],
  );

  const edit = useCallback(
    (key: string, value: string, kind: "score" | "note") => {
      if (!ready) return;
      lastEdit.current.set(key, Date.now());
      dirty.current.set(key, value);
      setKv((prev) => ({ ...prev, [key]: value }));
      setStatus("saving");
      schedule(kind === "note" ? NOTE_DELAY : SCORE_DELAY);
    },
    [ready, schedule],
  );

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onExternal = () => void refresh();

    // Send ventende ændringer, hvis fanen lukkes
    const onHide = () => {
      if (dirty.current.size === 0) return;
      void fetch("/api/partner/state", {
        method: "PATCH",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: Array.from(dirty.current, ([key, value]) => ({ key, value })),
        }),
      });
    };
    const onVisibilityHide = () => {
      if (document.visibilityState === "hidden") onHide();
    };

    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("visibilitychange", onVisibilityHide);
    window.addEventListener("pagehide", onHide);
    window.addEventListener(STATE_CHANGED_EVENT, onExternal);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("visibilitychange", onVisibilityHide);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener(STATE_CHANGED_EVENT, onExternal);
    };
  }, [refresh]);

  const data = useMemo(() => kvToData(kv), [kv]);

  return { data, kv, status, savedAt, ready, edit, flushNow: flush, refresh };
}
