# 04 — Data Model, Task States and End-to-End Workflows

## Core data entities
Suggested schema with illustrative fields. Cursor may refine on implementation after validating relational integrity.

| Entity | Suggested fields and relationships |
|---|---|
| `Project` | id, slug, name, mission, status, priority, repositoryPath?, createdAt, updatedAt |
| `Agent` | id, name, role (ceo/manager/specialist), projectId? (CEO alone is global), parentAgentId?, templateKey, instructionsVersion, status |
| `AgentToolPermission` | agentId, toolId, actionPattern, projectId, approvalPolicy |
| `ProjectGoal` | id, projectId, goal, successCriteria, priority, ownerStatus |
| `Task` | id, projectId, assignedAgentId, parentTaskId?, title, objective, status, priority, maxSteps, createdAt, completedAt? |
| `TaskRun` | id, taskId, modelProvider?, startedAt, endedAt?, attempt, status, errorCode?, leaseOwner?, leaseExpiresAt? |
| `TaskStep` | id, runId, sequence, agentId, actionType, inputSummary, outputSummary, status, evidenceRef?, startedAt, endedAt? |
| `Approval` | id, taskId, requestedByAgentId, actionSummary, riskLevel, payloadHash, state, approvedBy?, expiresAt?, decidedAt? |
| `Artifact` | id, projectId, taskId?, kind, storageRef, contentHash?, metadataJson, createdAt |
| `ToolRegistration` | id, adapterType, name, state, sanitizedConfig, capabilityJson |
| `ProjectMemory` | id, projectId, category, content, sourceRef, lastVerifiedAt, visibility |
| `AuditEvent` | id, projectId?, actor, verb, target, payloadRedacted, createdAt |
| `Schedule` | id, projectId, title, rule, enabled, nextRunAt?, actionTemplate |

Use database migrations, foreign keys, indexes on `projectId` + timestamps/status, and validate input by schema. Never store OAuth tokens, raw secrets or image private metadata in public audit output.

## Lifecycle

```text
Owner asks for work
      |
      v
DRAFT -> QUEUED -> PLANNING -> [needs approval?]
                                | yes             | no
                                v                 |
                          WAITING_APPROVAL        |
                         / approve / reject      |
                        v           v            |
                     RUNNING     BLOCKED          |
                        ^-------------------------+
                        |
                  tool execution
                        v
                   VERIFYING
                  / pass / fail
                 v              v
            COMPLETED       retry <= limit
                               | exhausted
                               v
                              FAILED

CANCELLED can be reached from queued, waiting, running or verifying.
```

Every transition must be auditable. `COMPLETED` means evidence exists: a draft file, test output, generated media artifact or clearly identified external service receipt. Never imply success when only an LLM response exists.

## Workflow A — AUTIQ content production (future integration)

1. Owner gives FACCI a scoped campaign goal; FACCI selects AUTIQ Manager.
2. AUTIQ Manager delegates content research to AUTIQ Marketing, brief/prompt to AUTIQ Image, captions to AUTIQ Social.
3. AUTIQ Image invokes Image Studio adapter only if enabled; otherwise creates a prepared generation request and marks it pending.
4. AUTIQ Social assembles channel-appropriate calendar and drafts in a local staging area or approved Postiz adapter.
5. AUTIQ QA reviews character fidelity, rights, consent, channel suitability and factual claims.
6. FACCI asks owner to approve publishing; only publish via official, authorized platform APIs with account rights.
7. Social agent gathers result metadata and later analytics, reporting sources and any failures.

**NSFW routing**: Explicit adult media must never be automatically routed to Instagram/TikTok or other platforms that forbid it. Explicit media workflows require adult/consent/rights checks, platform compliance and separate destinations. No workflow bypasses moderation rules or publishing permissions.

## Workflow B — Grupvi coding task (near-term target after first milestone)

1. Owner asks to improve a named aspect of StudieChat/Grupvi.
2. Grupvi Manager records acceptance criteria and delegates to Grupvi Developer.
3. Tool policy validates that the workspace path is explicitly configured and inside an allowlist.
4. Developer reads allowed repo context, works on a branch/worktree, proposes diff, runs tests/lint/type checks.
5. QA reviews test results and changed files; evidence attached.
6. Owner approves merge, production deploy or any destructive operations separately. Agent cannot silently push to production.

## Workflow C — Organization management (MVP)

1. User creates a new project called `Example Business`.
2. System creates manager agent (project-scoped) and enables role templates `developer`, `marketing`, `qa` as independent agent records under that manager.
3. Owner creates task `Draft first marketing plan` and assigns it via manager.
4. Deterministic MVP simulator (or validated Ollama plan, when enabled) selects Marketing agent.
5. Worker persists progress, writes a real local markdown artifact, shows it in activity feed, and marks complete only after verifying the file exists.
6. Restart dashboard; task, hierarchy, result and audit log remain.

## Workflow D — Crash/restart and permissions (MVP)

- Pause/restart the worker mid-task; leased job returns to queued/recoverable state without duplicating side effects.
- Request a `publish social post` action; no connected integration or human authorization -> must show `WAITING_APPROVAL` or `BLOCKED`, never pretend to publish.
- Try to read a file outside an approved project workspace -> policy denies action and logs refusal.
- Cancel a running task -> persisted cancellation; no new tool steps after cancellation.

## UX requirements

### FACCI Command Center
- Global owner command input, clear 'not yet connected' status for tools.
- Organization tree: FACCI CEO > project managers > specialists, create/edit roles.
- Overview cards: total projects, queued/running/blocked/completed tasks, pending approvals.
- Activity stream with agent, project, timestamps, tool actions and links to artifacts.

### Project workspace
- Project objective, goals, manager, team members and permission badges.
- Project-specific task board (queue, running, review, done), schedules, artifacts and memory.
- Chat/task input where owner can address CEO or a specific manager.
- Source-of-truth files/repo path (only if configured).

### Approvals
- Each proposed sensitive action displays exact account/service, action, destination, scope, payload summary, cost and expiry.
- Approve once or reject. Avoid irreversible blanket 'approve everything'.

### Design direction
Professional, uncluttered 'digital workspace'. Dark monochrome-inspired premium aesthetic, restrained accents, responsive desktop-first design with readable mobile layouts. Avoid flashy charts without real data and dashboards full of fake live statuses. Show explicit empty states and connection states. Danish UI can be selected as default, with code/doc text in English.
