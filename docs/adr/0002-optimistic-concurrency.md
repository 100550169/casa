# ADR-0002 · Optimistic concurrency with versioning and client-side merge

**Status:** accepted

## Context

Several devices edit the same document ([ADR-0001](0001-single-state-document.md)): a child ticks
a chore on their phone while the parents approve another one on the computer. With "last write
wins", one of the two changes disappeared without warning.

## Decision

- Every read returns `_version`; every write sends it back.
- The server writes with `UPDATE … WHERE version = $n` and answers **`409 version_desfasada`**
  (stale version) if someone else wrote first.
- On a `409`, the client reloads and **reapplies the top-level fields it changed** on top of the
  fresh state.
- The version check runs before the profile rules, so an outdated device gets a retryable error
  rather than a `403`.
- Synchronization by polling every 4 s.

## Alternatives

- **Pessimistic locking**: unworkable with mobile clients that can close at any moment.
- **WebSockets / SSE**: better latency, but the free hosting plan puts the server to sleep and
  drops connections; polling is enough at this scale.
- **CRDTs or an operation log**: the right long-term solution, disproportionate today.

## Consequences

- ✅ No change is ever lost silently.
- ✅ Small implementation, verified in `test/concurrencia.test.js`.
- ⚠️ If two devices change **the same top-level field** at the same time, one prevails (with a
  notice). Planned evolution: granular actions ([roadmap](../ROADMAP.md#technical-debt)).
