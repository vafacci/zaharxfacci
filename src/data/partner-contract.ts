/**
 * FACCI × ZAHAR — samarbejds- og partnerskabsaftale (UDKAST).
 * Tekst er gengivet fra PDF'en "FACCI_x_ZAHAR_Samarbejdsaftale". Ret begge steder ved ændringer.
 */

export const CONTRACT_PDF_HREF = "/aftale/FACCI_x_ZAHAR_Samarbejdsaftale.pdf";

export const CONTRACT_META = {
  title: "Samarbejds- og partnerskabsaftale",
  status: "Udkast",
  parties: "Dayan Vafai og Zahar [fulde navn]",
  effective: "[Dato]",
  note: "Dette er et aftaleudkast. Inden underskrift bør parterne afklare virksomhedsform og ejerskab til allerede eksisterende aktiver samt få aftalen juridisk gennemgået.",
} as const;

export type ContractSection = {
  id: string;
  number: string;
  title: string;
  /** Almindelige afsnit */
  paragraphs?: string[];
  /** Punktliste */
  bullets?: string[];
  /** Efterfølgende afsnit efter punktlisten */
  after?: string[];
  /** Nøgle/værdi-liste, fx rollerne eller koncepterne */
  items?: { label: string; value: string }[];
};

export const CONTRACT_SECTIONS: ContractSection[] = [
  {
    id: "formaal",
    number: "1",
    title: "Formål",
    paragraphs: [
      "Parterne indgår et fælles forretningspartnerskab med henblik på at udvikle, drive og vækste digitale forretningskoncepter. Samarbejdet bygger på ligeværdighed, tillid, engagement og fælles ambitioner.",
    ],
  },
  {
    id: "ejerskab",
    number: "2",
    title: "Ejerskab og fordeling",
    bullets: [
      "Partnerskabets godkendte fælles virksomheder og projekter ejes 50/50.",
      "Overskud, tab og internt aftalte økonomiske forpligtelser fordeles som udgangspunkt ligeligt, med forbehold for gældende lovgivning og den valgte virksomhedsform.",
      "Begge parter har lige beslutningsret i væsentlige forretningsmæssige forhold.",
      "Nye projekter kan optages i partnerskabet efter fælles skriftlig aftale.",
      "Eksisterende aktiver, kode, brands og rettigheder overgår kun til fællesskabet, når dette udtrykkeligt er aftalt skriftligt.",
    ],
  },
  {
    id: "roller",
    number: "3",
    title: "Roller og forventninger",
    items: [
      {
        label: "Dayan — teknologi og produktudvikling",
        value: "Udvikling, programmering, produktudvikling og teknisk drift.",
      },
      {
        label: "Zahar — content og marketing",
        value:
          "Contentproduktion, markedsføring, kreativ retning, branding og sociale medier.",
      },
    ],
    after: [
      "Begge parter deltager aktivt i strategi, forretningsudvikling og fælles beslutninger. Parterne forpligter sig til mindst ét fælles møde om ugen samt løbende opfølgning på aftalte opgaver.",
      "Der er ingen fast ugentlig arbejdstid, men begge forventes at bidrage aktivt. Roller og opgaver kan justeres ved fælles aftale.",
    ],
  },
  {
    id: "koncepter",
    number: "4",
    title: "Forretningskoncepter",
    paragraphs: ["Følgende seks koncepter danner udgangspunkt for samarbejdet:"],
    items: [
      { label: "01 · AUTIQ", value: "AI-content og automatisering" },
      { label: "02 · NOFACCI", value: "AI-influencer agency" },
      { label: "03 · DREAMit", value: "Branding, websites og webshops" },
      { label: "04 · Grupvi", value: "Digital samarbejdsplatform til studiegrupper" },
      { label: "05 · DailyCap", value: "Personlig økonomi- og budgetapplikation" },
      { label: "06 · Scanna", value: "Prissammenligningsplatform" },
    ],
    after: [
      "Parterne fastlægger særskilt, hvilke allerede eksisterende aktiver og rettigheder der indgår i det fælles ejerskab. Ikke alle projekter skal drives aktivt fra starten; prioriteringen aftales i fællesskab. Nye koncepter kan tilføjes skriftligt.",
    ],
  },
  {
    id: "oekonomi",
    number: "5",
    title: "Økonomi",
    bullets: [
      "Der oprettes en fælles erhvervskonto, eksempelvis gennem Lunar.",
      "Dinero kan anvendes til regnskab og bogføring.",
      "Alle fælles indtægter og udgifter registreres, og begge parter har indsigt i økonomien.",
      "Større investeringer, optagelse af gæld og udgifter uden for godkendt budget kræver enighed.",
      "Udbetaling af overskud og geninvestering besluttes i fællesskab.",
    ],
  },
  {
    id: "proeveperiode",
    number: "6",
    title: "Prøveperiode – 3 måneder",
    paragraphs: [
      "Partnerskabet indledes med en prøveperiode på tre måneder fra ikrafttrædelsesdatoen. Efter perioden evalueres samarbejdet, arbejdsfordelingen, resultaterne og den fremtidige retning. Begge parter kan afslutte samarbejdet i prøveperioden efter reglerne om exit.",
    ],
  },
  {
    id: "exit",
    number: "7",
    title: "Exit og ophør",
    paragraphs: [
      "Begge parter kan vælge at trække sig fra partnerskabet ved skriftlig meddelelse. Ved ophør gælder følgende:",
    ],
    bullets: [
      "Fælles økonomi, udestående betalinger, gæld og forpligtelser opgøres først.",
      "Den resterende frie likviditet fordeles 50/50.",
      "Dokumenterede partnerlån og udlæg afregnes efter deres oprindelige aftaler.",
      "Fælles virksomheder, brands, kode og øvrige aktiver overtages til en aftalt værdi, sælges eller afvikles efter fælles aftale.",
      "Ingen part kan ensidigt overtage fælles aktiver eller fortsætte som eneejer uden aftale.",
      "Hvis parterne ikke kan blive enige om værdien af et fælles projekt, indhentes en uafhængig vurdering.",
    ],
  },
  {
    id: "andre-forretninger",
    number: "8",
    title: "Andre forretninger",
    paragraphs: [
      "Begge parter må frit drive andre virksomheder og projekter ved siden af partnerskabet. Disse er ikke automatisk omfattet af 50/50-ejerskabet.",
    ],
  },
  {
    id: "uenigheder",
    number: "9",
    title: "Uenigheder og ændringer",
    paragraphs: [
      "Væsentlige beslutninger kræver enighed. Uenigheder forsøges først løst gennem dialog og eventuelt med hjælp fra en neutral tredjepart. Ændringer til aftalen skal godkendes skriftligt af begge parter.",
    ],
  },
  {
    id: "underskrifter",
    number: "10",
    title: "Underskrifter",
    paragraphs: ["Aftalen tiltrædes af begge parter på nedenstående dato."],
  },
];

/** Kort overblik øverst på siden — kun gengivelse af, hvad aftalen allerede siger. */
export const CONTRACT_HIGHLIGHTS: { label: string; value: string }[] = [
  { label: "Ejerskab", value: "50/50" },
  { label: "Prøveperiode", value: "3 måneder" },
  { label: "Fælles møde", value: "Mindst 1× om ugen" },
  { label: "Beslutninger", value: "Væsentlige kræver enighed" },
];
