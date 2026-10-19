# 07 — Tool Registry, Integrations and Research Links

These are research starting points, NOT claims that every service is already connected. Read latest documentation and check actual versions, API availability, costs and permissions before implementing.

## Integration registry roadmap

| Tool | Role inside FACCI | When | Principle |
|---|---|---|---|
| Ollama | Local shared model inference | M2 | Model provider; check running service, available model and VRAM budget |
| OpenCode | Local coding executor | M3 | Tool adapter, workspace allowlist, bounded subprocess + captured logs |
| AI Image Studio | Reference-based image generation | M4 | Shared external tool; no direct changes to `imagegen` repo |
| Postiz | Social drafts/scheduling via official integration | M4 | Consider self-hosting first; treat AGPL license and OAuth separately |
| n8n | Deterministic workflows, triggers and scheduling | M4 | Automation layer, not the FACCI organizational leader |
| Playwright | Controlled browser UI automation/testing | M3+ | Local dev/read-only first; external account actions require approval |
| REA | Legal analysis of desired third-party UX/features | optional | Developer research, not a free backend to proprietary services |
| Git/GitHub | Versioned repository tasks, PRs | M3+ | Explicit repo authorization and review for external actions |
| OneDrive / cloud files | Content artifact storage | later | Official Microsoft Graph API, explicit consent/credentials |
| Other model APIs (Kling/Veo/etc.) | Optional paid media providers | later | Official APIs, permitted content, budgeted requests |

## Official reference materials (verify during implementation)

- Cursor Project Rules: https://cursor.com/docs/rules
- Ollama documentation: https://docs.ollama.com/
- Ollama and OpenCode integration: https://github.com/ollama/ollama/blob/main/docs/integrations/opencode.mdx
- OpenCode provider configuration: https://docs.opencode.ai/docs/providers/
- OpenCode CLI non-interactive execution: https://dev.opencode.ai/docs/cli/
- Ollama structured output: https://github.com/ollama/ollama/blob/main/docs/capabilities/structured-outputs.mdx
- Ollama tool calling: https://github.com/ollama/ollama/blob/main/docs/capabilities/tool-calling.mdx
- Postiz source: https://github.com/gitroomhq/postiz-app
- Postiz official docs: https://docs.postiz.com/
- Postiz license: https://github.com/gitroomhq/postiz-app/blob/main/LICENSE
- n8n official docs: https://docs.n8n.io/
- Playwright official docs: https://playwright.dev/docs/intro
- REA: https://github.com/morluto/rea
- Microsoft Graph: https://learn.microsoft.com/en-us/graph/overview

## License/compliance note for Postiz
The self-hosted Postiz repository is AGPL-3.0. Running unmodified software separately from FACCI and communicating over a documented API is conceptually different from copying its source into proprietary FACCI code or modifying and distributing/serving the AGPL work. Confirm license obligations for actual distribution and architecture; do not assume embedding is license-neutral. Hosting and integration still require maintenance, social platform app credentials and possible external fees.

## REA constraint
REA's own README says it performs evidence-based inspection and does not automatically clone the original source. Use it for legitimate understanding/independent implementations, not to obtain unpaid access to Higgsfield, Veo, Kling, Buffer or any private APIs. For straightforward open-source libraries and supported APIs, source/docs are typically simpler than REA.

## Model/runtime note
Ollama + OpenCode integration is documented, but OpenCode's larger context requirements may be memory-limited on 6GB. First benchmark structured plans with a small model. If agent coding fails in repeatable tests, report the limitation and retain optional cloud provider architecture; do not claim the local model is equivalent to Cursor/Claude/Codex.
