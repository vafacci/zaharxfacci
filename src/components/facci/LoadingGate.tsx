"use client";

export function LoadingGate({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <main className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-6 text-center text-[var(--text-muted)]">
      <p>{loading && !error ? "Indlæser FACCI…" : null}</p>
      {error ? (
        <>
          <p className="text-[var(--danger)] max-w-lg">Fejl: {error}</p>
          <button
            type="button"
            className="border border-[var(--border)] px-4 py-2 text-sm hover:border-[var(--accent)]"
            onClick={onRetry}
          >
            Prøv igen
          </button>
        </>
      ) : null}
    </main>
  );
}
