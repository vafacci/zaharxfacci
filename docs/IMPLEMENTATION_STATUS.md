# FACCI — Implementation Status

**Last updated:** 2026-10-14  
**Milestone:** M0–M6 complete · **M6 acceptance 14/14** · **M5 still 21/21** · **No M7 in roadmap — stopped**  
**UI:** Four-section shell (Hjem chat-first, Projekter, Opgaver, System).  
**Chat e2e:** `POST /api/chat` → operational task → worker/Ollama; demo chip seeds toy-counter bug and runs developer path.

## Environment

| Item | Result |
|---|---|
| Repo | `C:\Users\Dayan\FACCI-AGENT` |
| Ollama | `qwen2.5:3b` / `qwen2.5-coder:3b` |
| Image Studio | External `:3000` (read-only) |
| Postiz | Not configured |
| n8n | Reachable; API key unset |
| Remote models | **Disabled by default** (opt-in) |

## M6 — Assisted autonomous operations (implemented)

### What shipped

| Capability | Implementation |
|---|---|
| Owner-approved bounded recurring jobs | Schedules default `requiresOwnerApproval`; enable creates `enable_recurring_job` approval; daily `maxFiresPerDay` cap |
| Multi-project prioritization | `selectNextQueuedRunId` ranks by `project.priority` → `task.priority` → age; `/api/priority` |
| Monthly budgets | `MonthlyBudget` org+project counters for plan/image/task/remote; fail-closed gates in worker + `createTask` |
| Durable memories | `OwnerMemory` + richer `ProjectMemory` upsert/list; task outcome consolidation after complete; planner loads verified memories |
| Team performance evaluation | Observed DB metrics → artifact `team-performance` + memory (`/api/performance`) |
| Optional remote models | `config/remote-models.json` + env; consent+budget+key required; default not ready; billing note honest |

### APIs

- `GET/POST /api/budgets`
- `GET/POST /api/memories` (`scope=owner|project`)
- `GET/POST /api/priority`
- `GET/POST /api/performance`
- `GET/POST /api/remote-model` (probe only)

### Files (primary)

- `src/domain/budgets.ts`, `memory.ts`, `prioritization.ts`, `team-performance.ts`
- `src/providers/remote-model.ts`, `config/remote-models.json`
- `src/domain/schedules.ts` (approval + daily cap)
- `src/domain/approvals.ts` (enable_recurring_job executes enable)
- `worker/index.ts` (priority claim, budgets, memory consolidate)
- `prisma/migrations/20261013010000_m6_autonomous_ops/`

### Acceptance

```powershell
npm run m6:acceptance   # 14/14 PASS
npm run m5:acceptance   # 21/21 PASS (no regression)
npm run test            # 50 passed, 2 skipped
npm run typecheck       # PASS
```

### Limitations (do not overclaim)

- Remote models are **not** a hosted Claude/GPT substitute; default is local Ollama only.
- Budget counters are **local FACCI usage**, not vendor invoices.
- Recurring jobs still need a running worker + awake PC.
- Team performance is internal task/step stats — not business KPI / HR evaluation.
- Enabling a recurring job is the approved side effect; publish/merge remain non-executing.
- No M7 defined in `docs/06_ROADMAP_AND_ACCEPTANCE.md` — work stopped after M6.

### How to try

```powershell
cd C:\Users\Dayan\FACCI-AGENT
npm run dev
npm run worker
# Set portfolio priority: POST /api/priority { projectId, priority }
# Enable schedule in UI → approve enable_recurring_job in Approvals
# Persist team eval: POST /api/performance { projectId }
npm run m6:acceptance
```

## Prior milestones

- **M5** — UX/QA/research reports, schedules, metrics, backups, Windows script (status-only) — retained; acceptance still green.
- **M1–M4** — hierarchy, Ollama, OpenCode, Image Studio/Postiz/n8n drafts — retained.

## UX shell (post-M6)

| Route | Job |
|---|---|
| `/` | Instruct (create task), active work, results, approvals |
| `/projects` | Team, memories, create project, priority (collapsed) |
| `/tasks` | Filters, artifacts-first evidence, cancel |
| `/system` | Integrations, schedules, budgets, metrics, backup, audit, test tools |

Shared: `src/components/facci/*` (`AppShell`, `useOverview`, viewers). No chat API. Progressive disclosure for model IDs / latency / raw action types.

```powershell
npm run typecheck   # PASS after UX split
```

## Chat e2e (post-M6, not a new milestone)

| Piece | Status |
|---|---|
| `POST /api/chat` | Message → `createTask` (operational) + honest Danish reply |
| Hjem `ChatPanel` | Thread UI; status updates from overview poll; approvals still gated |
| Toy-counter demo | `prepareDemoBug` writes `add(a,b)=a-b`; coding intent routes to `run_developer_task` |
| AUTIQ allowlist | `autiq` = `workspaces/autiq` brand vault; `autiq-web` = Desktop `AUTIQ-main` (absolutePath) |
| Chat routing | Brand/content file asks → `autiq`; website/Next asks → `autiq-web`; demo → `toy-counter` |
| Playwright / computer-use | Still **not** implemented |

```powershell
npm run dev
npm run worker   # required or chat tasks stay queued
# Hjem → chips: AUTIQ brand / AUTIQ web / toy-counter
npm run test -- tests/chat.test.ts tests/workspace.test.ts
```

## AUTIQ live proof (2026-10-14)

| Path | Result |
|---|---|
| Brand `autiq` | Chat → bounded-patch → `brand/voice.md` + `content/calendar.md` → **completed** |
| Web `autiq-web` | Chat → Desktop `AUTIQ-main` → `docs/PRODUCT.md` + evidence artifact → **completed** |

Fixes along the way: Windows-safe workspace checks; prioritize docs in patch prompt; coding plans run `run_developer_task` before `verify_artifact`.

No publish / merge / .env. Image Studio stays separate. No PC control.

## AUTIQ weekly content loop (post-M6, 2026-10-14)

One scheduled task walks a fixed loop: **marketing brief → social writes caption rows into `workspaces/autiq/content/calendar.md` (bounded-patch) → local social review package (Postiz off) → security-qa checklist → manager verify → `publish_post` approval stop.** Approving records the decision only; nothing is published.

- Routing: `wantsWeeklyContentLoop` (marker "weekly content loop") beats coding/M4 pipeline; lead = marketing. Plan shape is deterministic (`src/domain/content-loop.ts`); Ollama only writes a zod-validated brief (theme, audience, 3 angles, 3 captions). Invalid brief → brief marked Blocked, no vault write, still stops at approval.
- Schedule: "AUTIQ weekly content loop", `every_168h`, max 1/day, disabled, `requiresOwnerApproval`. No image step (avoids Ollama + ComfyUI contention on 6 GB).
- Enable: System → Tidsplaner → "AUTIQ ugentligt content-hjul" → *Anmod om aktivering* → approve `enable_recurring_job`. *Kør én gang nu* queues a single run. CLI: `npm run autiq:loop:seed [-- --run-now]` (non-destructive). API: `POST /api/schedules/autiq-weekly-loop {action: upsert|request_enable|run_now}`.
- Live proof (qwen2.5:3b): task reached **waiting_approval** with 5 artifacts (brief, dev evidence, social evidence, review draft, QA checklist) and a pending `publish_post` approval.
- Limitation: the 3B coder model wrote only 1 of 3 calendar rows (Instagram); the other captions are in the brief + review package. Earlier run rewrote all rows and was restored from the rollback snapshot. Weekly cadence is `every_168h` from enable time (no weekday rule).
- Tests: `tests/content-loop.test.ts` (8) + M4/chat/routing green (campaign phrasing no longer misroutes to developer).

### Deterministic calendar writer (2026-10-14)

Weekly loop no longer uses bounded-patch for `content/calendar.md`. Action `update_brand_calendar` writes Instagram / LinkedIn / Facebook Idea cells deterministically (pads to 3 captions from angles/theme if the model returns fewer). Other rows untouched. Tests: `tests/content-loop.test.ts`.

### Brand-aligned weekly brief (2026-10-14)

- Restored clean `workspaces/autiq/brand/voice.md` (no fake testimonials / no embedded calendar junk).
- Weekly Ollama prompt loads brand voice + mission; captions sanitized (strip hype/emoji spam) before vault write.
- Game mode: no UI yet — stop/start via agent (`npm run worker` / `npm run dev`) when gaming.

### Analytics hat on the flywheel (2026-10-14)

Weekly loop adds **analytics** after QA: deterministic note (observed drafts → proposed next theme → blocked live KPIs). Writes project memory `weekly-next-theme` for the next marketing prompt. No invented engagement numbers.

### Flywheel visibility (2026-10-14)

- Overview exposes `flywheel.nextThemeMemory`; System → Tidsplaner shows “Næste tema”.
- *Kør én gang nu* queues a fresh task each click (unique idempotency key).
- Live proof: `waiting_approval` with 6 artifacts (brief, calendar, social, QA, analytics) + memory filled; captions brand-cleaner.

## Multi-project allowlists (2026-10-14)

| Project | Vault (in FACCI) | App (absolutePath) |
|---|---|---|
| AUTIQ | `autiq` | `autiq-web` → Desktop `AUTIQ-main` |
| Grupvi | `grupvi` | `grupvi-app` → Desktop `KARRIERE/studiechat` |
| DreamIT | `dreamit` | `dreamit-web` → Desktop `DreamIT` |
| NOFACCI | `nofacci` | Vault only |
| DailyCap | `dailycap` | Vault only (no Desktop path yet) |

Chat chips route by project. Weekly content **loop** remains AUTIQ-only for now.

Live vault proofs (2026-10-14):
- Grupvi `product/ux-notes.md` → **completed**
- DreamIT `product/notes.md` → **completed** (retry after one hung timeout)

Live app-repo proofs (2026-10-14):
- `grupvi-app` AGENTS.md FACCI note → **completed** via `append_allowlisted_note`
- `dreamit-web` AGENTS.md FACCI note → **completed** via `append_allowlisted_note`

Bounded-patch on large Desktop repos was unreliable (Zod `files` array). Tiny AGENTS/README notes now use **deterministic allowlisted append** (same pattern as calendar writer). Sanitizer converts matching `run_developer_task` prompts automatically.

## AUTIQ brand pack (2026-10-14)

Curated concept knowledge under `workspaces/autiq/brand/`:

| File | Role |
|---|---|
| `voice.md` | Tone / craft |
| `positioning.md` | What we are / are not |
| `audience.md` | Who / JTBD / objections |
| `claims.md` | Allowed vs forbidden claims |
| `examples.md` | Approved caption craft |
| `glossary.md` | Prefer / avoid wording |

Weekly loop loads the full pack into the brief prompt (not voice alone). If pack is missing/thin → **no GPU brief**, **no calendar write**, brief artifact explains the gap. `node workspaces/autiq/check.js` validates pack presence.

### ChatGPT → brand pack import (2026-10-14)

Deterministic pipeline (no LLM):

```bash
npm run autiq:brand:import -- --file path/to/conversations.json
# or curated markdown/notes
npm run autiq:brand:import -- --file path/to/notes.md
```

- Parses OpenAI `conversations.json`, JSON message arrays, or markdown/plain text
- Heuristic section tags → `positioning|audience|claims|examples|glossary|voice|unsorted`
- Writes **drafts only** to `workspaces/autiq/brand/_import/<timestamp>/` (live pack untouched)
- Redacts common API-key / token patterns
- Weekly loop ignores `_import/`
- Tests: `tests/brand-import.test.ts` + fixture `tests/fixtures/chatgpt-brand-sample.json`

When you deliver real ChatGPT exports: run import → review drafts → copy approved lines into live `brand/*.md`.

## Game mode / runtime control (2026-10-14)

Free GPU/CPU for gaming without manual process hunting:

| Chat | Effect |
|---|---|
| `game mode on` | Stop worker now; dashboard stop deferred ~2s |
| `game mode off` | Start worker (+ dashboard if :3010 closed) |
| `facci status` / `stop worker` / `start worker` | Status or worker-only |

- Script: `scripts/facci-runtime.ps1` (repo-path scoped kills only)
- npm: `facci:status` / `facci:game-on` / `facci:game-off`
- Chat acts immediately — **no fake task**
- Mode file: `data/runtime-mode.json`
- Tests: `tests/runtime-control.test.ts`
- Brand-data import stays parked until you drop ChatGPT exports later

### Idle worker (2026-10-15)

Worker exits after **5 min** with no runnable work and no enabled schedules (`FACCI_WORKER_IDLE_EXIT_MS`, `0` = always on). `waiting_approval` does not keep it alive. Creating a task (chat) calls `ensureFacciWorkerRunning()` so work wakes the worker. Dashboard (`next dev`) is separate — use **game mode on** when you want that gone too (or close Image Studio `:3000` separately).

## Project loops: Grupvi UX + DreamIT research (2026-10-15)

Deterministic weekly loops (no Ollama/GPU required for plan shape):

| Project | Loop | Steps |
|---|---|---|
| Grupvi | UX | review artifact → QA → append `product/ux-notes.md` → verify |
| DreamIT | Research | brief artifact → QA → append `product/notes.md` → verify |

- Markers win over generic coding/UX/research intents
- Schedules: `every_168h`, disabled until owner enable approval
- API: `POST /api/schedules/project-loop { project: grupvi\|dreamit, action }`
- CLI: `npm run project:loops:seed` (`--run-now` queues both)
- System → Tidsplaner: cards for both loops
- Tests: `tests/project-loops.test.ts`
- No publish / store / outreach

### Live proof (2026-10-15)

- Grupvi UX loop → **completed** (ux-review + qa-checklist + append-evidence)
- DreamIT research loop → **completed** (research briefs + append-evidence)
- Game mode `GameOn` also stops Image Studio (`Desktop\imagegen`) when present
- Fixed `facci-runtime` StartDashboard log redirect (was breaking Next cwd)

## Brand packs from ChatGPT knowledge docs (2026-10-15)

Owner delivered Brand Knowledge MDs. Curated into live packs (confirmed facts only + FACCI ops rules):

| Brand | Vault pack | Full source |
|---|---|---|
| AUTIQ | `workspaces/autiq/brand/*` (merged Content Autopilot + logo brief) | `brand/_knowledge/` |
| Grupvi | `workspaces/grupvi/brand/*` | `brand/_knowledge/` |
| DREAMit | `workspaces/dreamit/brand/*` (spelling **DREAMit**) | `brand/_knowledge/` |
| NOFACCI | `workspaces/nofacci/brand/*` | `brand/_knowledge/` + `docs/brand-sources/` |
| DailyCap | `workspaces/dailycap/brand/*` | `brand/_knowledge/` + `docs/brand-sources/` |

Shared loader: `src/tools/brand-pack.ts`. Project loops cite brand packs as observed sources. Tests: `tests/brand-pack.test.ts`.

## DreamIT QA + brand citations (2026-10-15)

- Seed team for DreamIT now includes **`qa`** (was falling back to research on research-loop QA steps).
- Non-destructive: `npm run team:ensure` adds missing seed specialists / creates missing seed projects.
- Specialist reports auto-cite brand packs when sources are not overridden.
- DreamIT mission seed text updated to DREAMit hobby→webshop framing.

## Full portfolio projects (2026-10-15)

All five customer brands are FACCI projects with vaults + curated brand packs:

| Project | Vault | Team focus |
|---|---|---|
| AUTIQ | `workspaces/autiq` (+ Desktop web) | Content Autopilot |
| Grupvi | `workspaces/grupvi` (+ Desktop app) | UX / study app |
| DreamIT / DREAMit | `workspaces/dreamit` (+ Desktop web) | Hobby→webshop |
| NOFACCI | `workspaces/nofacci` | AI influencer agency |
| DailyCap | `workspaces/dailycap` | Daily spend app (vault only) |

- Chat: brand mention in message **overrides** UI project picker (`resolveChatProjectSlug`).
- Research-first (“først … research / ingen kode”) → research specialist, **not** developer.
- Explicit build (“byg hjemmeside nu”, `nofacci-web`) → developer coding path still works.
- Brand pack loader: `autiq|grupvi|dreamit|nofacci|dailycap`.
- `FACCI_OS` remains archive-only (OS, not a customer brand).

```powershell
npm run team:ensure
node workspaces/nofacci/check.js
node workspaces/dailycap/check.js
```

## Partner portfolio briefing (2026-10-19)

- Route: `/partner` — shareable overview + interactive 1–5 score matrix (localStorage) for AUTIQ, NOFACCI, DREAMit, Grupvi, DailyCap, Scanna.
- Markdown mirror: `docs/PARTNER_BRIEFING.md` (Notion/paste-friendly).
- Nav: sidebar **Briefing**. Scanna intentionally blank until filled with partner.

## Next

Optional: connect DailyCap Desktop/repo allowlist when path exists. Owner can refine packs anytime. Weekly loops for NOFACCI/DailyCap only if owner wants them. Host `/partner` publicly (tunnel/static) if the partner needs a remote URL.
