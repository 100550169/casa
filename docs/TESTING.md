# Testing strategy

| Level | Tool | Count | What it covers | When it runs |
|---|---|---:|---|---|
| Domain logic | `node:test` | 160 | Pure business rules, no database or network | `npm test`, CI |
| End-to-end API | `test/http/api.js` | 45 | Full HTTP layer against a real PostgreSQL | `npm run test:http`, CI |
| User interface | Browser (assisted manual pass) | — | Every screen in `/demo` at 375 px and on desktop, console free of errors | before every release |
| Production | Read-only checks | — | Stable version across reads, health, no writes caused by reads | after every deployment |

No test dependencies: the native Node.js test runner is used.

## Logic tests

```bash
npm test
```

| Suite | Tests | Verified behavior |
|---|---:|---|
| `dinero.test.js` | 20 | 75 % / 100 % thresholds, point value, availability-weighted assignment, redemptions |
| `avisos.test.js` | 18 | Who receives each notification, never the author, grouping, daily reminder |
| `calendario.test.js` | 18 | Schedule and plan sanitization, free minutes, deterministic planner, conflicts, permissions |
| `permisos.test.js` | 16 | Child-profile limits: what a child can and cannot change |
| `rachas.test.js` | 14 | Complete days, carry-over between weeks, streak computed only on the server |
| `perfiles.test.js` | 12 | Fixed profiles and translation of ids from the accounts version |
| `mercado.test.js` | 10 | Offers, swaps, seller acceptance, bonus settlement |
| `codigo-casa.test.js` | 8 | Access code, normalization, rate limiting with a fake clock |
| `menus.test.js` | 8 | Dish and menu normalization (including the `[object Object]` case) |
| `cierre-mes.test.js` | 7 | Late chores, history archive, monthly reset |
| `concurrencia.test.js` | 6 | Optimistic versioning and the client's per-field merge |
| `ciclos.test.js` | 5 | Week and month rollover driven by the server clock |
| `copias.test.js` | 5 | Single daily backup, retention, restore |
| `i18n.test.js` | 13 | Translation catalog: whole-node matching, patterns, days and months, notifications in every language |

### Testing client code

Client logic lives in `public/index.html`. `test/_cliente.js` extracts its functions and evaluates
them in an isolated context, so the calendar planner, conflict merging and the monthly
assignment are tested exactly like server code, without a browser.

## API tests

```bash
docker run -d --name casa-pg -e POSTGRES_PASSWORD=prueba -e POSTGRES_DB=casa -p 55432:5432 postgres:16-alpine
DATABASE_URL=postgres://postgres:prueba@localhost:55432/casa?sslmode=disable CODIGO_CASA=PRUE-BA12-3456 npm start
npm run test:http   # in another terminal
```

Covers: public health check, rejection without a code (`401`), rate limiting (`429`), versioned
reads and writes (`409`), child limits (`403`), parents-only routes, malformed JSON (`400`),
oversized bodies (`413`), reset and restore with a prior backup, backup restore, reminder
(dry run, time window, once a day), push subscriptions and `/demo`.

It writes and resets the state, so **it refuses to run against the production deployment**.

> This suite caught that the upgrade to Express 5 broke `/demo`, something the logic tests could
> not see. It has run in CI on every change since.

## Continuous integration

`.github/workflows/tests.yml`, on every push to `main` and every pull request (Dependabot's
included):

| Job | Steps |
|---|---|
| `logic` | `npm ci` → `npm test` → `npm audit --audit-level=high` |
| `api` | `postgres:16-alpine` service → start the server → wait for `/api/health` → `npm run test:http` |

`npm audit` fails the build on any high or critical vulnerability, even when nobody touched the
code.

## Browser verification

Before every release with visible changes:

1. `/demo` locally (no database needed).
2. Walk through every parent and child screen at 375 px and on desktop.
3. No `undefined`, `NaN` or `[object Object]` on screen; console free of errors.
4. Zero requests to `/api/` in demo mode.
5. Repeat in English: no Spanish phrase left on screen (the catalog covers every UI text).

## Production verification

After deploying, read-only:

- `GET /api/health` answers `ok`.
- Three consecutive `GET /api/state` calls return the **same version** (reads never write).
- New fields appear with their default shape.

## Adding tests

- A new domain rule comes with its test in the matching suite.
- A bug fix comes with a test that reproduces the bug.
- A new route is added to `test/http/api.js`.
