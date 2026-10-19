"use client";

import { TechnicalDetails } from "./TechnicalDetails";

export function ArtifactViewer({
  title,
  kind,
  id,
  content,
  storageRef,
  onClose,
}: {
  title: string;
  kind: string | null;
  id: string | null;
  content: string | null;
  storageRef?: string | null;
  onClose: () => void;
}) {
  if (!title || (!content && kind !== "generated-image")) return null;

  return (
    <section className="panel p-4 fade-in mt-6">
      <div className="flex justify-between items-center mb-3 gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <button type="button" className="text-xs text-[var(--text-dim)]" onClick={onClose}>
          Luk
        </button>
      </div>
      {kind === "generated-image" && id ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/artifacts/${id}/file`}
          alt={title}
          className="max-h-[420px] w-auto max-w-full border border-[var(--border-soft)]"
        />
      ) : null}
      {content ? (
        <div className="space-y-3 max-h-[520px] overflow-auto scrollbar-thin">
          {Array.from(
            content.matchAll(/!\[[^\]]*\]\((\/api\/artifacts\/[^)]+\/file)\)/g),
          ).map((m, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${m[1]}-${i}`}
              src={m[1]}
              alt={`Billede ${i + 1}`}
              className="max-h-[360px] w-auto max-w-full border border-[var(--border-soft)]"
            />
          ))}
          <pre className="whitespace-pre-wrap text-sm font-mono text-[var(--text-muted)]">
            {content}
          </pre>
        </div>
      ) : null}
      {storageRef ? (
        <TechnicalDetails>
          <p className="font-mono break-all">{storageRef}</p>
        </TechnicalDetails>
      ) : null}
    </section>
  );
}
