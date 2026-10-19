# 01 — FACCI Product Vision & Scope

## One-sentence product definition
FACCI is a **local-first AI organization operating system** for one human owner running multiple independent apps and businesses; the owner directs one overall CEO agent, who delegates to a dedicated manager for each business, whose team of specialist agents performs bounded and auditable work with approved shared tools.

## Why it exists
The owner currently switches between several projects, coding assistants, image generators, publishing tools and workflows. The aspiration is to stop manually repeating orchestration and spend more time deciding priorities, reviewing results and developing businesses. FACCI must become a single clear control center rather than a collection of unrelated chatbots.

## Human organizational structure

```text
HUMAN OWNER (strategy, final authority, budgets)
  |
  v
FACCI CEO AGENT (cross-project goals, priorities, coordination, reports)
  |
  +-- AUTIQ MANAGER AGENT (owns AUTIQ project state)
  |     +-- AUTIQ Social Media Agent
  |     +-- AUTIQ Image Agent
  |     +-- AUTIQ Developer Agent
  |     +-- AUTIQ Marketing Agent
  |     +-- AUTIQ Automation Agent
  |     +-- AUTIQ Analytics/Optimization Agent
  |     +-- AUTIQ Security/QA Agent
  |
  +-- STUDIECHAT / GRUPVI MANAGER AGENT
  |     +-- Grupvi Developer Agent
  |     +-- Grupvi UX/UI Agent
  |     +-- Grupvi QA Agent
  |     +-- Grupvi Marketing/Research Agent
  |
  +-- DREAMIT MANAGER AGENT
  |     +-- DreamIT Developer Agent
  |     +-- DreamIT Design Agent
  |     +-- DreamIT Research/Marketing Agent
  |
  +-- FUTURE PROJECT MANAGER AGENT(S) ...

SHARED TOOL REGISTRY (called by authorized project specialists)
  AI Image Studio | Postiz or Publisher | n8n | OpenCode | Git/GitHub
  Browser/Playwright | File storage | Analytics | Ollama | future APIs
```

### Hierarchy invariant
The business/project manager is the owner of decisions within its project, subject to CEO priorities and human permissions. A globally reusable `ImageAgent` **template** may exist in code, but an `AUTIQ Image Agent` and a `Grupvi Image Agent` (if needed) are two separately configured agent instances with separate memory. Do not flatten managers into a global pool of agents.

## FACCI as an alternative to habitual Cursor/Codex usage
FACCI should ultimately perform certain development and operations tasks via a local LLM, coding executor and controlled tools. It is NOT an independently trained replacement for GPT/Claude/Codex quality; those are model capabilities FACCI does not automatically gain. The owner uses Cursor now to bootstrap FACCI, then may ask FACCI to build and maintain features when real tests show it can. The first version is an honest proof of autonomy, not a "run an entire company unsupervised" promise.

## Concrete user stories
1. **Owner:** "FACCI, what are the statuses of all my projects?" CEO summarizes current facts from project agents and task records, with evidence, blockers and next decisions.
2. **Owner:** "AUTIQ needs next week's content." CEO gives the objective to AUTIQ Manager; it delegates research/captions, image generation (via AI Image Studio), QA, and drafting in Postiz. It DOES NOT publish to external accounts without required approval.
3. **Owner:** "Improve Grupvi's chat UX." CEO delegates to Grupvi Manager; developer agent creates a scoped branch/worktree, changes code, runs tests, QA reports results, human approves merge/release.
4. **Owner:** "Find problems we should fix in DreamIT." CEO delegates to DreamIT Manager; research and UX specialist gather evidence, propose tasks and estimate priority, without inventing customer data.
5. **Owner:** "While I'm away, continue approved work." Worker processes pre-approved tasks, logs changes, pauses at human approval barriers, resumes after restart, and reports blockers.
6. **Owner:** "Create a new business." FACCI creates a manager and project workspace, then configures that business's team and tools from templates. No hardcoded new hierarchy needed.

## Shared asset example
`AI Image Studio` exists as a separate, independently developing application; FACCI's `AUTIQ Image Agent` uses a future documented API/tool adapter to request an image and receives asset URL/path, output metadata and generation status. FACCI does not move or rewrite Image Studio code. Other projects may later receive access without sharing AUTIQ's characters or confidential prompts.

## Design principles
- **One owner / one CEO / many independent project managers / nested specialist teams**.
- Tool-first execution, not agents endlessly talking to one another.
- Decisions visible and reversible; agent claims must link to outputs/logs.
- Locally usable; optional external integrations, each activated explicitly.
- Progress over endless planning; milestones must show a functioning slice.
- Optional always-on service, but user PC must remain awake and resources available to operate.
- Full privacy boundaries between projects by default; human may explicitly approve sharing.

## Success means
At minimum the owner can create project organizations, assign a real or simulated safe task to a particular manager, see which specialist was selected and why, watch transitions, approve/reject important actions, and find the outcome after closing/reopening the app. Later: actual local LLM planning, coding, image generation and publishing drafts via approved adapters.

## Not in scope for the first milestone
- Building a new foundation model; claiming Claude-level coding quality.
- Integrating every social platform, browser and remote account.
- Reverse engineering proprietary hosted model weights or private APIs.
- Generating media or auto-posting without a consent/content and platform policy check.
- Running simultaneous large LLMs or multiple image-generation workloads on 6 GB VRAM.
