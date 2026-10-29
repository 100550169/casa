# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/). Versions prior to 3.3.0 were developed in a private
repository and are summarized here from its history.

## [Unreleased]

## [3.3.0] — 2026-10-28 · First public release

### Added
- One-click deployment with [`render.yaml`](render.yaml) (Render Blueprint) and a step-by-step
  guide in [docs/DEPLOY-ON-RENDER.md](docs/DEPLOY-ON-RENDER.md).
- Complete technical documentation: architecture, API, data model, business rules, testing,
  operations, user guide, roadmap, AI-assisted development and ten ADRs.
- MIT license, code of conduct, contributing guide, security policy, issue and pull request
  templates, `.editorconfig`, `.gitattributes` and `.nvmrc`.
- Demo screenshots in the README.

### Changed
- Sample profiles with fictitious names (Mateo, Pablo and Sara); headings that named the children
  are now derived from `public/perfiles.js`.
- Scheduled jobs only run when the `CASA_URL` variable exists; the nightly backup refuses to run
  in public repositories and now writes to the `backups` branch.
- The Android configuration uses a placeholder (`TU-SERVICIO`) instead of a fixed address.

## 3.2.0 — 2026-10-28

### Added
- End-to-end API test suite against a real PostgreSQL database in CI (`npm run test:http`).

### Changed
- Express 5, dotenv 18, pg 8.23 and GitHub Actions v7.
- The evening reminder is only sent between 17:00 and 21:30 and is attempted five times.
- WCAG AA contrast palette, 11 px minimum font size, visible focus, `prefers-reduced-motion` and
  ARIA labels on icon buttons.
- The house code becomes optional and no longer shows alarm-style warnings.

### Fixed
- `/demo` returned an error on Express 5.
- Client errors (malformed JSON, oversized body) returned `500` instead of `4xx`.

## 3.1.0 — 2026-10-26

### Added
- Weekly calendar: each child's schedule, slot-based template, deterministic planner and conflict
  detection.
- Push notifications (Web Push + VAPID) for events, plus a daily reminder.
- House code with rate limiting.
- Daily, safety and off-site nightly backups.
- Dependabot and `npm audit` in CI.

### Fixed
- Any request without headers could reset the state.
- The downloaded backup bypassed access control.
- Restoring left the client without a version.

## 3.0.0 — 2026-09-03

### Changed
- **Breaking:** accounts, families and invitations are replaced by four fixed profiles
  ([ADR-0003](docs/adr/0003-fixed-profiles-without-accounts.md)). Data is migrated automatically.

### Removed
- Sign-up, passwords, verification and email delivery.

## 2.0.0 — 2026-08-15

### Added
- Installable app (PWA) and groundwork for Google Play (TWA).
- Public demo at `/demo` with no access to real data.
- Server-side state sanitization and permissions.
- Real streaks, reward redemption and marketplace confirmation.
- Automatic late marking and monthly history.
- Optimistic concurrency between devices.
- First automated tests (money, assignment, redemption).

### Fixed
- Re-render loop, cycles decided by the phone's clock and XSS when rendering names.
- Broken meal plans in new households (`[object Object]`).

## 1.0.0 — 2026-06-04

### Added
- First version: chores, allowance, rewards and meal plans with accounts, families and email
  invitations.

[Unreleased]: https://github.com/100550169/casa/compare/v3.3.0...HEAD
[3.3.0]: https://github.com/100550169/casa/releases/tag/v3.3.0
