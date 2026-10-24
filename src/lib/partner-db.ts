import { neon } from "@neondatabase/serverless";
import { CONCEPTS, SCORE_CRITERIA, SCORE_MAX_POINTS } from "@/data/partner-briefing";
import {
  GENERAL_NOTE_ID,
  NOTE_MAX_LENGTH,
  allKeys,
  type PartnerKv,
  type PartnerVersion,
} from "@/lib/partner-shared";

/** Server-kode: bruges kun fra route handlers. Egen database, adskilt fra al anden data. */
export class NotConfiguredError extends Error {
  constructor() {
    super("PARTNER_DATABASE_URL mangler");
  }
}

function sql() {
  const url = process.env.PARTNER_DATABASE_URL;
  if (!url) throw new NotConfiguredError();
  return neon(url);
}

const IDEA_IDS = new Set(CONCEPTS.map((c) => c.id));
const CRITERIA = new Set<string>(SCORE_CRITERIA.map((c) => c.key));

export type Item = { key: string; value: string };

/** Returnerer null, hvis nøglen eller værdien ikke er gyldig. */
export function parseItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== "object") return null;
  const { key, value } = raw as { key?: unknown; value?: unknown };
  if (typeof key !== "string") return null;
  const parts = key.split(":");

  if (parts[0] === "score" && parts.length === 3) {
    if (!IDEA_IDS.has(parts[1]) || !CRITERIA.has(parts[2])) return null;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(n) || n < 0 || n > SCORE_MAX_POINTS) return null;
    return { key, value: String(n) };
  }

  if (parts[0] === "note" && parts.length === 2) {
    if (!IDEA_IDS.has(parts[1]) && parts[1] !== GENERAL_NOTE_ID) return null;
    if (typeof value !== "string" || value.length > NOTE_MAX_LENGTH) return null;
    return { key, value };
  }

  return null;
}

export async function loadKv(): Promise<PartnerKv> {
  const rows = (await sql()`SELECT key, value FROM partner_kv`) as { key: string; value: string }[];
  const kv: PartnerKv = {};
  for (const r of rows) kv[r.key] = r.value;
  return kv;
}

export async function saveItems(items: Item[]): Promise<void> {
  if (items.length === 0) return;
  const keys = items.map((i) => i.key);
  const values = items.map((i) => i.value);
  await sql()`
    INSERT INTO partner_kv (key, value)
    SELECT * FROM unnest(${keys}::text[], ${values}::text[])
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

function defaultLabel(): string {
  const stamp = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  return `Version ${stamp}`;
}

type VersionRow = { id: number | string; label: string; kind: string; data: PartnerKv; created_at: string | Date };

function toVersion(r: VersionRow): PartnerVersion {
  return {
    id: Number(r.id),
    label: r.label,
    kind: r.kind === "auto" ? "auto" : "manual",
    createdAt: new Date(r.created_at).toISOString(),
    data: r.data,
  };
}

export async function createVersion(label: string, kind: "manual" | "auto"): Promise<PartnerVersion> {
  const kv = await loadKv();
  const clean = label.trim().slice(0, 120) || defaultLabel();
  const rows = (await sql()`
    INSERT INTO partner_versions (label, kind, data)
    VALUES (${clean}, ${kind}, ${JSON.stringify(kv)}::jsonb)
    RETURNING id, label, kind, data, created_at
  `) as VersionRow[];
  return toVersion(rows[0]);
}

export async function listVersions(): Promise<PartnerVersion[]> {
  const rows = (await sql()`
    SELECT id, label, kind, data, created_at
    FROM partner_versions
    ORDER BY id DESC
    LIMIT 100
  `) as VersionRow[];
  return rows.map(toVersion);
}

/** Gemmer først nuværende stilling som automatisk version, så intet går tabt. */
export async function restoreVersion(id: number): Promise<PartnerVersion | null> {
  const rows = (await sql()`
    SELECT id, label, kind, data, created_at FROM partner_versions WHERE id = ${id}
  `) as VersionRow[];
  if (rows.length === 0) return null;
  const version = toVersion(rows[0]);

  await createVersion(`Før gendannelse af “${version.label}”`, "auto");

  const items: Item[] = allKeys().map((key) => {
    const fallback = key.startsWith("score:") ? "0" : "";
    return { key, value: version.data[key] ?? fallback };
  });
  await saveItems(items);
  return version;
}
