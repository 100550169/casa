# ADR-0010 · Optional house code as access control

**Status:** accepted

## Context

Without accounts ([ADR-0003](0003-fixed-profiles-without-accounts.md)), anyone who knew the URL
could read or wipe the state. But asking every member for credentials would bring back the
friction that had just been removed.

## Decision

- A **house code** (`XXXX-XXXX-XXXX`: 12 random characters from an alphabet without ambiguous
  characters) in the `CODIGO_CASA` environment variable.
- Each device receives it **once**, through a link (`#casa=…`; the fragment never leaves the
  browser) or by typing it, and sends it in the `X-Casa` header.
- Constant-time comparison of SHA-256 digests; **30 failures per IP within 15 minutes** block
  that IP. A request without a code does not consume attempts.
- **Optional**: without the variable, the API is open. It can be enabled without touching code,
  and `render.yaml` asks for it when the service is created.

## Consequences

- ✅ Separates access (`X-Casa`) from product rules (`X-Perfil`).
- ✅ Can be enabled in minutes ([operations](../OPERATIONS.md#enabling-the-house-code)).
- ⚠️ It is a shared secret: it does not tell people apart and cannot revoke a single device (the
  code has to be rotated).
