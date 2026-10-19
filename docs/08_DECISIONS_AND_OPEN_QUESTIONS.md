# 08 — Decisions, Unknowns & Future Changes

## Confirmed owner vision / locked principles
1. The user is human owner; FACCI is one overall CEO agent across multiple businesses.
2. Each business/app has its **own dedicated manager agent** and dedicated specialist team.
3. The specialist role instances have business-specific goals, memory and access. Roles/tools can share implementation templates and a single model runtime.
4. AUTIQ, StudieChat/Grupvi, DreamIT and future ventures are target business project structures.
5. AI Image Studio is **a separate reusable tool** being built in parallel, not FACCI's CEO agent.
6. More in-house tools will come; Postiz could replace a paid Buffer subscription where official supported connections suffice.
7. REA can aid research of user-facing features but cannot clone proprietary model weights or erase API fees.
8. Begin building with Cursor; eventual aim is for FACCI to use locally hosted coding/inference agents and reduce reliance on paid token quotas.
9. Start with an independent repository and do not disrupt Codex/imagegen work.
10. Keep work incremental, easy to understand, verifiable and documented.

## Proposed engineering choices to validate, not hard owner decisions
- Next.js + TypeScript + Tailwind for dashboard.
- SQLite + Prisma initially; worker as separate Node.js process.
- Ollama shared local model provider; OpenCode as constrained future coding tool.
- Postiz self-hosted first instead of writing a Buffer clone.
- One heavy GPU workload at a time.
- Danish UI, English internal documentation/code.
- Dark restrained design.

## Open questions (do not block M1)
- Where will the new `facci-agent` folder live? User should select; never overwrite an existing project.
- Actual Git repository paths for DreamIT and Grupvi? User connects them explicitly later.
- First preferred small Ollama model and its measured speed/reliability?
- Existing n8n URL/credentials and real readiness?
- Does Image Studio expose a stable documented API when M4 starts?
- Which social accounts and platforms can be legally/technically connected?
- Remote Windows access needed later? Not needed for M1.
- Future multi-user access/hosted SaaS or private single-user only? Start private single-user.

## How to change this spec
If the owner revises hierarchy or deployment strategy, edit `01_PRODUCT_VISION.md`, log a dated design decision and adjust tests. Agent-generated suggestions should be explicitly proposed, not silently redefine the organization model.
