"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Overview } from "./types";

const CACHE_KEY = "facci-overview-cache";

export function useOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const refreshGenRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        setData(JSON.parse(cached) as Overview);
        setLoading(false);
      }
    } catch {
      // ignore
    }
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const refresh = useCallback(async () => {
    const gen = ++refreshGenRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch("/api/overview", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Overview failed (${res.status})`);
      const json = (await res.json()) as Overview;
      if (!mountedRef.current || gen !== refreshGenRef.current) return;
      setData(json);
      setError(null);
      setLoading(false);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(json));
      } catch {
        // ignore
      }
    } catch (err) {
      if (!mountedRef.current || gen !== refreshGenRef.current) return;
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Kunne ikke hente data");
      setLoading(false);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 8000);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [refresh]);

  return { data, error, setError, loading, setLoading, refresh };
}
