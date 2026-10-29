# Contributing

Thanks for helping to improve Casa. By taking part you agree to the
[code of conduct](CODE_OF_CONDUCT.md).

- **Found a bug?** Open an issue with the *Bug report* template, ideally reproducible in `/demo`.
- **Have an idea?** Use the *Feature request* template. Check the [roadmap](docs/ROADMAP.md) first.
- **Found a security issue?** Report it privately: see [SECURITY.md](SECURITY.md).

## Development environment

```bash
npm install
cp .env.example .env
npm test
npm start
```

The API suite needs an empty PostgreSQL database; see [docs/TESTING.md](docs/TESTING.md).

## Workflow

1. Branch off `main`: `feat/…`, `fix/…`, `docs/…`.
2. Small changes, with tests.
3. `npm test` green (and `npm run test:http` if you touch routes).
4. Open a pull request using the template. CI must pass before merging; in every installation,
   `main` deploys automatically to Render.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), in the imperative mood:

```
feat: weekly chore calendar based on each child's schedule
fix: send the reminder only inside the evening window
docs: API reference
deps: Express 5
```

Use `feat!:` or a `BREAKING CHANGE:` footer for incompatible changes. When a commit was written
with the help of an AI agent, say so with a `Co-Authored-By:` footer.

## Code style

- **Language.** The interface is in Spanish, and so are the identifiers and code comments
  (`leerEstadoAlDia`, `planificarSemana`…). Keep new code consistent with its surroundings;
  documentation, issues and pull requests are in English.
- Comments explain **why**, not what.
- Business logic lives in `services/` as pure functions; routes only orchestrate.
- No new dependencies without a clear need: there are four today.

## Adding a field to the state

This is the most delicate kind of change. Follow these steps in order:

1. Initial value in `estadoVacio()` (`services/estadoService.js`).
2. Sanitization in `sanitizeState()` (`services/stateGuard.js`). **Anything that is not
   sanitized is lost on save.**
3. If it belongs to the parents, add it to `SOLO_PADRES` in `applyChildLimits()`.
4. For existing states, normalize **on the server** and persist the result; never only on the
   client ([ADR-0004](docs/adr/0004-server-side-normalization.md)).
5. Compare with `huella()`, not with `JSON.stringify`.
6. Sample data in `public/demo.js`.
7. Tests in `test/`.
8. Document it in [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

## Adding a route

- Under `/api` it is protected by the house code automatically.
- If it is parents-only: `soloPapas` middleware.
- If the demo uses it: a simulated response in `public/demo.js`.
- A case in `test/http/api.js` and an entry in [docs/API.md](docs/API.md).

## Architecture decisions

A change that affects the structure (persistence, synchronization, security, dependencies) comes
with an ADR in [docs/adr](docs/adr/).

## Personal data

Do not include real names, deployment addresses, house codes or state backups in the repository,
issues or pull requests. If you keep private notes, use `privado/`, which git ignores. Sample data
uses fictitious names (Mateo, Pablo and Sara).
