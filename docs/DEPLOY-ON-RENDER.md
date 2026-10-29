# Deploy Casa on Render, step by step

> [!IMPORTANT]
> **Casa needs a server.** It is not a static site: the API stores the household's state,
> enforces each profile's rules, decides week and month rollovers with its own clock and sends
> push notifications. That is why it does not work on GitHub Pages or by opening `index.html` in
> a browser. This guide runs it on **[Render](https://render.com)** (web server) with the
> database on **[Neon](https://neon.tech)** (PostgreSQL). Both have a free plan.

| | |
|---|---|
| Time | 15–20 minutes |
| Cost | €0/month |
| You need | GitHub, Render and Neon accounts (the last two can be created with your GitHub account) |
| Result | `https://<your-service>.onrender.com` over HTTPS, installable on phones |

```mermaid
flowchart LR
  A[1 · Your copy<br/>on GitHub] --> B[2 · Database<br/>on Neon]
  B --> C[3 · House<br/>code]
  C --> D[4 · Service<br/>on Render]
  D --> E[5 · Verify]
  E --> F[6 · Install on<br/>phones]
  F -.-> G[7 · Scheduled jobs<br/>optional]
```

- [Before you start: try it locally](#before-you-start-try-it-locally)
- [1. Create your copy of the repository](#1-create-your-copy-of-the-repository)
- [2. Create the database on Neon](#2-create-the-database-on-neon)
- [3. Choose the house code](#3-choose-the-house-code)
- [4. Create the service on Render](#4-create-the-service-on-render)
- [5. Verify that it works](#5-verify-that-it-works)
- [6. Install it on the phones](#6-install-it-on-the-phones)
- [7. Optional: daily reminder and nightly backup](#7-optional-daily-reminder-and-nightly-backup)
- [Updating](#updating)
- [Free-plan limits](#free-plan-limits)
- [Troubleshooting](#troubleshooting)

---

## Before you start: try it locally

You do not need a database to see the whole app with sample data:

```bash
git clone https://github.com/100550169/casa.git
cd casa
npm install
npm start
```

Open `http://localhost:3000/demo`. It is the full app with a fake server running in the browser:
nothing is saved and no API request is made.

## 1. Create your copy of the repository

1. On the repository page, click **Use this template → Create a new repository**.
2. Give it a name (for example `casa`) and choose its visibility:
   - **Private** if you plan to use the nightly backup from
     [step 7](#7-optional-daily-reminder-and-nightly-backup) (it stores your household's data in
     the repository itself).
   - **Public** if you only want the server. The data lives in the database, not on GitHub.
3. **Customize the profiles** before first use. In your copy, open
   [`public/perfiles.js`](../public/perfiles.js) → pencil icon → change each child's `name`,
   `emoji` and `color` → **Commit changes**.

```js
const HIJOS = [
  { id: "mateo", name: "Mateo", role: "child", color: "#2f9fd0", emoji: "🦊" },
  { id: "pablo", name: "Pablo", role: "child", color: "#2fae73", emoji: "🐢" },
  { id: "sara",  name: "Sara",  role: "child", color: "#e0588f", emoji: "🦋" },
];
```

> [!NOTE]
> The `id` values are internal and never shown on screen: you can leave them as they are. If you
> change them, do it **before** you start using the app (history is stored against them) and
> update `test/perfiles.test.js`.

## 2. Create the database on Neon

Render also offers free PostgreSQL, but it **expires after 30 days**. Neon does not, and a
household's state takes only a few kilobytes.

1. Sign in to [console.neon.tech](https://console.neon.tech) with your GitHub account.
2. **New project** → name `casa` → region **AWS Europe Central 1 (Frankfurt)**, the same region
   as the Render service in step 4, so they talk to each other quickly.
3. On the project dashboard click **Connect**, keep **Connection pooling** enabled and copy the
   connection string. It looks like this:

   ```text
   postgresql://user:password@ep-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

Keep it: it is the `DATABASE_URL` variable. There is no need to create tables: the server runs
its migrations at startup.

## 3. Choose the house code

Once deployed, the app is on the Internet. The **house code** (`CODIGO_CASA`) is the key: without
it, the API does not answer. Each phone receives it once and remembers it.

- Generate a random one on your computer: `npm run codigo` → e.g. `K7QM-2XRT-9WPB`.
- Or use any passphrase of 12 characters or more.

> [!WARNING]
> If you leave `CODIGO_CASA` empty, **anyone who knows the address can see and change your
> household's data**. Leave it empty only for testing.

## 4. Create the service on Render

The repository includes [`render.yaml`](../render.yaml), a *Blueprint* that describes the
service: Node, free plan, Frankfurt region, `npm ci`, `npm start`, a health check on
`/api/health` and a deployment on every push. There is nothing to configure by hand.

### Option A — Blueprint (recommended)

1. Sign in to [dashboard.render.com](https://dashboard.render.com) with your GitHub account.
2. **New → Blueprint**.
3. **Connect a repository** → choose **your copy** from step 1. If it is not listed, click
   *Configure GitHub* and grant access to that repository.
4. Render reads `render.yaml` and shows the `casa` service. Fill in the two variables it asks
   for:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | The Neon connection string from step 2 |
   | `CODIGO_CASA` | The code from step 3 |

5. **Apply** (or **Deploy Blueprint**). The first build takes 2–3 minutes.

> [!TIP]
> The **Deploy to Render** button in the README does the same but deploys **this** repository,
> not your copy: it is handy for a quick trial, but it will not pick up your changes to
> `perfiles.js`.

### Option B — Manual Web Service

If you prefer not to use the Blueprint: **New → Web Service** → your repository, and:

| Field | Value |
|---|---|
| Name | `casa` (it becomes part of the address) |
| Region | Frankfurt (EU Central) |
| Branch | `main` |
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Instance Type | Free |
| Environment Variables | `DATABASE_URL`, `CODIGO_CASA`, `NODE_ENV=production`, `TZ_FAMILIA=Europe/Madrid` |
| Health Check Path | `/api/health` (under *Advanced*) |

The Node version is pinned by [`.nvmrc`](../.nvmrc) (22). Render assigns the port through the
`PORT` variable: there is nothing to configure.

### Environment variables

| Variable | Required | What it is |
|---|:-:|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `CODIGO_CASA` | strongly recommended | The household's access code |
| `TZ_FAMILIA` | no | Time zone that decides when the day, week and month change (`Europe/Madrid`) |
| `NODE_ENV` | no | `production` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | no | Notification keys; generated and stored in the database when missing |
| `VAPID_SUBJECT` | no | Contact declared to Apple and Google; defaults to the service address |
| `ANDROID_FINGERPRINT`, `ANDROID_PACKAGE` | no | Only when publishing the app on Google Play |

## 5. Verify that it works

1. In Render → your service → **Logs**, wait for `Casa escuchando en :10000` (*Casa listening on
   :10000*).
2. Open `https://<your-service>.onrender.com/api/health`. It should answer:

   ```json
   { "ok": true, "db": true, "protegida": true }
   ```

   - `db: false` → `DATABASE_URL` is missing or was copied incorrectly.
   - `protegida: false` (*protected: false*) → there is no `CODIGO_CASA`.
3. Open `https://<your-service>.onrender.com`, type the code and pick the **Papás** (parents)
   profile.

> [!NOTE]
> On the free plan, the server sleeps after 15 minutes without visits. The first load after that
> can take about a minute; the following ones are instant.

## 6. Install it on the phones

1. On the computer, parents' dashboard → **Economía → Acceso → Copiar enlace** (*economy →
   access → copy link*). It is the address with the code embedded
   (`https://<your-service>.onrender.com/#casa=…`). The `#casa=` fragment never reaches the
   server or its logs.
2. Send it once to each phone (messaging app, AirDrop…) and open it.
3. Install the app:
   - **Android (Chrome):** menu **⋮ → Install app**.
   - **iPhone (Safari):** **Share → Add to Home Screen**. On iPhone, notifications only work when
     the app is installed this way.
4. Everyone picks their profile and enables notifications (**Cambiar → Avisos en este móvil**,
   *switch → notifications on this phone*).

Full guide for the family in the [user guide](USER-GUIDE.md).

## 7. Optional: daily reminder and nightly backup

Render's free plan cannot wake itself up at a given time, so two jobs are triggered by GitHub
Actions from your copy. They stay **disabled** until you configure the address:

1. Your repository → **Settings → Secrets and variables → Actions**.
2. **Variables** tab → **New repository variable**: `CASA_URL` =
   `https://<your-service>.onrender.com` (no trailing slash).
3. **Secrets** tab → **New repository secret**: `CODIGO_CASA` = the same code as on Render.
4. Try them from **Actions → Run workflow**.

| Workflow | What it does | Requirement |
|---|---|---|
| `evening-reminder.yml` | Between 17:00 and 21:30, tells each child what is pending and tells the parents what awaits approval | `CASA_URL` |
| `nightly-backup.yml` | Stores the state every night in the `backups` branch | `CASA_URL` and a **private repository** |

> [!CAUTION]
> The nightly backup contains your household's real data. If the repository is public, the
> workflow **refuses to run**. The server also keeps a daily backup in the database, which can
> be restored from the dashboard (Economía → Copias de seguridad, *backups*).

## Updating

- **Your own changes:** every push to `main` on your copy deploys automatically
  (`autoDeployTrigger: commit`).
- **Improvements from this repository:**

  ```bash
  git remote add upstream https://github.com/100550169/casa.git
  git fetch upstream
  git merge upstream/main
  git push
  ```

Database migrations are idempotent and run at startup.

## Free-plan limits

| Limit | Effect on Casa |
|---|---|
| The service sleeps after 15 min without traffic | First load takes ~1 min; week and month cycles are still applied on the next read |
| 750 instance hours per month per workspace | Enough for one service running all month |
| No persistent disk | No impact: everything lives in PostgreSQL |
| Render PostgreSQL expires after 30 days | That is why this guide uses Neon |

Up-to-date details in the [Render documentation](https://render.com/docs/free).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| The build fails at `npm ci` | `package-lock.json` out of sync | Locally: `npm install`, commit the lock file and push |
| `/api/health` answers `"db": false` | `DATABASE_URL` empty or incomplete | Render → Environment → paste the Neon string again → *Save, rebuild and deploy* |
| Logs say `password authentication failed` | Neon password rotated or copied incorrectly | Copy the string again from Neon → Connect |
| The app rejects the code | It does not match `CODIGO_CASA` | Check the variable on Render; after 30 failed attempts in 15 min that connection is blocked for a while (`429`) |
| It takes long to open | The service was asleep | Expected on the free plan; wait a minute |
| No notifications on iPhone | The app is opened from Safari, not installed | Install it with *Add to Home Screen* and enable notifications from there |
| The backup workflow fails with "public repository" | Data protection | Make the repository private, or delete the `CASA_URL` variable if you do not want the backup |
| A workflow fails with `401` | The `CODIGO_CASA` secret is missing on GitHub or does not match | Set it to the same value as on Render |

Another problem? Open an [issue](https://github.com/100550169/casa/issues/new/choose) without
personal data.
