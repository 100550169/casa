# Security policy

## Supported versions

| Version | Supported |
|---|:-:|
| 3.3.x | ✅ |
| < 3.3 | ❌ |

## Reporting a vulnerability

Please do not open a public issue. Use **Security → Report a vulnerability** (private advisory)
in this repository. You will get an answer within 7 days.

## Threat model

Casa is designed for **a single, trusted household**. The model distinguishes two boundaries:

| Boundary | Threat | Control |
|---|---|---|
| **Outside ↔ household** | An outsider reads or wipes the data | House code (`X-Casa`), rate limiting, `noindex` |
| **Inside the household** | A child approves their own chores or edits someone else's | Per-profile rules enforced on the server |

**Out of scope:** a household member impersonating another profile. This is a documented product
decision ([ADR-0003](docs/adr/0003-fixed-profiles-without-accounts.md)).

## Implemented controls

| Control | Implementation |
|---|---|
| Access | Optional house code; constant-time comparison; 30 failures per IP in 15 min → `429` |
| Authorization | `applyChildLimits()` and `soloPapas` on the server, independent of the client |
| Input validation | Allow-list `sanitizeState()`: types, lengths, enums, references; body ≤ 4 MB |
| Integrity | Optimistic concurrency; streaks and history computed only on the server |
| XSS | Systematic escaping of all data before rendering |
| SSRF | Push subscriptions restricted to known services |
| Headers | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS, `X-Robots-Tag: noindex`; no `X-Powered-By` |
| Errors | `500` responses never include internal details |
| Secrets | Environment variables only; `.env` and signing keys excluded from git |
| Dependencies | Dependabot (alerts and automatic fixes) and `npm audit --audit-level=high` in CI |
| Recovery | Three-layer backups; every destructive operation saves a backup first |

## Recommended configuration

- **Set `CODIGO_CASA`** on any deployment reachable from the Internet. Without it, anyone who
  knows the URL can read and modify the data. `render.yaml` asks for it when the service is
  created.
- The nightly backup in the `backups` branch contains the household's real data: the workflow
  **refuses to run in public repositories**.
- Do not publish your deployment URL alongside the code or in issues.
- Secure installation guide: [docs/DEPLOY-ON-RENDER.md](docs/DEPLOY-ON-RENDER.md).

## Known limitations

- The house code is a shared secret: it does not identify people and cannot revoke a single
  device.
- There is no per-person audit log.
- No Content Security Policy (CSP), because the client uses inline scripts.
