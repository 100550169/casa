<div align="center">

<img src="docs/img/hero.png" alt="Casa: the parents' dashboard on a laptop and a child's app on a phone" width="100%" />

# 🏠 Casa

**Household management for families: chores, weekly allowance, a calendar built around each
child's schedule, meal plans and phone notifications.**

A Progressive Web App with a Node.js and PostgreSQL backend, built end to end with AI-assisted
development and used every day in a real home.

[![Tests](https://github.com/100550169/casa/actions/workflows/tests.yml/badge.svg)](https://github.com/100550169/casa/actions/workflows/tests.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Web%20Push-5A0FC8?logo=pwa&logoColor=white)
[![Built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-D97757)](docs/AI-ASSISTED-DEVELOPMENT.md)

[Deploy](#-deploy-on-render) · [Try the demo](#-try-the-demo) ·
[Documentation](#-documentation) · [How it was built with AI](docs/AI-ASSISTED-DEVELOPMENT.md)

</div>

> [!IMPORTANT]
> **Casa needs a server: it is deployed on [Render](https://render.com).** It is not a static
> site (it will not work on GitHub Pages): the API stores the state, enforces each profile's
> rules, decides the week and month rollovers and sends the notifications. Render (server) and
> [Neon](https://neon.tech) (PostgreSQL) both have a free plan, and the repository ships a
> [`render.yaml`](render.yaml) for one-click deployment. See
> [Deploy on Render](#-deploy-on-render) below and the full guide in
> [docs/DEPLOY-ON-RENDER.md](docs/DEPLOY-ON-RENDER.md).

---

## Table of contents

- [The problem](#-the-problem)
- [Screenshots](#-screenshots)
- [Features](#-features)
- [Try the demo](#-try-the-demo)
- [Deploy on Render](#-deploy-on-render)
- [Local development](#-local-development)
- [Architecture](#-architecture)
- [Testing](#-testing)
- [Repository structure](#-repository-structure)
- [Documentation](#-documentation)
- [Built with AI](#-built-with-ai)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

## 💡 The problem

In a home with several children, the chore split usually lives in the parents' heads: who did
what, how much allowance each child has earned, which day each one is free given school and
after-school activities. Generic to-do apps model none of that.

**Casa** turns those rules into a system: each child sees today's chores on their phone, parents
approve from the computer, the allowance is calculated automatically and the app **notifies**
people when there is something to do or to approve.

## 📸 Screenshots

Sample data from the demo, shown in English; all names are fictitious. The interface is also available in Spanish.

<table>
  <tr>
    <td width="33%"><img src="docs/img/screenshots/mobile-home.png" alt="A child's home screen: today's chores, allowance and progress" /></td>
    <td width="33%"><img src="docs/img/screenshots/mobile-week.png" alt="A child's week, organized around their schedule" /></td>
    <td width="33%"><img src="docs/img/screenshots/mobile-achievements.png" alt="Achievements, level and streaks" /></td>
  </tr>
  <tr>
    <td align="center"><b>Today</b><br/>Chores due today, by time slot</td>
    <td align="center"><b>My week</b><br/>Built around school and activities</td>
    <td align="center"><b>Achievements</b><br/>Levels, streaks and badges</td>
  </tr>
</table>

<table>
  <tr>
    <td width="50%"><img src="docs/img/screenshots/desktop-calendar.png" alt="Weekly calendar with the planner and conflict detection" /></td>
    <td width="50%"><img src="docs/img/screenshots/desktop-children.png" alt="Side-by-side comparison of the children in the parents' dashboard" /></td>
  </tr>
  <tr>
    <td align="center"><b>Calendar</b><br/>Free-slot planner with conflict detection</td>
    <td align="center"><b>Children</b><br/>Progress, allowance and points at a glance</td>
  </tr>
</table>

More screenshots in [`docs/img/screenshots`](docs/img/screenshots/).

## ✨ Features

| Area | What it does |
|---|---|
| **Chores** | Three types: daily fixed, weekly fixed (with approval) and extra chores worth points, assigned every month with a split weighted by each child's availability |
| **Economy** | Weekly allowance by thresholds (75 % unlocks the fixed allowance, 100 % unlocks extra chores); configurable point value |
| **Gamification** | Points, levels, server-computed streaks, badges and redeemable rewards with point reservation |
| **Marketplace** | Siblings trade extra chores for points or swaps, with explicit acceptance |
| **Calendar** | Each child's schedule (school, activities), slot-based weekly template and a deterministic planner that places chores in free slots and detects conflicts |
| **Meals** | Dish database and a generated weekly meal plan |
| **Push notifications** | Standard Web Push (VAPID) with no third-party service: submissions, approvals, rewards, marketplace and a daily evening reminder |
| **Backups** | Daily in the database, automatic before every destructive operation and, optionally, nightly on GitHub |
| **Multi-device** | Polling-based sync with optimistic concurrency: no device silently overwrites another's changes |
| **Demo** | `/demo` runs the full app with fictitious data and a fake server inside the browser |
| **Languages** | Spanish and English, chosen on each device; push notifications arrive in each phone's language |
| **Accessibility** | WCAG AA contrast, visible focus, `prefers-reduced-motion` and ARIA labels |

Two experiences on the same codebase: **mobile-first** for children and **desktop-first** for the
parents' dashboard.

## 🎮 Try the demo

The demo needs no database and no third-party account:

```bash
git clone https://github.com/100550169/casa.git
cd casa
npm install
npm start
```

Open <http://localhost:3000/demo> and switch profiles with the button in the bottom bar. Nothing
you change is saved.

## 🚀 Deploy on Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/100550169/casa)

Running Casa for **your household** takes three pieces, all on free plans:

| Piece | Service | Purpose |
|---|---|---|
| Code | **GitHub** | Your copy of the repository, with your family's names |
| Database | **[Neon](https://neon.tech)** | PostgreSQL, where the household's state lives |
| Server | **[Render](https://render.com)** | Runs the API and serves the app over HTTPS |

**Step by step** (15–20 minutes):

1. **Create your copy.** *Use this template → Create a new repository*.
2. **Set your household's names** in [`public/perfiles.js`](public/perfiles.js) (each child's
   `name`, `emoji` and `color`) and commit.
3. **Create the database** on [Neon](https://console.neon.tech): *New project* → Frankfurt
   region → *Connect* → copy the pooled connection string.
4. **Choose a house code** with `npm run codigo` (or a passphrase of 12+ characters). It is the
   key to the app: without it, anyone with the address could get in.
5. **Create the service on Render:** [dashboard.render.com](https://dashboard.render.com) →
   *New → Blueprint* → pick your copy. Render reads [`render.yaml`](render.yaml) and only asks for
   `DATABASE_URL` (step 3) and `CODIGO_CASA` (step 4) → *Apply*.
6. **Verify** `https://<your-service>.onrender.com/api/health` →
   `{"ok":true,"db":true,"protegida":true}`.
7. **Install it on the phones:** parents' dashboard → *Economía → Acceso → Copiar enlace* (copy
   link), open the link on each phone and choose *Add to Home Screen*.

Optional: the daily reminder and the nightly backup are enabled with the `CASA_URL` variable in
GitHub Actions. All the details, environment variables and troubleshooting are in
**[docs/DEPLOY-ON-RENDER.md](docs/DEPLOY-ON-RENDER.md)**.

> [!NOTE]
> The **Deploy to Render** button above deploys *this* repository as is (handy for a quick
> trial). For your household, use your own copy (steps 1–5) so every push picks up your changes.
> On the free plan the server sleeps after 15 minutes of inactivity and the first load takes
> about a minute.

## 🛠 Local development

**Requirements:** Node.js 18 or later (CI uses 22) and a reachable PostgreSQL (local, Docker or
Neon).

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL
npm start                 # http://localhost:3000
```

Migrations run automatically at startup. A disposable PostgreSQL with Docker:

```bash
docker run -d --name casa-pg -e POSTGRES_PASSWORD=prueba -e POSTGRES_DB=casa -p 55432:5432 postgres:16-alpine
```

```dotenv
DATABASE_URL=postgres://postgres:prueba@localhost:55432/casa?sslmode=disable
```

| Command | What it does |
|---|---|
| `npm start` | Starts the server |
| `npm test` | 160 logic tests, no database or network |
| `npm run test:http` | 45 checks against a real server and an empty PostgreSQL |
| `npm run codigo` | Generates a random house code |

Environment variables: [`.env.example`](.env.example) and
[docs/DEPLOY-ON-RENDER.md](docs/DEPLOY-ON-RENDER.md#environment-variables).

> **Language note:** the interface is available in **Spanish and English** (switch it from the
> profile picker or the *Switch* menu). The source code uses Spanish identifiers and comments
> (`leerEstadoAlDia`, `planificarSemana`…) because the app was built for a Spanish-speaking
> household; UI text is written in Spanish and translated at runtime from a single catalog
> ([ADR-0011](docs/adr/0011-runtime-ui-translation.md)). All documentation is in English.

## 🧱 Architecture

```mermaid
flowchart LR
  subgraph Devices
    A["PWA<br/>public/index.html"]
    SW["Service worker<br/>public/sw.js"]
  end
  subgraph Server["Server (Render)"]
    E["Express 5<br/>routes/ + services/"]
  end
  DB[("PostgreSQL (Neon)<br/>state document<br/>+ backups, push, meta")]
  GH["GitHub Actions<br/>CI · reminder · backup"]
  PUSH["Web Push services<br/>Apple · Google · Mozilla"]

  A -- "REST /api (4 s polling)" --> E
  E --> DB
  GH -- "scheduled" --> E
  E -- "VAPID" --> PUSH --> SW
```

Key decisions (details in [docs/adr](docs/adr/)):

- **A single JSON document** per household in one PostgreSQL row, with **optimistic
  versioning** (`409 Conflict` on a stale write and a per-field merge on the client).
- **The server is the source of truth**: it sanitizes every write, enforces each profile's
  rules, computes streaks and decides week and month rollovers with its own clock.
- **Pure business logic** in `services/`, with no I/O, so it can be tested without a database.
- **Minimal dependencies**: four in production (`express`, `pg`, `dotenv`, `web-push`) and none
  for development. Framework-free client.

| Layer | Technology |
|---|---|
| Server | Node.js 18+, Express 5 |
| Database | PostgreSQL 16, idempotent SQL migrations |
| Client | Framework-free HTML, CSS and JavaScript; installable PWA |
| Notifications | Web Push (RFC 8030) with VAPID keys generated and persisted by the server |
| Testing | `node:test` (native runner) and an end-to-end HTTP suite |
| CI/CD | GitHub Actions, Dependabot, Render Blueprint with continuous deployment |
| Android | Trusted Web Activity (Bubblewrap) ready for Google Play |

More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## ✅ Testing

- **Logic** (`test/*.test.js`): money, weighted assignment, sanitization, per-profile
  permissions, streaks, month close, marketplace, concurrency, calendar, notifications, backups,
  access code and translations.
- **API** (`test/http/api.js`): routes, status codes, permissions, rate limiting, backups and
  notifications, against a real PostgreSQL. It refuses to run against production.
- **CI**: both suites run on every push to `main` and on every pull request, together with
  `npm audit --audit-level=high`.

Full strategy in [docs/TESTING.md](docs/TESTING.md).

## 📁 Repository structure

```
.
├── server.js              # Startup, security headers, route mounting
├── render.yaml            # Render Blueprint (one-click deployment)
├── routes/                # HTTP layer: state, notifications, backups
├── services/              # Business logic (pure) and data access
├── db/                    # PostgreSQL pool and SQL migrations
├── public/                # PWA: app, profiles, service worker, demo
├── test/                  # Logic tests and HTTP suite
├── casa-android/          # Android packaging (TWA)
├── herramientas/          # Icon generation tooling
├── docs/                  # Technical documentation, ADRs and images
└── .github/               # CI, scheduled jobs, Dependabot and templates
```

## 📚 Documentation

| Document | Contents |
|---|---|
| [Deploy on Render](docs/DEPLOY-ON-RENDER.md) | **Step-by-step installation**: GitHub, Neon, Render, phones and troubleshooting |
| [User guide](docs/USER-GUIDE.md) | For the family: installing on a phone, notifications, monthly routine |
| [Architecture](docs/ARCHITECTURE.md) | Components, request lifecycle, synchronization, time cycles |
| [Business rules](docs/BUSINESS-RULES.md) | Functional spec: chores, money, points, marketplace, calendar, notifications, permissions |
| [API reference](docs/API.md) | Endpoints, headers, responses and error codes |
| [Data model](docs/DATA-MODEL.md) | State document, tables and migrations |
| [Testing](docs/TESTING.md) | Strategy, suites and CI |
| [Operations](docs/OPERATIONS.md) | Variables, scheduled jobs, backups and recovery |
| [Architecture decisions](docs/adr/) | Eleven ADRs with the context and alternatives of each decision |
| [AI-assisted development](docs/AI-ASSISTED-DEVELOPMENT.md) | How the project was built with an AI agent |
| [Roadmap](docs/ROADMAP.md) | Status by module and next steps |

## 🤖 Built with AI

The project was developed with **[Claude Code](https://claude.com/claude-code)** (Anthropic) as
its coding agent, under human direction: the author defines the product, makes the decisions and
validates every release in real use; the agent designs, implements, tests and verifies in the
browser and on the server.

The result is a codebase with tests, documented decisions and conventional commits with explicit
co-authorship. The process, quality criteria and lessons learned are in
[docs/AI-ASSISTED-DEVELOPMENT.md](docs/AI-ASSISTED-DEVELOPMENT.md).

## 🗺 Roadmap

Version **3.4.0**, stable. Next steps: savings goals, iCal export of the calendar, splitting the
client into modules and automated UI tests. Details in [docs/ROADMAP.md](docs/ROADMAP.md) and
changes in [CHANGELOG.md](CHANGELOG.md).

## 🤝 Contributing

Feature requests and bug reports are welcome: read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[code of conduct](CODE_OF_CONDUCT.md). Security issues are reported privately as described in
[SECURITY.md](SECURITY.md).

## 📄 License

[MIT](LICENSE).
