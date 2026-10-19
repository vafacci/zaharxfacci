# Skipped / opt-in tests

Default `npm run test` reports **2 skipped** suites (Vitest `describe.runIf`):

| Suite | File | Gate | Why skipped by default |
|---|---|---|---|
| Ollama live structured planning | `tests/ollama-provider.test.ts` | `FACCI_LIVE_OLLAMA_TEST=1` | Needs a healthy local Ollama model; multi-minute; GPU/CPU contention with ComfyUI |
| Developer adapter live toy fix | `tests/developer-adapter.test.ts` | `FACCI_LIVE_DEV_TEST=1` | Mutates `workspaces/toy-counter`; may run OpenCode; up to ~6 minutes |

Always-on smoke tests in those files still run (health / availability).

Enable manually:

```powershell
$env:FACCI_LIVE_OLLAMA_TEST="1"; npm run test -- tests/ollama-provider.test.ts
$env:FACCI_LIVE_DEV_TEST="1"; npm run test -- tests/developer-adapter.test.ts
```
