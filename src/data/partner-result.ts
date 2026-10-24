/**
 * FASTFRYST RESULTAT af partner-rangeringen. Ændres kun bevidst.
 * Navne og kriterier er gemt som tekst her, så resultatet ser ens ud, selv hvis rangeringssiden senere ændres.
 * Point og noter er aflæst fra jeres skærmbilleder 2026-10-24 — ret direkte her, hvis noget er skrevet forkert af.
 */

export const RESULT_META = {
  title: "Endelig rangering",
  savedOn: "24. oktober 2026",
  maxPerCriterion: 5,
  note: "Gemt fra mødet. Dette er et fast øjebliksbillede og ændrer sig ikke, når I giver nye point på rangeringssiden.",
} as const;

export const RESULT_CRITERIA = [
  { key: "startSpeed", label: "Hurtigt i gang" },
  { key: "lowTime", label: "Lidt tid pr. uge" },
  { key: "money", label: "Penge" },
  { key: "content", label: "Markedsføring" },
  { key: "impact", label: "Gør en forskel" },
] as const;

export type ResultKey = (typeof RESULT_CRITERIA)[number]["key"];

export type ResultIdea = {
  id: string;
  name: string;
  scores: Record<ResultKey, number>;
  notes: string;
};

export const RESULT_IDEAS: ResultIdea[] = [
  {
    id: "autiq",
    name: "AUTIQ",
    scores: { startSpeed: 3, lowTime: 3, money: 2, content: 3, impact: 4 },
    notes:
      "Delvist hårdt at komme igang, men når vi først er igang kan produktet virkelig tage fart. Løser som udgangspunkt et stort problem. Undersøg nærmere hvor god indtjening der kan laves.",
  },
  {
    id: "nofacci",
    name: "NOFACCI",
    scores: { startSpeed: 3, lowTime: 3, money: 2, content: 3, impact: 4 },
    notes:
      "Køb følgere - Del to profiler op - start med modeller - Være mere målrettet, skab personlighed, industrier så som skin care, gaming etc.",
  },
  {
    id: "dreamit",
    name: "DREAMit",
    scores: { startSpeed: 4, lowTime: 1, money: 1, content: 4, impact: 2 },
    notes: "Meget tidskrævende",
  },
  {
    id: "grupvi",
    name: "Grupvi",
    scores: { startSpeed: 4, lowTime: 4, money: 1, content: 4, impact: 4 },
    notes: "Færdiggør konceptet\nBesvar alle spørgsmål",
  },
  {
    id: "dailycap",
    name: "DailyCap",
    scores: { startSpeed: 1, lowTime: 1, money: 1, content: 1, impact: 1 },
    notes: "pivort - Lommepenge app -",
  },
  {
    id: "scanna",
    name: "Scanna",
    scores: { startSpeed: 3, lowTime: 2, money: 2, content: 4, impact: 5 },
    notes:
      "Ikke helt færdig med kode delen, mangler noget bedre ui. Kan udvikle hele tiden - opret database -\n\nContent ide: karlsmart, \"dyrt\" tøj, scanner, den koster ingen ting\nFøler en person fra shop til at prøve tøj og scanne tøj\nFøler en person som prøver tøj scanner det hele og bestiller det online istedet.",
  },
];

export function resultTotal(scores: Record<ResultKey, number>): number {
  return RESULT_CRITERIA.reduce((sum, c) => sum + (scores[c.key] || 0), 0);
}

export const RESULT_MAX = RESULT_CRITERIA.length * RESULT_META.maxPerCriterion;

/** Sorteret efter total. Ved lige total deler de placering (ingen opfundet tiebreaker). */
export function rankedResult() {
  const rows = RESULT_IDEAS.map((idea) => ({ idea, total: resultTotal(idea.scores) })).sort(
    (a, b) => b.total - a.total,
  );
  return rows.map((row, i) => {
    const place = rows.findIndex((r) => r.total === row.total) + 1;
    const shared = rows.filter((r) => r.total === row.total).length > 1;
    return { ...row, place, shared, index: i };
  });
}
