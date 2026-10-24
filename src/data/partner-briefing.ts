/**
 * Shared portfolio briefing for content partnership ranking.
 * Facts drawn from brand packs / product docs — Scanna is intentionally blank.
 */

export type ScoreKey =
  | "startSpeed"
  | "lowTime"
  | "moneyPerHour"
  | "impact"
  | "contentEase"
  | "contentCost"
  | "certainty"
  | "reach";

/** Alle point er 1–10, og højere er altid bedre. Total = sum af point × vægt. */
export const SCORE_MAX_POINTS = 10;

/** Hurtig opstart ≤ dette tal sender idéen på venteliste uanset total. */
export const WAITLIST_START_THRESHOLD = 3;

export const SCORE_CRITERIA: {
  key: ScoreKey;
  label: string;
  hint: string;
  weight: number;
}[] = [
  {
    key: "startSpeed",
    label: "Hurtig opstart",
    hint: "10 = under 1 uge · 7 = 2–4 uger · 4 = 1–3 mdr. · 1 = over 6 mdr.",
    weight: 3,
  },
  {
    key: "lowTime",
    label: "Lavt tidsforbrug",
    hint: "Timer pr. uge når det kører. 10 = under 2 t · 7 = ca. 5 t · 4 = ca. 10 t · 1 = fuldtid",
    weight: 3,
  },
  {
    key: "moneyPerHour",
    label: "Penge pr. time",
    hint: "Hvor meget tjener vi i forhold til de timer, vi lægger i det?",
    weight: 2,
  },
  {
    key: "impact",
    label: "Impact",
    hint: "Hvor stort er brugerens problem, og hvor godt løser vi det?",
    weight: 2,
  },
  {
    key: "contentEase",
    label: "Nemt at lave content",
    hint: "Content er afgørende for markedsføring. 10 = kan laves hurtigt uden særlig kunnen · 1 = tungt, specialiseret eller meget tidskrævende.",
    weight: 2,
  },
  {
    key: "contentCost",
    label: "Billigt at lave content",
    hint: "10 = næsten gratis · 7 = lidt til værktøjer · 4 = betydelig pris pr. måned · 1 = dyrt (modeller, shoots, ads, freelancere).",
    weight: 2,
  },
  {
    key: "certainty",
    label: "Sikkerhed",
    hint: "Hvor sikre er vi på, at det virker?",
    weight: 1,
  },
  {
    key: "reach",
    label: "Reach",
    hint: "Hvor mange kan vi nå?",
    weight: 1,
  },
];

export type ConceptStatus = "klar" | "undervejs" | "tidlig" | "ukendt";

export type ConceptLink = {
  label: string;
  href: string;
  /** primary = main CTA on the card */
  primary?: boolean;
};

export type PortfolioConcept = {
  id: string;
  name: string;
  aliases?: string[];
  oneLiner: string;
  problem: string;
  solution: string;
  status: ConceptStatus;
  statusNote: string;
  contentAngle: string;
  open: string[];
  /** Live / public entry points for the partner */
  links: ConceptLink[];
  /** Soft pejling — ikke endelig ranking */
  pejling?: "primær-kandidat" | "sekundær" | "parkér" | "udfyld";
};

export const PARTNERSHIP = {
  title: "Vores seks idéer",
  subtitle: "Vi finder ud af, hvad vi starter med",
  updated: "2026-10-19",
  purpose:
    "Et roligt overblik inden næste møde. Læs koncepterne, scor dem sammen, og vælg én primær + én sekundær til content — resten kan vente.",
  roles: {
    tech: {
      label: "Det tekniske",
      person: "Dayan",
      focus: "Bygger produktet, koder, holder styr på systemerne.",
    },
    content: {
      label: "Content & marketing",
      person: "Partner",
      focus: "Historier, kanaler, kreativ retning og hvordan det føles udadtil.",
    },
  },
  ruleOfThumb:
    "Vi tager det roligt: én primær + én sekundær først. Resten parkerer vi — ellers spreder vi os for tyndt.",
  meetingDecisions: [
    "Hvad starter vi med de næste 2–4 uger?",
    "Hvad er nr. 2 (lidt, men ikke nul)?",
    "Hvad venter vi bevidst med — og indtil hvornår?",
    "Hvad mangler vi stadig at skrive ned om Scanna?",
    "Hvem passer tonen/kanalen på det, vi vælger?",
  ],
} as const;

export const CONCEPTS: PortfolioConcept[] = [
  {
    id: "autiq",
    name: "AUTIQ",
    aliases: ["Autik"],
    oneLiner:
      "Content Autopilot til creators — strukturerede drafts med menneskelig godkendelse før publicering.",
    problem:
      "Creators og operators bruger for meget tid på gentagen drafting og mister stemme/kontrol, hvis alt skal være ‘fuld autopilot’.",
    solution:
      "Et workflow der hjælper fra idé → kanal-klar draft → review → schedule, med eksplicitte approval-gates. AI er infrastruktur, ikke helten.",
    status: "klar",
    statusNote:
      "Brand pack + ugentligt content-loop findes i FACCI. Første konkrete tilbudsramme: Content Autopilot.",
    contentAngle:
      "Høj. Content er tæt på produktets kerne — ideelt sted at bevise partnerskabet hurtigt.",
    open: ["Endelig mission/pricing", "Præcis feature-liste udadtil", "Konkurrent-USP uden overclaims"],
    links: [
      {
        label: "Se AUTIQ",
        href: "https://autiq-liart.vercel.app/",
        primary: true,
      },
      {
        label: "Anden version",
        href: "https://autiq.vercel.app/",
      },
    ],
    pejling: "primær-kandidat",
  },
  {
    id: "nofacci",
    name: "NOFACCI",
    aliases: ["NoFaji Agency", "NOFACCI VISUALS"],
    oneLiner:
      "Agency omkring virtuelle AI-influencere — karakter først, teknologi bagefter.",
    problem:
      "Brands og publikum møder generisk ‘AI-content’ uden genkendelige personligheder, verdener og relation.",
    solution:
      "En portefølje af særskilte creator-karakterer under ét agency-lag (bl.a. Theah Rose, Zuma Wild, Nova Reamon, Elion Lior), med eget visuelt univers og stemme.",
    status: "undervejs",
    statusNote:
      "Ops-vault + brand pack + site-spor findes. Content *er* i høj grad produktet; officielt agency-navn/tagline stadig åbent.",
    contentAngle:
      "Høj. Naturligt content-maskineri — kræver disciplin i karakter-konsistens, ikke kun ‘flere opslag’.",
    open: [
      "Officielt public agency-navn vs. management-navn",
      "Agency-tagline og logo",
      "B2B-priser/klientliste uden opdigtede tal",
    ],
    links: [
      {
        label: "Se NOFACCI",
        href: "https://nofacci-agency.vercel.app/",
        primary: true,
      },
      {
        label: "Anden version",
        href: "https://nofacci-web.vercel.app/",
      },
    ],
    pejling: "primær-kandidat",
  },
  {
    id: "dreamit",
    name: "DREAMit",
    aliases: ["Dreamit", "DreamIT"],
    oneLiner: "Fra hobby til webshop — brand, udtryk og første shop for dem med en produktidé.",
    problem:
      "Kreative hobbyister og tidlige iværksættere har en idé/produkt, men mangler navn, udtryk og den første professionelle shop.",
    solution:
      "En tydelig rejse: hobby/produktidé → brandidentitet → website/webshop → lancering. Ikke et generisk digitalt bureau.",
    status: "undervejs",
    statusNote:
      "Brand pack + website-workspace findes. Stavning i brand-copy: DREAMit. Research-loop findes i FACCI. Ingen verificeret live landing for *dette* DREAMit endnu (dreamit.vercel.app peger på anden side).",
    contentAngle:
      "Middel–høj. Klar historie til service/content; mere B2B/case-drevet end daglig creator-content.",
    open: ["Pakkenavne/priser", "Mission-manifest", "Kundetal (må ikke opfindes)", "Public live URL"],
    links: [
      {
        label: "Se koden på GitHub",
        href: "https://github.com/vafacci/DREAMIT",
        primary: true,
      },
    ],
    pejling: "sekundær",
  },
  {
    id: "grupvi",
    name: "Grupvi",
    aliases: ["StudioChat", "StudieChat"],
    oneLiner:
      "Ét simpelt sted til studiegrupper: chat, medlemmer, projektinfo, deadline og links — uden tung setup.",
    problem:
      "Nye studiegrupper spredes ud over private chats og apps; det er akavet at forbinde via private sociale profiler.",
    solution:
      "Et digitalt kommunikations- og samarbejdsrum der supplerer eksisterende værktøjer (ikke endnu et socialt netværk).",
    status: "undervejs",
    statusNote:
      "App-workspace + brand pack findes. StudieChat er historisk arbejdsnavn; Grupvi er det aktuelle projektnavn. Live app kører under studiechat-deploy.",
    contentAngle:
      "Middel. Content giver mest værdi, når produktet kan demonstreres (invite → gruppe i gang).",
    open: ["Revenue-model", "Launch-timeline", "Brugertal"],
    links: [
      {
        label: "Se Grupvi",
        href: "https://studiechat.vercel.app/",
        primary: true,
      },
    ],
    pejling: "parkér",
  },
  {
    id: "dailycap",
    name: "DailyCap",
    oneLiner:
      "Personlig økonomi-app centreret om: “Hvor meget kan jeg trygt bruge i dag?”",
    problem:
      "Klassiske budgetter er tunge at fortolke midt i hverdagen — folk mangler en brugbar daglig beslutningsramme.",
    solution:
      "En daglig disponibel ramme (DailyCap) der hjælper med at bruge mindre og spare mere gennem bedre hverdagsbeslutninger — motiverende, ikke straffende.",
    status: "tidlig",
    statusNote:
      "Brand pack findes; vault-only i FACCI (ingen Desktop-app-path knyttet endnu). Bankspor (fx Nordea/Enable Banking) er teknisk kontekst — ikke overclaim i marketing.",
    contentAngle:
      "Middel. Stærk one-liner, men content bør vente på noget demonstrerbart for at undgå tomme produktløfter.",
    open: ["Launch-dato", "Pris", "Logo/palette", "Hvad der faktisk er shipped vs. udforsket"],
    links: [
      {
        label: "Se DailyCap",
        href: "https://dailycap.vercel.app/",
        primary: true,
      },
      {
        label: "Anden version",
        href: "https://dailycap-ouzc.vercel.app/",
      },
    ],
    pejling: "parkér",
  },
  {
    id: "scanna",
    name: "Scanna",
    aliases: ["Scana"],
    oneLiner:
      "Prissammenligning — live på scana-web. Detaljer udfyldes stadig sammen.",
    problem: "—",
    solution: "—",
    status: "ukendt",
    statusNote:
      "Ingen brand pack i FACCI endnu. Live site: scana-web.vercel.app.",
    contentAngle:
      "Ukendt. Få mindst: one-liner, problem, målgruppe og om content er kerne eller support — før I scorer det seriøst.",
    open: [
      "Hvad er Scanna på én sætning?",
      "Hvem er det til?",
      "Er det produkt, service eller content-brand?",
      "Hvad er næste bevis (prototype, landing, pilot)?",
    ],
    links: [
      {
        label: "Se Scanna",
        href: "https://scana-web.vercel.app/",
        primary: true,
      },
    ],
    pejling: "udfyld",
  },
];

export function emptyScores(): Record<string, Record<ScoreKey, number>> {
  const out: Record<string, Record<ScoreKey, number>> = {};
  for (const c of CONCEPTS) {
    out[c.id] = {
      startSpeed: 0,
      lowTime: 0,
      moneyPerHour: 0,
      impact: 0,
      contentEase: 0,
      contentCost: 0,
      certainty: 0,
      reach: 0,
    };
  }
  return out;
}

export function totalFor(scores: Record<ScoreKey, number>): number {
  return SCORE_CRITERIA.reduce((sum, c) => sum + (scores[c.key] || 0) * c.weight, 0);
}

export function maxTotal(): number {
  return SCORE_CRITERIA.reduce((sum, c) => sum + SCORE_MAX_POINTS * c.weight, 0);
}

/** Venteliste: Hurtig opstart er scoret og ligger på 3 eller under. */
export function isWaitlisted(scores: Record<ScoreKey, number>): boolean {
  const v = scores.startSpeed || 0;
  return v > 0 && v <= WAITLIST_START_THRESHOLD;
}
