# ADR-0001 · A single JSON state document per household

**Status:** accepted

## Context

One installation serves a single household: four profiles, a few dozen chores and a few KB of
data. Nearly every screen needs nearly all of the state (the parents' dashboard shows chores,
allowance, calendar and marketplace at once), and business rules constantly cut across entities.

## Decision

Store the whole state as **one JSONB document** in a single row of `casa_state`
(`CHECK (id = 1)`). The client downloads it whole, modifies it and sends it back whole. Separate
tables are reserved for what does not belong to the household: push subscriptions (per device),
backups (snapshots of the document) and server metadata.

## Alternatives

- **Normalized relational model** (chores, assignments, checkboxes…): more queries, more
  migrations and more mapping code for a volume that will never need it.
- **Key-value store per entity**: complicates atomic operations that touch several entities
  (month close, marketplace).

## Consequences

- ✅ Copying, restoring and downloading the household means copying one document.
- ✅ Business rules are `state → state` functions, easy to test.
- ✅ A single atomic write per change.
- ⚠️ Concurrency has to be solved at document level ([ADR-0002](0002-optimistic-concurrency.md)).
- ⚠️ Every new field requires explicit sanitization and server-side normalization
  ([ADR-0004](0004-server-side-normalization.md)).
- ⚠️ It does not scale to many households per deployment; that is not a goal.
