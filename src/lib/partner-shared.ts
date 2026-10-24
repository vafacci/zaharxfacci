import {
  CONCEPTS,
  SCORE_CRITERIA,
  SCORE_MAX_POINTS,
  emptyScores,
  type ScoreKey,
} from "@/data/partner-briefing";

/**
 * Delt format for partner-siden: en flad nøgle/værdi-map.
 *   score:<idé>:<kriterie> -> "0".."5"
 *   note:<idé|_general>    -> tekst
 * Hver nøgle gemmes for sig, så to personer sjældent overskriver hinanden.
 */
export type PartnerKv = Record<string, string>;

export type PartnerData = {
  scores: Record<string, Record<ScoreKey, number>>;
  notes: Record<string, string>;
};

export const GENERAL_NOTE_ID = "_general";
export const NOTE_MAX_LENGTH = 20000;

export function scoreKey(ideaId: string, crit: ScoreKey): string {
  return `score:${ideaId}:${crit}`;
}

export function noteKey(id: string): string {
  return `note:${id}`;
}

/** Alle nøgler der kan eksistere. */
export function allKeys(): string[] {
  const keys: string[] = [];
  for (const c of CONCEPTS) {
    for (const k of SCORE_CRITERIA) keys.push(scoreKey(c.id, k.key));
    keys.push(noteKey(c.id));
  }
  keys.push(noteKey(GENERAL_NOTE_ID));
  return keys;
}

export function kvToData(kv: PartnerKv): PartnerData {
  const scores = emptyScores();
  const notes: Record<string, string> = {};
  for (const [key, value] of Object.entries(kv)) {
    const parts = key.split(":");
    if (parts[0] === "score" && parts.length === 3) {
      const [, id, crit] = parts;
      const n = Number.parseInt(value, 10);
      if (scores[id] && crit in scores[id] && n >= 0 && n <= SCORE_MAX_POINTS) {
        scores[id][crit as ScoreKey] = n;
      }
    } else if (parts[0] === "note" && parts.length === 2) {
      notes[parts[1]] = value;
    }
  }
  return { scores, notes };
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export type PartnerVersion = {
  id: number;
  label: string;
  kind: "manual" | "auto";
  createdAt: string;
  data: PartnerKv;
};

/** Browser-event så rangering og versioner kan opdatere hinanden med det samme. */
export const STATE_CHANGED_EVENT = "partner-state-changed";
export const VERSIONS_CHANGED_EVENT = "partner-versions-changed";
