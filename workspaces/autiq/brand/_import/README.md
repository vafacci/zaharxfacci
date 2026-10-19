# Brand import inbox

Drop ChatGPT exports here only as **source files** if you want; the CLI writes timestamped draft runs.

```bash
npm run autiq:brand:import -- --file path/to/conversations.json
# or
npm run autiq:brand:import -- --file path/to/curated-notes.md
```

- Output: `brand/_import/<timestamp>/*.draft.md` + `IMPORT_SUMMARY.md`
- Live pack (`voice.md`, `positioning.md`, …) is **not** auto-updated
- Copy approved lines manually after review
- Secrets matching common API-key patterns are redacted

The weekly content loop **ignores** this folder.
