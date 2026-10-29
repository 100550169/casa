# ADR-0007 · GitHub Actions as job scheduler

**Status:** accepted

## Context

The evening reminder and the nightly backup need to run at a given time. The free hosting plan
puts the server to sleep without traffic and offers no scheduled jobs.

## Decision

- Scheduled GitHub Actions workflows call the API (waking the server up along the way).
- Because GitHub can delay runs by hours, the reminder is attempted **five times** during the
  afternoon and the server only acts inside its **time window** (17:00–21:30) and **once a day**,
  recorded atomically in `casa_meta`.
- The nightly backup stores the state in the `backups` branch, outside the database provider.

## Alternatives

- **A paid hosting plan** with cron jobs: recurring cost.
- **An external scheduler** (e.g. cron-job.org): another account and another secret to manage.
  Kept as an option if delays become frequent.

## Consequences

- ✅ Zero cost and everything versioned in the repository.
- ✅ Idempotent: repeating the call never duplicates notifications.
- ⚠️ If every attempt arrives late, there is no reminder that day (preferred over notifying at
  night).
