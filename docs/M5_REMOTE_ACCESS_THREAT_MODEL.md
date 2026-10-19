# M5 — Optional remote access (threat model only)

FACCI remains **local-first** on `127.0.0.1`. Remote exposure is **out of M5 implementation scope**.

## Threats if bound to LAN/WAN without controls
- Unauthenticated task creation, approval decisions, schedule enablement, backup/restore.
- Prompt-injection surfaces via attacker-controlled task objectives.
- Tool adapters (OpenCode workspace, Image Studio, n8n) reachable as a pivot.

## Minimum controls before any remote bind
1. Authentication (session or mTLS) on every write API.
2. TLS termination; no plain HTTP on non-loopback.
3. CSRF / Origin checks for browser clients.
4. Explicit allowlist of client networks; fail closed.
5. Separate threat review for publishing / workspace tools.

Until then: keep Next.js and worker on localhost; use Windows Remote Desktop or VPN to the host if needed, not a public FACCI port.
