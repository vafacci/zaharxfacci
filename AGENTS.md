# Instructions to all coding agents working on FACCI

Read `README.md` and `docs/01_PRODUCT_VISION.md` first. Before substantial changes, read the related `docs/0X_*.md` source files. Cursor additionally loads `.cursor/rules/facci-core.mdc`.

## Non-negotiable product model
1. Human Owner -> FACCI CEO Agent -> Project Manager Agent per business -> specialist agents per business.
2. Each project has independently scoped team membership, memory, workspace, schedules, goals, credentials access rules and task history.
3. Shared tools/services are reusable across projects but never automatically share confidential project memory.
4. A specialist role can be templated globally yet its **instance** belongs to one project. `AUTIQ Social` and `DreamIT Social` are distinct team members.
5. Use existing AI Image Studio as an external, optional future tool; never assume it is the FACCI application itself.
6. Start local-first and free of *paid LLM token services* by default; other cloud APIs and infrastructure may cost money. No performance promises equivalent to frontier hosted models.

## Engineering rules
- First audit repository/environment, identify constraints, then ship small working slices.
- Maintain Windows compatibility with PowerShell-friendly commands and no implicit WSL/Docker requirement.
- Prefer TypeScript/Next.js/SQLite for MVP; separate long-running worker process from Next.js HTTP request handlers.
- Use a tool abstraction, model adapter, explicit project context and deterministic policy gate.
- Use validated schemas for every LLM-produced plan, task and tool invocation; never execute unvalidated LLM text as shell commands.
- Durable, resumable task states; timeouts, bounded retries, event logs, idempotency keys and cancellation.
- Default to ONE CPU/GPU-intensive LLM job at a time due to RTX 2060 6GB / 16GB RAM.
- Never hardcode secrets, silently install large dependencies, automatically publish social posts, charge money, send messages, run destructive commands or change external accounts.
- Respect platform terms. REA assists lawful study/reimplementation; no private API extraction, auth bypass or copying protected code.
- Every milestone must include reproducible commands, tests, limitations, and a concise status update.

## Rule for ambiguity
If specification conflicts, prioritize `docs/01_PRODUCT_VISION.md` and `docs/05_SECURITY_AND_APPROVALS.md`. Ask for confirmation before changing major architectural decisions. Do not implement unrequested future phases under the pretext of being helpful.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
