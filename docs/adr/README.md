# Architecture Decision Records (ADR)

Each ADR documents a relevant decision: its context, the alternatives considered and its
consequences. Format by [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

| # | Decision | Status |
|---|---|---|
| [0001](0001-single-state-document.md) | A single JSON state document per household | Accepted |
| [0002](0002-optimistic-concurrency.md) | Optimistic concurrency with versioning and client-side merge | Accepted |
| [0003](0003-fixed-profiles-without-accounts.md) | Fixed profiles instead of user accounts | Accepted (supersedes the accounts model) |
| [0004](0004-server-side-normalization.md) | Normalize the state only on the server | Accepted |
| [0005](0005-server-clock.md) | The server clock decides the cycles | Accepted |
| [0006](0006-self-hosted-web-push.md) | Standard Web Push with VAPID, no third-party provider | Accepted |
| [0007](0007-github-actions-as-scheduler.md) | GitHub Actions as job scheduler | Accepted |
| [0008](0008-framework-free-client.md) | Framework-free client and minimal dependencies | Accepted (to be revisited) |
| [0009](0009-three-layer-backups.md) | Three-layer backups | Accepted |
| [0010](0010-optional-house-code.md) | Optional house code as access control | Accepted |

To propose a new decision, copy the structure of any of them and use the next free number.
