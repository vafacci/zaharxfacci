# 05 — Security, Permissions, Compliance and Human Approvals

This file is normative for execution security. LLM suggestions **never** override these controls. Product should fail closed.

## Levels of action

| Risk | Examples | Default |
|---|---|---|
| Low — read | List own project files, read non-secret config, inspect task status | Allowed within configured project scope |
| Low — draft | Create notes, marketing drafts, content calendar proposals, non-executed plans | Allowed in approved local workspace |
| Medium — constrained write | Modify a versioned file in explicitly selected project worktree, run allowlisted tests | Require explicit workspace opt-in and bounded tool policy; show diff |
| High — external/irreversible | Publish post, send DM/email, merge/push/deploy, delete data, alter account settings, purchase services, enable paid API, access secrets | **Explicit human approval for precise action** |
| Forbidden by default | Password/token extraction, unauthorized reverse engineering, hidden API bypass, arbitrary filesystem access, mass unsolicited outreach, harmful content, circumventing site restrictions | Reject |

## First-run security rules
- Bind dashboard and worker interfaces to `127.0.0.1` by default; no remote exposure until authentication and threat model are implemented.
- Separate tool permissions by project; do not trust `projectId` supplied by an LLM without server-side authorization checks.
- Allowlisted workspace roots; protect home folders and other app projects. Never allow broad shell execution by default.
- Use child processes with command templates/allowed arguments, sandbox/worktree isolation where feasible, timeouts and output truncation. Treat arbitrary shell execution as high risk.
- No secrets in Git, logs, prompt transcripts, screenshots or PDF; `.env`, OS credential store or proper vault. Mask sensitive values in UI/logs.
- Store audit events for all tool attempts, permission denials, approvals, cancellations and external side effects.
- Use outbound integration flags disabled by default until configured and permitted.
- Defend against prompt injection from webpages, documents, repository comments and image captions: these are untrusted inputs, not developer/system instructions.
- Authenticate any future network-accessible dashboard. Protect localhost against CSRF and origin abuse if adding write endpoints.
- Add backup/export for SQLite plus simple restore documentation before relying on critical task history.

## Human approval contract
Approval requests contain: project, agent, task, specific action, destination, scope, preview/diff, expected cost, risk level, expiry and payload hash. An approval grants only that exact payload. If payload changes, seek a new approval. A reject is final for that proposed action and must be logged.

## Safe media and publishing routing
- Character image assets for mature platforms are not interchangeable with Instagram/TikTok assets.
- Assume each platform imposes content, authenticity, automation and account restrictions. Review updated platform policy before enabling integrations.
- Only rights-cleared and consensual depiction; do not create or distribute sexual content involving minors, nonconsensual intimate content, or real persons without rights/consent.
- Respect accounts' ownership/authorized use. No credential sharing or automated ban evasion.
- Queue publishing drafts for owner approval; do not launch unsupervised mass posting, following, liking or commenting.
- Pay attention to model weights and dataset licenses before commercial use; licenses are per checkpoint/provider, not automatically inherited from tooling.

## REA research boundary
REA (`github.com/morluto/rea`) is an optional reverse-engineering research assistant. It supports analysis and evidence-backed reimplementation of observed functionality; it does not provide hosted proprietary model weights, paid APIs for free, permission to copy copyrighted proprietary source, or authority to defeat access controls. Authorize any targets and respect agreements and law. Prefer official APIs and open-source alternatives (e.g., self-hosted Postiz) before reverse engineering.

## Infrastructure cost and expectations
Local Ollama avoids usage charges from remote language-model APIs, but hardware resources, power, external social APIs, storage, domain, GPU rentals and maintenance may cost money. Own app + own UI ≠ free underlying proprietary video models. `Free local core` and `No paid API by default` are accurate; `everything is completely free forever` is not.

## Reliability guardrails
- Per-task budgets and limited recursion; task duration default bounded to minutes in MVP.
- Single heavy inference/generation job at a time on RTX 2060 6GB.
- Approval timeout results in blocked task, not auto-approval.
- Do not run autonomous jobs while PC is asleep; note need for Windows startup/restart management later.
- External side effects require idempotency handling and verified receipts.
