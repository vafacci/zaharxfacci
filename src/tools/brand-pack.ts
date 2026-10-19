/**
 * Project brand packs (allowlisted vault files) for planners and loops.
 */
import fs from "fs";
import path from "path";
import { isPathAllowed, resolveWorkspace } from "@/tools/workspace";

export const BRAND_PACK_WORKSPACES = [
  "autiq",
  "grupvi",
  "dreamit",
  "nofacci",
  "dailycap",
] as const;
export type BrandPackWorkspaceId = (typeof BRAND_PACK_WORKSPACES)[number];

export const BRAND_PACK_FILES = [
  "brand/voice.md",
  "brand/positioning.md",
  "brand/audience.md",
  "brand/claims.md",
  "brand/examples.md",
  "brand/glossary.md",
] as const;

export type BrandPackFile = (typeof BRAND_PACK_FILES)[number];

export type BrandPackSection = {
  relativePath: BrandPackFile;
  label: string;
  content: string;
  chars: number;
};

export type BrandPack = {
  workspaceId: BrandPackWorkspaceId;
  ready: boolean;
  missing: string[];
  thin: string[];
  sections: BrandPackSection[];
  promptText: string;
};

const LABEL: Record<BrandPackFile, string> = {
  "brand/voice.md": "Voice / tone",
  "brand/positioning.md": "Positioning",
  "brand/audience.md": "Audience",
  "brand/claims.md": "Claims policy",
  "brand/examples.md": "Approved examples",
  "brand/glossary.md": "Glossary",
};

const MIN_CHARS: Record<BrandPackFile, number> = {
  "brand/voice.md": 80,
  "brand/positioning.md": 100,
  "brand/audience.md": 80,
  "brand/claims.md": 80,
  "brand/examples.md": 60,
  "brand/glossary.md": 60,
};

function readAllowlisted(workspaceId: string, rel: string): string | null {
  try {
    const { config, absolutePath: root } = resolveWorkspace(workspaceId);
    if (!isPathAllowed(config, rel)) return null;
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return null;
    const raw = fs.readFileSync(abs, "utf8").trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function isBrandPackWorkspace(id: string): id is BrandPackWorkspaceId {
  return (BRAND_PACK_WORKSPACES as readonly string[]).includes(id);
}

export function loadBrandPack(
  workspaceId: BrandPackWorkspaceId,
  opts?: { maxTotalChars?: number; maxPerFile?: number },
): BrandPack {
  const maxTotal = opts?.maxTotalChars ?? 5500;
  const maxPer = opts?.maxPerFile ?? 1200;
  const missing: string[] = [];
  const thin: string[] = [];
  const sections: BrandPackSection[] = [];

  for (const rel of BRAND_PACK_FILES) {
    const raw = readAllowlisted(workspaceId, rel);
    if (!raw) {
      missing.push(rel);
      continue;
    }
    if (raw.length < MIN_CHARS[rel]) thin.push(rel);
    const clipped = raw.slice(0, maxPer);
    sections.push({
      relativePath: rel,
      label: LABEL[rel],
      content: clipped,
      chars: clipped.length,
    });
  }

  const ready = missing.length === 0 && thin.length === 0;
  const parts: string[] = [];
  let used = 0;
  for (const s of sections) {
    const block = `### ${s.label} (${s.relativePath})\n${s.content}`;
    if (used + block.length > maxTotal) {
      const room = Math.max(0, maxTotal - used - 40);
      if (room > 80) {
        parts.push(`### ${s.label} (${s.relativePath})\n${s.content.slice(0, room)}`);
      }
      break;
    }
    parts.push(block);
    used += block.length + 2;
  }

  return {
    workspaceId,
    ready,
    missing,
    thin,
    sections,
    promptText: parts.join("\n\n"),
  };
}

export function brandPackReadinessSummary(pack: BrandPack): string {
  if (pack.ready) {
    return `Brand pack ready (${pack.workspaceId}, ${pack.sections.length} files).`;
  }
  const bits: string[] = [];
  if (pack.missing.length) bits.push(`missing: ${pack.missing.join(", ")}`);
  if (pack.thin.length) bits.push(`too thin: ${pack.thin.join(", ")}`);
  return `Brand pack not ready (${pack.workspaceId}) — ${bits.join("; ") || "incomplete"}.`;
}

/** Citation for specialist reports / loops — never invent brand facts when blocked. */
export function brandPackReportSource(workspaceId: string): {
  label: string;
  ref: string;
  provenance: "observed" | "blocked";
  note: string;
} | null {
  if (!isBrandPackWorkspace(workspaceId)) return null;
  const pack = loadBrandPack(workspaceId);
  const label =
    workspaceId === "dreamit"
      ? "DREAMit brand pack"
      : workspaceId === "grupvi"
        ? "Grupvi brand pack"
        : workspaceId === "nofacci"
          ? "NOFACCI brand pack"
          : workspaceId === "dailycap"
            ? "DailyCap brand pack"
            : "AUTIQ brand pack";
  return {
    label,
    ref: `workspace://${workspaceId}/brand/`,
    provenance: pack.ready ? "observed" : "blocked",
    note: pack.ready
      ? pack.promptText.slice(0, 600)
      : brandPackReadinessSummary(pack),
  };
}
