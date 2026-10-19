# DailyCap — Brand Knowledge Document

**Formål:** Vidensgrundlag for DailyCaps Content Agent i Cursor.  
**Version:** 1.0 — rekonstruktion ud fra tilgængelige DailyCap-projektsamtaler.  
**Senest gennemgået:** 15. oktober 2026.  
**Omfang:** Kun DailyCap. Ingen oplysninger fra andre projekter er anvendt.

> **Vigtig kildebegrænsning:** Dette dokument bygger på de dele af DailyCap-projektets samtalehistorik, der er tilgængelige i denne samtale. Jeg har adgang til uddrag og kontekst fra projektsamtaler dateret 16., 17., 18., 19. og 29. september 2026, **ikke nødvendigvis deres fulde ordlyd eller hele projektets samtalearkiv**. Jeg har ikke inspiceret den aktuelle Cursor-kodebase, designs, brandfiler eller publiceret content. Det, som ikke kan dokumenteres i det tilgængelige materiale, er markeret som ukendt — ikke udfyldt med gæt.

---

## 1. Hvordan dokumentet skal læses

For ikke at forveksle idéer, præferencer og implementeret produkt bruges følgende statusmærker:

| Status | Betydning |
|---|---|
| **[FASTSLÅET]** | Direkte beskrevet eller tydeligt tilkendegivet i tilgængelige projektsamtaler. Det er en dokumenteret retning eller præference, **ikke automatisk dokumentation for implementering**. |
| **[UDFORSKET]** | En konkret idé, funktion eller mulighed, der har været diskuteret, men uden bekræftet endelig beslutning om løsning og lancering. |
| **[UDLEDT]** | En nærliggende fortolkning af de dokumenterede udsagn; den må ikke omtales som vedtaget brandpolitik. |
| **[IKKE FASTLAGT]** | Ingen tilstrækkelig dokumentation i den tilgængelige historik. |
| **[TEKNISK KONTEKST]** | En teknisk observation eller et udviklingsspor, relevant for at undgå fejlagtige produktløfter, men ikke i sig selv en brandbeslutning. |

**Grundregel til Content Agenten:** Behandl ikke `[UDFORSKET]`, `[UDLEDT]` eller `[IKKE FASTLAGT]` som etablerede, brugerrettede fakta. At noget er `[FASTSLÅET]` som produktvision betyder heller ikke, at det er bygget eller lanceret.

---

## 2. Brandets kerne: Hvad DailyCap er, og hvad det står for

### 2.1 Identitet og grundidé

- **[FASTSLÅET]** Brand-/produktnavnet er **DailyCap**.
- **[FASTSLÅET]** DailyCap er en **personlig økonomi-/budgetapp** med én overordnet kerneopgave: at hjælpe brugeren med at forstå, **hvor meget vedkommende kan bruge i dag**.
- **[FASTSLÅET]** Projektets egen engelske formulering af kernespørgsmålet er: **“How much can I safely spend today?”** Dette er det tydeligste dokumenterede udtryk for produktets idé. Det er **ikke dokumenteret som et officielt slogan**.
- **[FASTSLÅET]** Projektet tager afsæt i en daglig disponibel ramme — en *DailyCap* — frem for at bede brugeren om konstant at fortolke et stort, komplekst budget.
- **[FASTSLÅET]** Bankforbindelse og registrering af transaktioner er et konkret udviklingsspor, blandt andet med **Nordea Danmark** og **Enable Banking**.

**Hvad dette betyder for brandforståelsen:** DailyCap udspringer af et meget konkret spørgsmål i hverdagsøkonomien: *Hvad har jeg reelt plads til at bruge i dag?* Produktets omdrejningspunkt er en brugbar daglig beslutning, ikke blot en oversigt over historisk forbrug.

### 2.2 Økonomisk tryghed og adfærd

- **[FASTSLÅET]** Visionen er ikke kun at vise et tal, men at hjælpe brugeren med at **bruge færre penge og spare flere penge op** gennem bedre hverdagsbeslutninger.
- **[FASTSLÅET]** Projektet undersøger en oplevelse, hvor økonomisk disciplin bliver mere **motiverende, sjov og spilagtig**.
- **[UDLEDT]** Brandets funktionelle værdi handler om forståelighed og overblik; den ønskede følelsesmæssige værdi handler om motivation og mestring frem for afsavn.

**Vigtig afgrænsning:** Spilagtig motivation er et produkt-/oplevelsesprincip, der er diskuteret stærkt. Det dokumenterer ikke, at DailyCap allerede har et fuldt gamification-system.

### 2.3 Hvad DailyCap ikke kan beskrives som på det foreliggende grundlag

- **[IKKE FASTLAGT]** En investeringsplatform som nuværende hovedprodukt.
- **[IKKE FASTLAGT]** En bank, der selv opbevarer eller flytter brugerens penge.
- **[IKKE FASTLAGT]** Et produkt med realtidsoverblik over samtlige kortreservationer.
- **[IKKE FASTLAGT]** En app, hvor de udforskede funktioner til *Carry*, *Save* og *Spread* allerede er lanceret.
- **[IKKE FASTLAGT]** En app med dokumenterede økonomiske effekter, eksempelvis at en gennemsnitsbruger sparer et bestemt beløb.

---

## 3. Vision, formål og langsigtet retning

### 3.1 Det nuværende formål

**[FASTSLÅET]** Det centrale formål er at gøre dagens økonomiske råderum klart for brugeren. Den primære produktoplevelse kredser om at få svar på, hvad der kan bruges i dag.

**[UDLEDT]** På den måde forsøger DailyCap at forbinde økonomisk overblik med den konkrete beslutning, der sker, *før* pengene bruges.

### 3.2 At give ubrugte penge en betydning

**[FASTSLÅET som produktretning / UDFORSKET som konkret funktion]** En vigtig retning er, at penge, som er tilbage ved dagens slutning, **ikke bare skal forsvinde ind i næste dags genberegning**. Brugeren skal kunne opleve, at det har en positiv og forståelig konsekvens at bruge mindre end dagens ramme.

Det konkrete eksempel fra projektet:

| Eksempel | Beløb |
|---|---:|
| Dagens DailyCap | 300 kr. |
| Forbrugt i løbet af dagen | 100 kr. |
| Ubrugt beløb | 200 kr. |

De tre diskuterede muligheder for de resterende 200 kr.:

1. **Carry** — hele eller en del af beløbet lægges til næste dags forbrugsramme.
2. **Save** — hele eller en del af beløbet øremærkes til virtuel opsparing eller et opsparingsmål og holdes uden for det umiddelbart disponible forbrug.
3. **Spread** — beløbet fordeles over resten af budgetperioden.

**Status:** Konceptuelt beskrevet og positivt modtaget i samtaler 17.–18. september 2026. Ingen dokumentation i tilgængelig historik for den endelige UX, automatiseringsregler, teknisk implementering eller release-status.

### 3.3 Opsparing og investering på længere sigt

- **[UDFORSKET]** Automatiske regler og procentfordelinger af ubrugte beløb.
- **[UDFORSKET]** Virtuelle opsparingsbalancer og konkrete opsparingsmål.
- **[UDFORSKET]** Mulighed for fremtidige **rigtige overførsler** til en opsparingskonto.
- **[UDFORSKET]** Mulighed for senere **investeringsallokering**.
- **[UDFORSKET]** Streaks og andre spilmekanikker, som gør fremskridt mærkbare.
- **[FASTSLÅET som positiv præference]** Ejeren af produktidéen udtrykte begejstring for, at opsparing — og eventuelt senere investering — kunne opleves mere som et spil.

**Vigtig sondring:** En *virtuel* opsparing er ikke det samme som en bankoverførsel. Investering er omtalt som en mulig fremtidig retning, ikke som en vedtaget eller leveret service.

### 3.4 Tidshorisont og ambitionsniveau

- **[FASTSLÅET]** I september 2026 blev projektet omtalt som et **MVP under udvikling**, mens næste generations produktretning blev undersøgt særskilt.
- **[FASTSLÅET med tidsforbehold]** I en beskedudkast-kontekst 18. september beskrev brugeren konceptet som næsten klar til at gå i luften. Det er en **samtidig ambition/statusbeskrivelse**, ikke dokumentation for, at appen blev lanceret.
- **[IKKE FASTLAGT]** Faktisk lanceringsdato, geografisk skalering, vækstmål, omsætningsmål, abonnementsmodel, virksomhedens mission statement og investerings-/banklicensplaner.

---

## 4. Målgruppe og positionering

### 4.1 Hvem produktet er tænkt at hjælpe

- **[FASTSLÅET]** Samtalerne tager specifikt udgangspunkt i mennesker, som oplever, at det er svært **at holde igen med forbrug og spare penge op**.
- **[FASTSLÅET]** En vigtig designbekymring er, at brugeren **ikke må føle sig overvældet**.
- **[UDLEDT]** Produktet er derfor særligt relevant for brugere, der ønsker hjælp til en enkel, tilbagevendende hverdagsbeslutning frem for mere manuel budgetadministration.
- **[UDLEDT]** Oplevet fremgang og motivation kan være væsentlige for mennesker, som har svært ved at opretholde gode økonomiske vaner alene ved hjælp af traditionelle budgettal.

Dette er en **kvalitativ behovsbeskrivelse**, ikke en formelt valideret målgruppesegmentering.

### 4.2 Geografi og økonomisk kontekst

- **[TEKNISK KONTEKST]** Projektet har undersøgt **Nordea Danmark**, og eksemplerne bruger **danske kroner (DKK)**.
- **[UDLEDT]** En dansk anvendelseskontekst er nærliggende for det aktuelle udviklingsarbejde.
- **[IKKE FASTLAGT]** Danmark som eksklusivt lanceringsmarked, præcis national målgruppe, sprogpolitik eller konkret international ekspansion.

### 4.3 Positionering

- **[FASTSLÅET]** Den mest tydelige differentiering i samtalerne er fokus på spørgsmålet **“How much can I safely spend today?”**
- **[UDFORSKET]** Et yderligere særkende kunne blive, at dagens resterende beløb kan omsættes til valg, fremgang og opsparing.
- **[UDFORSKET]** Gamification er tænkt som noget, der kan gøre økonomisk disciplin vedvarende engagerende uden at virke overvældende.
- **[FASTSLÅET]** *Actual Budget* blev taget op som genstand for konkurrentanalyse den 19. september 2026.
- **[IKKE FASTLAGT]** En officiel konkurrentpositionering, kategoribetegnelse, differentieringsmatrix, prisposition eller vedtaget USP-tekst. Det tilgængelige uddrag fra konkurrenttråden indeholder især tekniske forhold og giver ikke grundlag for konkrete konklusioner om Actual Budgets styrker/svagheder.

### 4.4 Det, vi ikke ved om målgruppen

**[IKKE FASTLAGT]** Alder, køn, livsfase, indkomstniveau, beskæftigelse, bankpræferencer, økonomisk kompetenceniveau, specifikke personas, konkrete smertepunkter fra brugerinterviews og målt betalingsvillighed.

---

## 5. Brandets personlighed og tone of voice

Der findes **ingen dokumenteret, færdig tone-of-voice-guide** i det tilgængelige materiale. Nedenstående beskriver derfor kun de oplevelsespræferencer, som samtalerne faktisk understøtter.

### 5.1 Dokumenterede oplevelsespræferencer

| Egenskab | Status og evidens |
|---|---|
| **Enkelt at forstå** | **[UDLEDT]** af et skarpt spørgsmål om dagens beløb og ønsket om ikke at overvælde brugeren. |
| **Motiverende og sjovt** | **[FASTSLÅET]** Brugeren ønsker, at opsparing og økonomisk selvkontrol skal føles mere som et spil. |
| **Spilagtigt på en mærkbar måde** | **[FASTSLÅET]** For subtil gamification blev kritiseret: oplevelsen skal stadig føles som et spil og skabe motivation. |
| **Ikke overvældende** | **[FASTSLÅET]** For meget gamification og kompleksitet må ikke presse brugeren. |
| **Balance mellem leg og ro** | **[FASTSLÅET som designpræference]** Der søges en præcis midte mellem nedtonet og tydelig gamification. |
| **Følelse af fremskridt** | **[FASTSLÅET som mål]** Brugeren skal opleve, at man bliver bedre til “spillet” og dermed også bedre til at spare. |

### 5.2 Hvad der ikke er fastlagt kommunikativt

- **[IKKE FASTLAGT]** Om brandet skal tiltale brugeren med “du”, “vi” eller andre former.
- **[IKKE FASTLAGT]** Præcis grad af humor, selvironi, emojis, slang, uformel tone, alvor eller autoritet.
- **[IKKE FASTLAGT]** Ord, vendinger, brandmantraer, slogan, CTA-stil og terminologiregler i publiceret kommunikation.
- **[IKKE FASTLAGT]** Om den eksterne kommunikation primært skal være på dansk, engelsk eller begge dele.
- **[IKKE FASTLAGT]** Hvor eksplicit spilmetaforer må fylde i markedsføring kontra selve appoplevelsen.

**Vejledning til Content Agenten:** Beskriv de ovenstående forhold som **dokumenterede produktoplevelsesmål**, ikke som en allerede godkendt sproglig brandmanual. Undlad at opfinde en “officiel DailyCap-stemme”.

---

## 6. Visuel identitet, stil og æstetik

### 6.1 Hvad samtalerne faktisk siger

- **[FASTSLÅET som UX-præference]** Appens spilagtige elementer skal være **mærkbare** nok til at motivere.
- **[FASTSLÅET som UX-præference]** Det visuelle og oplevelsesmæssige udtryk må ikke føles **overvældende**.
- **[FASTSLÅET som UX-præference]** For svag og for stærk gamification er begge blevet problematiseret; balancen er vigtig.

Der er **ikke nok kildemateriale** til at udlede en bestemt visuel stil af disse præferencer alene. “Underspillet gamification” er ikke i sig selv en beslutning om farver, illustrationer, formsprog eller branding.

### 6.2 Ikke dokumenterede visuelle brandbeslutninger

Alle følgende forhold er **[IKKE FASTLAGT]** i den tilgængelige historik:

- Logo, logovarianter, symbol og placering.
- Brandfarver, hexkoder, lys/mørk tilstand og farvebetydning.
- Typografi, fonte, teksthierarki og typografiske regler.
- Illustrationer, 3D, fotografi, ikonstil, karakterer eller maskot.
- UI-stil: kort, gradients, skygger, former, animationstempo og mikrointeraktioner.
- Skabeloner til sociale medier, annonceformater, præsentationer og app store-materiale.
- En officiel designmanual eller visuel referencepakke.

**Praktisk konsekvens:** Content Agenten bør ikke beskrive DailyCap som eksempelvis “minimalistisk sort/hvid”, “neon-gaming”, “skandinavisk premium” eller “farverig fintech”, medmindre sådanne valg fremgår af andet konkret DailyCap-materiale.

---

## 7. Contentretning, temaer og platforme

### 7.1 Emner, som er direkte forankret i projektet

Der er ikke fastlagt en egentlig contentstrategi i de tilgængelige samtaler. Følgende er **dokumenterede emneområder i produktdiskussionerne** — ikke en bekræftet publiceringsplan:

| Emneområde | Historisk grundlag | Status som contenttema |
|---|---|---|
| **Hvad kan jeg bruge i dag?** | Projektets kernespørgsmål og daglige råderum. | **[FASTSLÅET som produktkerne]**, **[IKKE FASTLAGT som redaktionelt format]** |
| **At spare op gennem hverdagsbeslutninger** | Ønsket om at gøre det lettere og sjovere ikke at bruge alle pengene. | **[FASTSLÅET som motivation]**, **[IKKE FASTLAGT som kampagnespor]** |
| **Hvad sker der med dagens resterende penge?** | Eksemplet med 300/100/200 kr. og Carry/Save/Spread. | **[UDFORSKET som funktion]**, **[IKKE FASTLAGT som publiceret featurefortælling]** |
| **Økonomi, der føles mere som et spil** | Gamification-diskussionen 29. september. | **[FASTSLÅET som foretrukken produktretning]**, **[IKKE FASTLAGT som markedsføringsvinkel]** |
| **Fremskridt og gode vaner** | Ønsket om, at det at blive bedre til spiloplevelsen fører til at spare mere. | **[UDLEDT som fortælling]**, **[IKKE FASTLAGT som redaktionel serie]** |
| **Bankkobling og transaktionsforståelse** | Nordea/Enable Banking-arbejdet. | **[TEKNISK KONTEKST]**, **[IKKE FASTLAGT som eksternt contentområde]** |

### 7.2 Hvad vi ikke har beslutningsgrundlag for

Alt følgende er **[IKKE FASTLAGT]**:

- Prioriterede platforme (Instagram, TikTok, LinkedIn, YouTube, X, nyhedsbrev, blog mv.).
- Content pillars som formelt vedtaget strategi.
- Frekvens, publiceringstidspunkter, contentkalender og kanalfordeling.
- Mål for reach, engagement, konvertering eller brand awareness.
- Paid versus organisk strategi, creators, influencer-samarbejder og community-aktiviteter.
- Contentformater, faste serier, manuskriptskabeloner, billed- og videostil.
- Officielle budskaber, kampagner, hashtags eller lanceringstekster.
- Godkendelsesflow, kvalitetskrav og ansvarsfordeling for Content Agenten.

**Afgrænsning:** Dokumentet introducerer bevidst **ikke** nye content pillars, kampagnekoncepter eller platformanbefalinger. Det registrerer kun de emner, der allerede findes i samtalerne.

---

## 8. Tidligere beslutninger, præferencer, afvejninger og fravalg

### 8.1 Bekræftede retninger og præferencer

1. **[FASTSLÅET] DailyCaps kerne er den daglige økonomiske beslutning.** Spørgsmålet “How much can I safely spend today?” har været eksplicit formuleret som produktets centrale omdrejningspunkt.
2. **[FASTSLÅET] Mindre forbrug skal kunne opleves som en positiv præstation.** Opsparing skal være mere motiverende end blot at afstå fra at købe noget.
3. **[FASTSLÅET] Ubrugte penge ved dagens slutning er et vigtigt mulighedsrum.** Det ønskes undersøgt, om pengene kan få en tydeligere betydning gennem Carry, Save og Spread.
4. **[FASTSLÅET] Gamification skal have reel effekt på oplevelsen.** Et næsten usynligt spilpræg blev afvist som for svagt.
5. **[FASTSLÅET] Gamification må ikke blive overvældende.** Et tungt, stimulerende eller kompliceret lag er heller ikke ønsket.
6. **[FASTSLÅET] Man ønsker et præcist mellemleje.** Oplevelsen skal være tilstrækkeligt sjov og belønnende uden at gøre økonomioverblik tungt.
7. **[FASTSLÅET] Fremtidig produktinnovation blev bevidst undersøgt adskilt fra den aktive MVP-implementering.** Agentoplægget 18. september understregede, at næste generation skulle udforskes uden at ændre den daværende MVP.

### 8.2 Fravalg — hvad kan faktisk siges?

- **[FASTSLÅET som designafvisning]** **For subtil** gamification er ikke tilstrækkelig til den ønskede oplevelse.
- **[FASTSLÅET som designafvisning]** **For meget** gamification, så brugeren føler sig overvældet, er heller ikke ønsket.
- **[FASTSLÅET som udviklingsafgrænsning på daværende tidspunkt]** Udforskningen af næste generation skulle ikke i sig selv ændre den igangværende MVP.
- **[IKKE FASTLAGT]** Permanente fravalg af konkrete features, farver, indholdsplatforme, designretninger eller indtægtsmodeller. Disse må ikke opfindes.

### 8.3 Vigtige åbne diskussioner

- **[UDFORSKET]** Hvornår og hvordan dagens overskud skal tilbydes brugeren.
- **[UDFORSKET]** Om resterende penge skal kunne fordeles manuelt, automatisk eller via regler.
- **[UDFORSKET]** Hvordan gamification kan give tilfredsstillelse uden distraktion eller pres.
- **[UDFORSKET]** Hvordan virtuel opsparing på længere sigt kan hænge sammen med faktiske bankoverførsler og eventuelt investering.

Der er ingen dokumenteret endelig beslutning om disse detaljer i den tilgængelige historik.

---

## 9. Produktfakta og begrænsninger, som Content Agenten skal respektere

Dette afsnit er med, fordi kommunikation om en økonomiapp let kan komme til at love mere, end den tekniske løsning dokumenterer. Det er **ikke** et forslag til implementering.

### 9.1 Bankdata og Nordea

- **[TEKNISK KONTEKST]** Projektet har arbejdet med at koble DailyCap til **Nordea Danmark via Enable Banking**.
- **[TEKNISK KONTEKST]** Den beskrevne arkitektur lader bankforbindelsen gå gennem en backend, hvor følsomme adgangsoplysninger skal blive på serversiden.
- **[TEKNISK KONTEKST]** Enable Banking/AIS blev beskrevet som **poll-baseret**; betalingswebhooks var ikke det samme som øjeblikkelige notifikationer om AIS-kortkøb.
- **[TEKNISK KONTEKST]** I en audit 19. september blev det beskrevet, at DailyCaps daværende budgetberegning **ignorerede ventende/reserverede transaktioner** og kun reagerede på **bogførte** transaktioner (`BOOK`).
- **[TEKNISK KONTEKST]** En tidligere Nordea-observation 18. september rapporterede ingen returnerede `PDNG`/`HOLD`-transaktioner i det undersøgte øjeblik, selv om Nordea-appen viste reservationer. Resultatet blev **ikke** anset for endeligt; yderligere måling var nødvendig.
- **[TEKNISK KONTEKST]** En teknisk spike dokumenterede blandt andet behov for test af forsinkelse fra kortkøb til bankdata, pending→booked-forløb og opdateringshyppighed.

### 9.2 Konkrete kommunikationsmæssige konsekvenser

Content Agenten må **ikke** uden ny dokumentation skrive, at:

- DailyCap opdateres **øjeblikkeligt ved hvert køb**.
- DailyCap med sikkerhed tæller **alle kortreservationer** med i den viste dagsramme.
- Appens viste rådighedsbeløb altid er en **garanti** for, at pengene kan bruges uden risiko for overtræk.
- DailyCap allerede **flytter penge** til en rigtig opsparingskonto.
- DailyCap allerede **investerer penge** på brugerens vegne.
- Carry/Save/Spread, streaks eller et bestemt spil-/belønningssystem allerede er tilgængeligt.
- Appen allerede er **live**, har bestemte bankintegrationer i produktion eller leverer dokumenterede opsparingsresultater.

Disse begrænsninger skyldes **manglende bekræftelse i det tilgængelige materiale**, ikke en påstand om, at produkterne eller funktionerne umuligt kan eksistere i en nyere kodebase.

### 9.3 Hvorfor ordet “safely” kræver omtanke

**[FASTSLÅET]** Det engelske kernespørgsmål bruger ordet *safely*. Det udtrykker brugerens ønskede tryghed og klarhed. **[TEKNISK KONTEKST]** De observerede begrænsninger omkring bogføring og reservationer betyder, at dette ikke uden videre kan omsættes til et absolut løfte om et fuldt realtidskorrekt beløb. Kommunikationen skal kunne skelne mellem **produktets ambition** og **faktisk verificeret funktionalitet**.

---

## 10. Retningslinjer for DailyCaps Content Agent: korrekt repræsentation af historikken

Dette er **videns- og kildeinstruktioner**, ikke en ny contentstrategi.

### 10.1 Hvad agenten kan bruge som sikkert fundament

- Navnet **DailyCap**.
- Produktkategorien: **personlig økonomi-/budgetapp**.
- Kerneproblemet: **hvor meget kan jeg bruge i dag?**
- Den eksplicitte oprindelige formulering: **“How much can I safely spend today?”**
- Ambitionen om **bedre forbrugskontrol og opsparingsadfærd**.
- Den tydelige interesse for **meningsfuldt overskud ved dagens slutning**.
- Den tydelige interesse for **gamification som motivationsgreb**, med balance mellem leg og enkelhed.
- Produktkonteksten med **DKK, Nordea Danmark og Enable Banking**, når den omtales præcist som udviklingskontekst og ikke som ukritisk lanceringspåstand.

### 10.2 Hvad agenten kun må omtale som idéer eller fremtidige muligheder

- Valgene **Carry / Save / Spread**.
- Virtuel opsparing og opsparingsmål, medmindre en aktuel produktkilde bekræfter implementering.
- Automatiske fordelingsregler og streaks.
- Faktiske opsparingsoverførsler og investeringsallokering.
- En bestemt gamification-mekanik, økonomisk belønning eller udfordringsstruktur.

### 10.3 Hvad agenten ikke må opfinde

- Målgruppepersonaer, aldersgrupper, indkomstniveauer og gennemført brugerresearch.
- Brandfarver, font, logo, maskot, designstil eller officielle UI-principper.
- Social media-kanaler, contentfrekvens, annonceringsbudget og kampagner.
- Officielle slogans eller godkendte claims ud over de faktisk dokumenterede formuleringer.
- Produktionsstatus, featuretilgængelighed, integrationsdækning, abonnementspris og opsparingseffekt.
- Konkurrentfordele, som der ikke findes konkrete analyseresultater for i det tilgængelige materiale.

### 10.4 Sådan adskilles fortid, idé og nutid

Hvis en ældre samtale beskriver en funktion, siger det alene noget om **projektets diskussion på den dato**. En Content Agent må ikke automatisk omsætte det til nutid (“DailyCap tilbyder…”). Brug tidsmæssig og faktuel præcision, og skeln mellem:

1. **Produktets formål:** det, DailyCap skal hjælpe med.
2. **Dokumenteret produktretning:** det, der tydeligt blev ønsket.
3. **Tidligere undersøgt løsning:** det, der blev foreslået eller udforsket.
4. **Verificeret nuværende funktion:** det, som kræver nyere produktdokumentation eller faktisk kontrol af appen.

---

## 11. Kildeoversigt: tilgængelige DailyCap-projektsamtaler

Denne oversigt er lagt ind, så efterfølgende brugere af dokumentet kan spore oplysningerne tilbage til deres oprindelse. Titlerne og datoerne kommer fra den tilgængelige projektkontekst; uddragene er ikke nødvendigvis komplette samtaler.

| Dato | Projektsamtale | Relevans for brandviden | Kildebegrænsning |
|---|---|---|---|
| **16. sep. 2026** | *Lav budgetapp til Nordea* | DailyCap som bankforbundet budgetapp; Nordea/Enable Banking; mulige databegrænsninger. | Synligt teknisk uddrag; ingen visuel brandguide. |
| **17. sep. 2026** | *Opsæt agentautomatisering* | Første tydelige retning om at bruge dagens ubrugte penge til mere end næste dags genberegning; carry/opsparing/fordeling og mulig fremtidig investering. | Samtaleuddrag; ukendt endelig featurebeslutning. |
| **18. sep. 2026** | *DailyCap Product Research* | Eksplicit kerne: “How much can I safely spend today?”; eksempel 300/100/200 kr.; Carry/Save/Spread; langsigtede muligheder som regler, opsparingsmål, streaks og investering. | Formuleret som forsknings-/innovationsoplæg til næste generation, ikke release-noter. |
| **18. sep. 2026** | *Besked til onkel* | Samtidig beskrivelse af, at konceptet nærmede sig lancering. | Kommunikationskontekst, ikke bevis for lanceret app eller vedtaget brandtone. |
| **19. sep. 2026** | *Konkurrentanalyse af Actual Budget* | Konkurrentkontekst og vigtig indsigt i pending-/booked-behandling og forsinkede bankdata. | Synligt uddrag fra teknisk audit; ikke en komplet konkurrentanalyse. |
| **29. sep. 2026** | *Gamify opsparing appen* | Den stærkeste direkte dokumentation for ønsket om en spilagtig, sjov, motiverende, men ikke overvældende oplevelse. | Synlige brugerbeskeder; ikke en færdig gamification-specifikation. |

### Centrale formuleringer i materialet

> “How much can I safely spend today?”  
> — Produktets eksplicit beskrevne kernespørgsmål, 18. september 2026.

> “If a user has money left from today's DailyCap, the leftover should become something meaningful rather than simply disappearing into tomorrow's recalculation.”  
> — Engelsk innovationsoplæg, 18. september 2026.

> “jeg gad vireklig godt gøre den her app mere gamify”  
> — Brugerens ønske om en mere spilagtig app, 29. september 2026.

> “det vigtigt at brugeren ikke føler sig over vælet, men at det stadig giver noget dopeamin, ligesom et rigtigt spil”  
> — Brugerens afvejning mellem spilfølelse og overstimulering, 29. september 2026.

> “det går lidt for meget væk fra at det bliver et gamify koncept”  
> — Brugerens korrektion af en tidligere for underspillet retning, 29. september 2026.

*Bemærk: De synlige ordrette uddrags originale stavemåde er bevaret.*

---

## 12. Samlet vidensstatus

### Tydeligst forankret

DailyCap er en personlig økonomiapp med fokus på **dagens disponible forbrug**. Projektet vil gøre det lettere at styre forbrug og spare penge, og der er en eksplicit ambition om, at økonomisk fremgang skal føles **motiverende og spilagtig**. To konkrete konceptuelle udvidelser har fyldt meget: **at give dagens ubrugte beløb en meningsfuld anvendelse** og **at finde den rette balance mellem sjov gamification og enkelhed**.

### Udforsket, men ikke verificeret som færdigt produkt

Carry/Save/Spread, virtuel opsparing, opsparingsmål, automatik, streaks, faktiske bankoverførsler og investering. Der findes et teknisk udviklingsspor med Nordea og Enable Banking, men den tilgængelige samtalehistorik bekræfter ikke aktuelle features eller endelig lanceringstilstand.

### Fortsat ukendt i det foreliggende materiale

En egentlig **brandmanual** med logo, farver, typografi, målgruppepersonaer, tone-of-voice-regler, platformvalg, contentplan, godkendte marketingbudskaber og langsigtede forretningsmål. Disse felter skal stå åbne, indtil projektets egen dokumentation fastlægger dem.

**Slutregel til Cursor / DailyCap Content Agent:** Brug dette dokument som **historisk brandkontekst med eksplicit usikkerhed**, ikke som en erstatning for verificeret aktuel produktstatus eller en brandguide, der endnu ikke er dokumenteret. Byg ikke nye påstande oven på uafklarede antagelser.
