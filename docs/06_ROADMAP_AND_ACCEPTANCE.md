# 06 — Roadmap, Milestones and Acceptance Criteria

## Prioritization principle
Prove a thin, real vertical slice from Owner -> FACCI -> Project Manager -> Specialist -> Tool/Artifact -> Status before adding many tools or subagents. Use Cursor to bootstrap; avoid rewriting the existing imagegen project. **Only implement the next milestone unless the owner explicitly approves expanding scope.**

## M0 — Environment reconnaissance (part of first Cursor session)
- Check Node, npm/pnpm, Git, Ollama, OpenCode, disk and ports without installing giant dependencies.
- List what exists and what does not; do not assume Windows Ollama is running.
- Confirm working directory is dedicated `facci-agent` and not `imagegen`.
- Write an implementation plan and `docs/IMPLEMENTATION_STATUS.md` with observed versions and status.
- Record any missing essential input, but do not block UI scaffolding just because external services are not connected.

## M1 — Working FACCI Core (build this first)
**Scope**: Next.js UI, local DB, organization hierarchy, project/team CRUD, tasks, persistent activity/events, approvals model, separate worker and **demonstrable safe workflow**. Mocked intelligence is acceptable only when explicitly labeled `Demo planner`, never represented as real autonomous LLM execution.

**Acceptance checks**:
1. App starts using documented Windows-friendly commands with no paid API credentials.
2. Dashboard shows FACCI CEO and pre-seeded independent managers AUTIQ, StudieChat/Grupvi and DreamIT.
3. Each manager has an independently scoped specialist team. Adding a new project creates a new manager/team without code changes.
4. Create a task in AUTIQ; it cannot appear as DreamIT's task when filtering by project.
5. Submit a simple safe task, e.g., "Draft a content outline for AUTIQ". Worker executes a documented *demo* path and writes an actual project-scoped artifact; task transitions are recorded.
6. Restart server/worker; the hierarchy, tasks, event history and artifact still exist.
7. Sensitive action request is blocked or requires a specific approval; no fake publishing occurs.
8. View and cancel queued task; invalid transitions are rejected; tests prove authorization boundaries.
9. Run lint, typecheck, build, tests; report actual pass/fail and outstanding issues.
10. Show clear `offline/not configured` states for Ollama, Image Studio, Postiz and n8n.

**M1 exit demo:** Owner assigns task to AUTIQ through CEO -> manager delegates to AUTIQ specialist -> worker generates an artifact -> owner sees verifiable completed result and timeline. Do not claim LLM autonomy yet.

## M2 — Local model orchestration
- Implement Ollama model adapter, health, model picker and actual structured CEO/manager/specialist planning.
- Keep schema-validated bounded delegation; log model ID and observed performance.
- Test three simple tasks and one ambiguous task with real model, measure plan validity and factual errors.
- The user chooses/downloading a small model; do not select an unrealistic 14B/32B default on 6 GB VRAM.
- Fall back to honest blocked state if model unavailable; do not silently shift to paid cloud API.

**Acceptance:** A real local model produces valid structured plans for agreed test tasks and tasks can be scheduled/persisted/retried. Distinguish successful validated planning from fully autonomous execution.

## M3 — Local Developer Agent
- Connect OpenCode CLI (or proven alternate) in approved repo worktree.
- Enforce allowlisted operations, diffs, tests and approval for merge/release.
- Evaluate context window / memory feasibility; do not assume large hosted context capacity.
- Complete one scoped change to a toy project, with tests and rollback evidence.

## M4 — AUTIQ production pipeline (draft-first)
- Add Image Studio integration via stable API/adapter only after its actual endpoints are documented.
- Add Postiz self-hosted integration or another official scheduling API, initially **drafts only**.
- Add n8n integration for approved automations.
- End-to-end example: brief -> image proposal -> caption draft -> review -> calendar, with explicit human publish approval.

## M5 — More business workflows
- Granular UX/QA/analytics/research capabilities for Grupvi and DreamIT.
- Schedules and Windows background service; project metrics, verified sources, error recovery, backups.
- Optional remote access only with authentication, TLS and threat modeling.

## M6 — Assisted autonomous operations
- Owner-approved bounded recurring jobs, multi-project prioritization, monthly budgets, durable memories, team performance evaluation.
- Optional opt-in remote powerful models/GPUs if local measured quality inadequate; transparent billing, consent and limits.

## Things NOT to spend M1 on
- Own model training, new image model downloads, cloud deployment, user management at scale, cross-platform mobile app, advanced RAG/vector DB, bespoke Buffer clone, custom GPU cluster, every social API, REA setup, giant prompts with no running system.

## Tests to implement early
- Hierarchy invariant: exactly one CEO per organization; each non-CEO agent has a valid project/parent relationship and no cycles.
- Project isolation: user actions in AUTIQ cannot query/mutate DreamIT without explicit global supervisor authority.
- Tool policy: no unregistered or disabled tool executes; LLM cannot self-approve.
- Worker recovery: restart mid-job doesn't produce duplicate artifacts or side effects.
- Approval payload: changed payload invalidates approval.
- UI: clear distinction of simulated, offline and live results.
- Windows: setup/run with PowerShell scripts or npm commands that work natively.

## Reporting format after each Cursor milestone

```text
MILESTONE:
IMPLEMENTED (with file paths):
TESTS RUN (actual results):
DEMO / HOW TO TRY:
KNOWN LIMITATIONS (do not overclaim):
SECURITY OR COST CONCERNS:
NEXT RECOMMENDED SINGLE STEP:
```
