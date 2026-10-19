# GRUPVI — Brand Knowledge Document

**Version:** 1.0 — historikbaseret dokumentation  
**Dato:** 15. oktober 2026  
**Formål:** At give FACCI AGENT og Grupvis eksisterende Content Agent en kort, præcis brandreference til brug i Cursor.  
**Kildegrundlag:** Tilgængelige projektsamtaler og historik om StudieChat/Grupvi fra august–oktober 2026. Ikke en komplet eller uafhængigt verificeret arkivering af samtlige chats.

## 1. Dokumentationsprincip

- **Bekræftet:** Eksplicit besluttet eller tydeligt udtrykt som præference i samtalerne.
- **Rapporteret implementeret:** Beskrevet som bygget i udviklingsforløbet; ikke nødvendigvis verificeret i den aktuelle liveversion.
- **Tidligere idé:** Drøftet, men ikke fastlagt som strategi eller funktion.
- **Ikke dokumenteret:** Kan ikke fastslås ud fra tilgængelig historik.

## 2. Brandets identitet

**Bekræftet:** Grupvi er en digital kommunikations- og samarbejdsplatform til studiegrupper. Projektet hed oprindeligt **StudieChat**. Navnet **Grupvi** blev anvendt i den senere produkt- og PWA-udvikling.

**Kerneproblem:** Nye studiegrupper kommunikerer og organiserer arbejdet på tværs af private chats og forskellige tjenester. Det kan være besværligt at skulle forbinde sig via private sociale profiler for at samarbejde med nye gruppemedlemmer.

**Produktets rolle:** Ét enkelt samlingssted for gruppens chat, medlemmer, projektinformation, deadline og links til ressourcer som Figma, GitHub og Google Drive. Grupvi skal *supplere* eksisterende værktøjer, ikke nødvendigvis erstatte dem.

**Kerneprincip:** Gør det let at oprette et projekt, invitere gruppen og komme i gang uden unødvendig opsætning.

## 3. Vision og langsigtet retning

**Bekræftet:** Formålet er at gøre kommunikation og organisering i studiegrupper enklere. Produktet blev fra begyndelsen afgrænset til en lille MVP, som kunne bruges og afprøves i virkelige studiegrupper.

**Tidligere idéer:** AI-opsummeringer, mere avanceret opgavestyring, noter/filer og læringsrelaterede funktioner er blevet nævnt som mulige udvidelser; de er ikke et godkendt roadmap.

**Ikke dokumenteret:** Officiel mission-/visionformulering, bruger- eller omsætningsmål, forretningsmodel, international ekspansionsplan og tidsplan for appbutikslancering.

## 4. Målgruppe og positionering

| Område | Dokumenteret forståelse | Status |
|---|---|---|
| Primær målgruppe | Studerende, som arbejder sammen i mindre projektgrupper | Bekræftet |
| Typisk situation | Nye gruppemedlemmer kender ikke nødvendigvis hinanden privat | Bekræftet |
| Brugerbehov | Hurtig adgang, fælles chat og overblik over projektet | Bekræftet |
| Differentiering | Studiespecifikt samlingssted med lav adgangsbarriere | Udledt af bekræftet produktretning |
| Præcis alder, geografi og uddannelsestype | Ingen formel afgrænsning | Ikke dokumenteret |

**Positionering:** Grupvi er ikke tænkt som endnu et socialt netværk eller et tungt enterprise-projektstyringssystem. Messenger, WhatsApp, Discord, Slack og Teams blev diskuteret som alternativer; dette udgør ikke en formel konkurrentanalyse.

## 5. Brandpersonlighed og tone of voice

**Udledt af produktbeslutninger:** Enkel, praktisk, tilgængelig, rolig og moderne. Dette er en beskrivelse af den eksisterende produktretning, **ikke** officielt vedtagne brandværdier.

**Kommunikativt udgangspunkt:** Konkrete situationer fra studerendes hverdag og tydelige forklaringer på, hvordan gruppearbejde bliver lettere at organisere.

**Ikke dokumenteret:** En godkendt tone-of-voice-guide, foretrukket brandsprog (dansk/engelsk), humor, emoji-regler, tiltaleform, slogans og faste copywriting-regler.

## 6. Visuel identitet og æstetik

**Bekræftede præferencer:**
- Minimalistisk, skandinavisk udtryk.
- Sort, hvid og neutrale gråtoner.
- Masser af luft, tydelig typografi og diskrete borders.
- Begrænset brug af skygger; undgå dominerende gradients og stærke, skrigende farver.
- Mobile-first, overskuelig navigation og mindst mulig visuel støj.

**Referencer:** Telegram blev brugt som **UX-reference til chatten** (hurtighed, scrolling, skrivefelt og mobilinteraktion) — ikke som officiel grafisk identitet. En minimalistisk visuel reference kaldet Stay Awake blev nævnt tidligt.

**Ikke dokumenteret:** Endelig logo-/ikonstandard, HEX-farver, brandfont, fotostil og grafisk SoMe-system. Inter blev nævnt som en fortolkning af en fontreference, men er ikke verificeret som endeligt valgt.

## 7. Produktbeslutninger med betydning for brandet

| Beslutning | Status |
|---|---|
| Opret projekt og invitér gruppemedlemmer via link/QR | Bekræftet; rapporteret implementeret |
| Gæster kan deltage i centrale funktioner uden personlig konto | Bekræftet; rapporteret implementeret |
| Valgfri personlig profil/login adskilt fra gæsteadgang | Bekræftet; rapporteret implementeret |
| Primær navigation: **Home · Chat · Profile** | Bekræftet; rapporteret implementeret |
| Home samler titel, medlemmer, invitation, deadline og ressourcer | Bekræftet produktretning |
| Chat skal føles hurtig og mobilnaturlig, inspireret af Telegram | Bekræftet UX-retning |
| Beskeder vises med det samme ved afsendelse (optimistic send) | Rapporteret implementeret i oktober 2026 |
| PWA med marketingforside `/`, app `/app/` og invitationssti `/app/join/CODE` | Rapporteret implementeret i september 2026 |

**Vigtigt:** `grupvi.com` indgik i planerne, men domæne- og live-status er ikke verificeret her. Web-push blev på et tidspunkt eksplicit beskrevet som *ikke implementeret*; en senere aktuel status kan ikke fastslås fra denne dokumentation.

## 8. Contentretning og platforme

**Bekræftet produktgrundlag for indhold:**
- Udfordringer ved at starte i en ny studiegruppe.
- Chats og projektressourcer, som er fordelt på flere apps.
- Samarbejde uden krav om private sociale forbindelser.
- Nem invitation via link eller QR-kode.
- Fælles chat og praktisk projektoverblik.

**Tidligere forslag:** TikTok, Instagram, direkte outreach til studerende og deling gennem invitationer blev nævnt som mulige markedsføringsveje. Ingen af dem er dokumenteret som besluttet kanalstrategi.

**Ikke dokumenteret:** Content pillars, opslagstyper, publiceringsfrekvens, kampagner, annonceringsbudget, vækst-KPI'er eller en endeligt godkendt contentplan.

## 9. Tidligere beslutninger og fravalg

- **Bekræftet:** Fokusér på en enkel kerneoplevelse frem for mange funktioner fra starten.
- **Bekræftet:** Det skal være let at deltage uden tvungen personlig konto.
- **Bekræftet:** Brug links til eksisterende projektværktøjer frem for at bygge fulde erstatninger i MVP'en.
- **Bekræftet:** Chatten skal have sit eget område, ikke blot være en lille del af én overfyldt projektside.
- **Bekræftet:** Navnet skulle være catchy, nogenlunde internationalt udtaleligt og stadig have forbindelse til konceptet.
- **Historisk:** StudieChat var arbejdsnavnet; Grupvi er det senest dokumenterede produktnavn. Navne som Studi, Grouply og Lumo var forslag, ikke aktive brands.
- **Ikke fastlagt:** En specifik sloganlinje, monetiseringsmodel eller formel go-to-market-plan.

## 10. Hvad Content Agent skal lægge til grund

> **Grupvi er et enkelt, mobile-first samlingssted for studiegrupper.** Produktet er skabt for at gøre det lettere for nye gruppemedlemmer at kommunikere og holde styr på grundlæggende projektinformation uden at være afhængige af private sociale profiler. En fælles chat, nem invitation og overblik over medlemmer, ressourcer og deadlines er centrale dele af konceptet. Brandets dokumenterede æstetiske retning er minimalistisk og skandinavisk. Avanceret AI, omfattende projektstyring og specifikke markedsføringskanaler er ikke besluttede dele af brandidentiteten.

**Grænser for korrekt repræsentation:**
- Præsentér ikke tidligere idéer som lancerede funktioner.
- Opfind ikke brugerantal, effektmålinger, institutionelle partnerskaber eller priser.
- Forveksl ikke UX-inspiration fra Telegram med en beslutning om at kopiere dets brand.
- Behandl ikke foreslåede slogans, platforme eller brandværdier som vedtagne.
- Hold Grupvi adskilt fra FACCI AGENTs andre brands og projekter.

## 11. Samlet vidensstatus

| Branddimension | Status |
|---|---|
| Navn og grundkoncept | Bekræftet: Grupvi, tidligere StudieChat |
| Formål og primær målgruppe | Bekræftet |
| Enkelhed og lav adgangsbarriere | Bekræftet |
| Overordnet visuel retning | Bekræftet præference |
| Formelle brandværdier og tone of voice | Ikke dokumenteret |
| Endeligt logo, skrifttype og farvekoder | Ikke dokumenteret |
| Endelig content- og kanalstrategi | Ikke dokumenteret |
| Kommercielle mål og forretningsmodel | Ikke dokumenteret |
| Aktuel live-status for alle funktioner | Ikke verificeret |

**Konklusion:** Grupvis dokumenterede identitet er et enkelt, tilgængeligt værktøj til studiegruppers kommunikation og overblik. Den eksisterende historik giver en klar produkt- og designretning, men ikke en fuldt fastlagt brandmanual eller marketingstrategi. Dokumentet beskriver den viden, der allerede findes, uden at udfylde hullerne med nye beslutninger.
