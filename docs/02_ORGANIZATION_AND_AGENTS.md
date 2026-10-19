# 02 — Agent Organization, Context & Delegation

## Terminology
- Owner: real person, ultimate authorization.
- CEO Agent: one cross-project coordinator. Does not bypass approval controls.
- Project Manager Agent: one for every business/app, independently scoped context and priorities.
- Specialist Agent: a concrete project-local role instance with configuration and permissions.
- Role Template: reusable definition (Developer, Social, Image, Marketing, QA, Security, Research, Analytics, Automation). Templates are not globally omniscient agents.
- Tool: a capability executable via an adapter, always mediated by policy and logging.
- Run: an execution of a task by an agent; can have many steps and approvals.

## Separate organization from execution
The **agent identity** is a set of role instructions, scope, tool permissions, project state, history and responsibilities. An **LLM runtime** is computation shared by several identities. Therefore multiple teams do not imply multiple models loaded in VRAM. One model can serve one role at a time, rehydrating the approved project context for each turn.

## Sample manager configurations

| Project | Purpose | Initial child agent roster | Notes |
|---|---|---|---|
| AUTIQ | Content/automation business | Social, Image, Developer, Marketing, Automation, QA | Treat project ownership, creator assets and platform access as private |
| StudieChat / Grupvi | Group study/chat application | Developer, UX, QA, Research | Actual repo/workspace location must be supplied or selected; never guessed |
| DreamIT | Separate product/business | Developer, Design, Research, Marketing | Existing product stage is unknown: avoid inventing requirements |
| AI Image Studio | Existing external application/tool | No project manager required just to use it | May separately be registered as a managed *software project* later, but its shared tool identity is distinct |

## Goals, delegation and escalation
1. CEO parses owner goal, checks known project portfolio, determines manager(s), assigns priority and overall deadline if supplied.
2. Manager checks its own project goals, recent work, capabilities and permissions, decomposes bounded tasks and delegates to child agents.
3. Specialist proposes executable plan or calls an authorized tool with structured parameters.
4. Deterministic scheduler/policy checks user permissions, project scope, approvals, resource limits and dependencies.
5. Worker executes, captures observable output and tests, and updates task + artifacts.
6. Manager evaluates results and can request revision within bounded retries.
7. CEO consolidates cross-project summary, cost/resource use, blockers and owner decisions.

### Stop conditions
Every delegation has a max step count, retry limit, wall-clock timeout, cost limit and clear completion criteria. Agents cannot create infinitely recursive subagents or spawn unlimited parallel work. Default `maxDelegationDepth=3` (CEO > manager > specialist), `maxParallelLLMJobs=1`, `maxRetries=2` for transient technical failures, adjustable after measurement.

## Memory scopes

**Owner memory**: high-level preferences explicitly saved, portfolio priorities, global tool approvals and budgets.

**CEO memory**: portfolio goals, high-level status, owner directions; summarizes project-level data, not entire private project files by default.

**Project memory**: project requirements, architecture choices, current backlog, repo links, selected agents, latest artifacts, integration configuration. Enforced by `project_id` and workspace boundaries.

**Agent memory**: role instructions, current task context, execution checkpoints, tool results. Transient reasoning does not need to be stored verbatim; persist observable decisions/evidence.

**Shared knowledge**: only explicit owner-approved, non-confidential templates and procedures; no secret or credential sharing.

### Information hierarchy
Use explicit fact provenance for status updates: task ID, timestamp, file changes, command/test result or asset. Distinguish `observed`, `inferred`, `proposed`, `blocked`. Avoid fabricated task completion or fabricated research.

## Role examples (not exhaustive)
- **Developer**: read allowed repo, propose implementation, create branch, change allowed files, run safe tests, generate diffs; requires approval for merge, deploy, destructive operations, secret access.
- **Image**: build briefs, choose consented adult fictional/rights-cleared characters, request generation from approved engine; label SFW/NSFW and platform route; review output.
- **Social**: maintain content calendar and captions, plan timing, stage drafts in Postiz; approval gate for publishing.
- **Marketing**: hypotheses, content strategy, competitor research from public sources; cite inputs.
- **Automation**: define n8n workflows, dry-run; require approval for live external triggers.
- **QA/Security**: test releases, scan code/settings, report flaws; never silently patch production systems.
- **Analytics/Optimization**: ingest authorized metrics, evaluate outcomes, recommend changes; avoid misleading claims.

## Creating a new project
Create `Project`; instantiate manager agent; choose role templates and create local team instances; choose permitted workspaces and tools; set project objectives; configure memory boundary and human approver. This must be dynamic, not a hardcoded AUTIQ-only database or navbar.
