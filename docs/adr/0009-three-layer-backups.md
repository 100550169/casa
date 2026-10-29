# ADR-0009 · Three-layer backups

**Status:** accepted

## Context

At first, backups only existed if someone pressed a button, and a single reset request wiped the
household with no way back.

## Decision

| Layer | When | Retention | Location |
|---|---|---|---|
| Daily | first read of the day, before applying cycles | 30 | `casa_copias` |
| Safety | before `reset`, `restore` or restoring a backup | 10 | `casa_copias` |
| Off-site | every night | one per day | `backups` branch of the repository |

A partial unique index guarantees a single daily backup even under concurrent requests.

## Consequences

- ✅ Every destructive operation can be reversed by another operation.
- ✅ Losing the entire database costs at most one day.
- ⚠️ The `backups` branch contains the household's real data, so the repository must be private.
  The workflow refuses to run in public repositories.
