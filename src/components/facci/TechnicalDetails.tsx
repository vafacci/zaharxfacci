"use client";

export function TechnicalDetails({
  title = "Tekniske detaljer",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="mt-3 border border-[var(--border-soft)] rounded-[8px] px-3 py-2 text-xs text-[var(--text-dim)] bg-[color-mix(in_srgb,var(--bg)_35%,transparent)]">
      <summary className="cursor-pointer text-[var(--text-muted)] select-none">
        {title}
      </summary>
      <div className="mt-2 space-y-2">{children}</div>
    </details>
  );
}
