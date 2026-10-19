/**
 * Shared portfolio briefing for content partnership ranking.
 * Facts drawn from brand packs / product docs — Scanna is intentionally blank.
 */

export type ScoreKey =
  | "story"
  | "contentCore"
  | "materials"
  | "feedback"
  | "roleFit";

export const SCORE_CRITERIA: {
  key: ScoreKey;
  label: string;
  hint: string;
}[] = [
  {
    key: "story",
    label: "Nem at forklare",
    hint: "Kan I sige det på ca. 10 sekunder?",
  },
  {
    key: "contentCore",
    label: "Content er centralt",
    hint: "Er indhold selve grejet — eller bare marketing omkring noget andet?",
  },
  {
    key: "materials",
    label: "Klar til at lave ting",
    hint: "Er der brand, stemme og eksempler at bygge på?",
  },
  {
    key: "feedback",
    label: "Hurtigt at mærke effekt",
    hint: "Kan I se noget på 2–4 uger?",
  },
  {
    key: "roleFit",
    label: "Passer til os to",
    hint: "Passer det godt til tech + content lige nu?",
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
      story: 0,
      contentCore: 0,
      materials: 0,
      feedback: 0,
      roleFit: 0,
    };
  }
  return out;
}

export function totalFor(scores: Record<ScoreKey, number>): number {
  return SCORE_CRITERIA.reduce((sum, c) => sum + (scores[c.key] || 0), 0);
}

export function maxTotal(): number {
  return SCORE_CRITERIA.length * 5;
}
