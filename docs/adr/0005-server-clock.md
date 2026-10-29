# ADR-0005 · The server clock decides the cycles

**Status:** accepted

## Context

The week rollover clears checkboxes and the month rollover archives history and marks chores as
late. At first the client decided this from its local date: a phone with the wrong date could
reset the month for the whole household.

## Decision

- Day, ISO week and month keys are computed on the server in the `TZ_FAMILIA` time zone
  (`services/tiempo.js`).
- Cycles are applied **lazily** on the first read after they are due (`leerEstadoAlDia`), which
  tolerates the server being asleep.
- A write carrying a previous cycle is rejected with `409 ciclo_desfasado` (stale cycle).

## Consequences

- ✅ No device can move a cycle forwards or backwards.
- ✅ No scheduler is needed for the cycles.
- ⚠️ The time zone is per deployment, not per user (consistent with a single household).
