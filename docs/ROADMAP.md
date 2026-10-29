# Roadmap

Status as of 29 October 2026, version 3.4.0. Percentages measure **"ready for daily use"**, not
amount of code.

## Status by module

| Module | Status | Notes |
|---|:-:|---|
| Chore and allowance engine | 95 % | Thresholds, weighted assignment, levels, bonuses |
| Profiles and permissions | 95 % | Rules enforced on the server |
| Tests and CI | 95 % | 160 logic + 45 API checks; UI automation still missing |
| Parents' dashboard | 90 % | Household view, per-child detail, calendar, backups, notifications |
| Streaks | 90 % | Computed on the server, with weekly carry-over |
| Sibling marketplace | 90 % | Explicit seller acceptance |
| Backups | 90 % | Three layers, one-click restore |
| House code | 90 % | Implemented; recommended for every public deployment |
| PWA and installation | 90 % | Android and iOS, with notifications |
| Demo | 90 % | Makes no API requests at all; sample data in both languages |
| Languages | 85 % | Spanish and English per device, notifications included; the privacy policy is still Spanish-only |
| Calendar | 85 % | Drag and drop still missing |
| Push notifications | 85 % | Events and daily reminder |
| Rewards | 85 % | Point reservation, stock |
| Meals | 85 % | Shopping list still missing |
| Concurrency | 85 % | Per-field merge at the top level |
| Accessibility | 75 % | WCAG AA contrast; dark mode and a screen-reader review still missing |
| Chore approval | 60 % | Photo proof still missing |
| Achievements | 55 % | Fixed badges, no progression |

## Next features

Ordered by expected impact on real use:

1. **Savings goal** — visible saving towards a concrete target.
2. **Per-child iCal export** — chores in the phone's native calendar, with their alerts.
3. **Configurable reminder time** from the app.
4. **Photo proof** when submitting a chore.
5. **Shopping list** derived from the weekly meal plan.
6. **Calendar**: drag and drop; change requests from children with parental approval.
7. **Weekly summary** for parents.
8. **Achievements with progression** and a notification when unlocked.
9. **Dark mode.**

## Technical debt

| Item | Priority | Proposal |
|---|:-:|---|
| Client in a single `index.html` (~2,700 lines) | high | ES modules with a minimal bundling step |
| No automated UI tests | high | Playwright against `/demo` in CI |
| Conflict merge at the top-level field | medium | Log granular actions instead of sending the whole document |
| `normalizarMenus()` (server) and `ensureShape()` (client) duplicated | medium | Normalize only on the server, as the calendar already does |
| Reminder depends on GitHub's scheduling punctuality | medium | External scheduler or the provider's cron jobs |
| Unused tables from the accounts version | low | Clean-up migration after a backup |

## Security (if opened to more users)

- Enable the house code.
- Privacy policy with a real contact.
- Review before publishing on Google Play.

See [SECURITY.md](../SECURITY.md).
