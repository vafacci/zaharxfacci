# 03 — Local-First Technical Architecture

## Physical environment and constraints
- Development host: Windows computer. Exact installed versions/path availability MUST be checked, not presumed.
- Observed prior machine specifications: Intel i5-10400F; NVIDIA RTX 2060 6 GB VRAM; 16 GB system RAM.
- Existing AI Image Studio: separate working Next.js/ComfyUI app, roughly `C:\Users\Dayan\Desktop\imagegen` (verify with user before touching; **read-only external integration** until approved).
- Existing n8n may exist; version/config/reachability are NOT guaranteed in new project.
- Ollama may exist locally; detect but do not auto-download a huge model.
- Offline core possible; online external APIs need network and credentials.

## Recommended MVP stack (provisional, adapt after audit)
- **Frontend**: Next.js App Router, TypeScript, Tailwind CSS; responsive local dashboard.
- **API**: Next.js route handlers with Zod validation; thin HTTP layer.
- **Persistence**: SQLite + Prisma in local first-user MVP; migrate to PostgreSQL if concurrency/multi-user needs justify it.
- **Worker**: a separate persistent Node/TypeScript process polling/claiming task jobs, handling leases, abort, max retries, backoff, logging. Do NOT execute background jobs in serverless-style route handlers.
- **LLM provider**: Ollama local API behind `ModelProvider` interface; configurable model selection, structured JSON outputs, model health check, concurrency 1.
- **Coding tool**: future `OpenCodeAdapter` in a constrained workspace and subprocess; use documented CLI/API rather than inventing an embedded OpenCode library. Evaluate context requirements and tool support before enabling autonomous coding.
- **Browser tool**: Playwright for approved sites and local dev testing; disabled by default for accounts/login flows.
- **Automation**: n8n via official supported integration/API/webhooks after authentication and security review.
- **Media**: existing Image Studio via a future authenticated local adapter; never rewrite or embed its internal pipelines into FACCI Core.
- **Social**: self-hosted Postiz via public API/OAuth if feasible; treat it as an external service (AGPL-3.0 licensing, deployment and upstream updates separately managed).
- **Research/feature analysis**: REA as optional authorized developer tool; NOT the FACCI agent runtime and NOT a source of arbitrary free proprietary APIs.

## Simple deployment diagram

```text
Local browser (localhost)
       |
       v
Next.js UI + API   -------> SQLite / Prisma (state, goals, audit, metadata)
       |                                  ^
       v                                  |
Local durable task queue ---> Worker / Orchestrator / Policy Gate
                                 |           |
                                 |           +--> Approval service + event log
                                 v
                           Agent Runtime
                     CEO > Project > Specialist
                                 |
                          Tool Registry
       +-------------------------+--------------------------+
       |                         |                          |
 Ollama local model       Safe repo tools / OpenCode     Optional external adapters
                                                         Image Studio / Postiz / n8n
```

## Interfaces (illustrative TypeScript contracts)

```ts
interface AgentIdentity {
  id: string;
  projectId: string | null;     // null only for FACCI CEO
  parentAgentId: string | null;
  role: 'ceo' | 'manager' | 'specialist';
  templateKey: string;          // e.g. developer, image, social
  enabled: boolean;
  allowedToolIds: string[];
}

type TaskStatus =
  | 'draft' | 'queued' | 'planning' | 'waiting_approval'
  | 'running' | 'verifying' | 'completed' | 'failed'
  | 'blocked' | 'cancelled';

interface ToolRequest {
  toolId: string;
  action: string;
  projectId: string;
  agentId: string;
  taskId: string;
  input: unknown;             // validated with tool-specific schema before dispatch
  idempotencyKey: string;
}

interface ToolAdapter {
  id: string;
  describeCapabilities(): Promise<unknown>;
  validateAndPreview(request: ToolRequest): Promise<unknown>;
  execute(request: ToolRequest, signal: AbortSignal): Promise<unknown>;
}

interface ModelProvider {
  id: string;
  checkHealth(): Promise<{ healthy: boolean; details?: string }>;
  generateStructured<T>(context: unknown, schema: unknown): Promise<T>;
}
```

Use explicit schema validation for plans, delegation and tool calls; the model output is *data*, never an executable command or a grant of new permissions.

## Worker & durability requirements
- Atomic job claim/lease; one worker MVP; resume expired jobs after crash with lease expiry and idempotency checks.
- Task-level cancellation and per-step timeout. A requested cancel should stop downstream execution safely.
- Persist each state transition and tool execution result with timestamps and actor IDs.
- Avoid sending duplicate social posts or purchases; external side effects must have confirmation / idempotency handling.
- Use health/status endpoints for DB, worker and Ollama; distinguish connected/offline/disabled.
- Avoid massive parallel GPU workloads. Prefer a shared resource lock `gpu-high` for Ollama heavy inference and ComfyUI generation.

## Starter project layout suggestion

```text
facci-agent/
  app/                 # Next.js dashboard, API routes
  src/domain/          # project, agent, tasks, approvals, tools
  src/agents/          # CEO/manager/specialist role templates
  src/providers/       # model adapter (Ollama first)
  src/tools/           # tools and permission gates
  worker/              # durable task execution process
  prisma/              # DB schema and migrations
  docs/                # authoritative specs and implementation status
  .cursor/rules/       # always-on Cursor rules
  AGENTS.md            # independent agent instruction entry
```

If project uses a different structure for sound reasons, document why. Avoid premature distributed microservices, Kubernetes, GPU training inside FACCI, or dependence on proprietary model APIs.

## Honest feasibility gates
1. Check whether available small local models reliably produce valid structured plans and useful tool calls; measure error rates. OpenCode integration may demand a larger context window than machine can economically run.
2. If local coding quality is too weak, still ship the orchestration engine and configurable provider abstraction. Do not hide limitations behind fake outputs. Optional paid/cloud compute can be added with explicit user opt-in.
3. Building FACCI in Cursor does not automatically eliminate Cursor token use; only completed local executions use Ollama rather than Codex/Cursor provider credits.
