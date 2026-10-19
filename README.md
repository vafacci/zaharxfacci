# FACCI Agent

Local-first **AI organization operating system**. Human owner → FACCI CEO → dedicated project managers → project-local specialists.

This repository includes product specs under `docs/` and a working **Milestone 1** MVP (Demo Planner, not a live LLM).

## Requirements

- Windows + Node.js 20+ (verified on Node 24)
- No paid APIs required for M1
- Port **3010** (port 3000 is often used by Image Studio)

## Setup (PowerShell)

```powershell
cd C:\Users\Dayan\FACCI-AGENT
copy .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed
```

## Run (two processes)

Terminal A — web UI:

```powershell
npm run dev
```

Open http://127.0.0.1:3010

Terminal B — durable worker:

```powershell
npm run worker
```

## Milestone status

- **M1:** Hierarchy, worker, Demo Planner, approvals — done  
- **M2:** Local Ollama structured planning (`qwen2.5:3b`) — done  
- **M3:** OpenCode / allowlisted developer agent (`toy-counter`) — done  
- **M4:** Image Studio / Postiz drafts / n8n prepare — done (Postiz optional; publish still gated)  
- **M5:** Not started

## M2 demo (live local AI)

Requires Ollama + `qwen2.5:3b` (`ollama pull qwen2.5:3b`).

1. Ensure `FACCI_PLANNER=auto` and `OLLAMA_MODEL=qwen2.5:3b` in `.env`.
2. Start **web + worker**.
3. Submit AUTIQ task **Draft 3 content ideas**.
4. Dashboard shows **Live Ollama** plan (model id + latency) and executed steps separately.
5. Open the project-scoped markdown artifact.
6. Try **publish** — must go to approval; never publishes.
7. If ComfyUI (:8188) is running, FACCI automatically CPU-offloads Ollama (slower, safer for Image Studio).

## M3 demo (developer agent)

1. Keep `workspaces/toy-counter` allowlisted (see `config/workspaces.json`).
2. Submit a coding task, e.g. **Fix toy-counter add bug** on AUTIQ.
3. Worker runs OpenCode when available; otherwise the labeled **bounded-patch-executor**.
4. Evidence artifact + `data/rollbacks/...` snapshot; `npm test` in toy-counter must pass.
5. A **merge/push** task must go to the approval queue and must not merge.

## M4 demo (draft pipeline)

1. Start **Image Studio** on `:3000` (separate `imagegen` repo) + ComfyUI if generating.
2. Start FACCI **web + worker**.
3. Submit AUTIQ task e.g. **Weekly content pipeline draft** / image+caption calendar (do not publish).
4. Worker calls Image Studio for real generation evidence, then stages caption/calendar locally (Postiz draft only if `POSTIZ_*` env set).
5. Publish tasks still enter **approval** and never auto-publish.
6. Optional: `npx tsx scripts/m4-regression.ts`

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js on 127.0.0.1:3010 |
| `npm run worker` | Task worker (1 concurrent job) |
| `npm run test` | Unit tests |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run db:seed` | Reseed demo organization |

## Specs

Read order is in `CURSOR_MASTER_PROMPT.md` and `AGENTS.md`. Track progress in `docs/IMPLEMENTATION_STATUS.md`.

**Do not modify** the separate `imagegen` project.
