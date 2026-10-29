# ADR-0004 · Normalize the state only on the server

**Status:** accepted

## Context

When fields were added (meals, calendar), older states did not have them. If the **client**
completed the shape in memory without saving it, every poll saw a difference with the server,
adopted the remote state, completed it again and re-rendered: a **re-render loop** every 4 s.

On top of that, PostgreSQL (`jsonb`) reorders object keys, so comparing with `JSON.stringify`
reported equal objects as different and triggered a write on every read.

## Decision

- All normalization happens on the server (`ensureFixedShape`, `normalizarMenus`,
  `normalizarCalendario`) **and is persisted** during the read if anything changed.
- The client never writes while reading: it uses defaults (`S.agenda || []`).
- Comparisons use `huella()`, a fingerprint independent of key order.

## Consequences

- ✅ Old and new states converge without intervention.
- ✅ Polling is silent at rest: same version across consecutive reads.
- ⚠️ One historical duplication remains: `normalizarMenus()` (server) and `ensureShape()`
  (client) must agree. Scheduled for removal.
