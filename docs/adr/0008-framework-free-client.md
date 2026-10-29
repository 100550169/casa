# ADR-0008 · Framework-free client and minimal dependencies

**Status:** accepted · to be revisited

## Context

The client started as a single-file prototype. The project is maintained by one person with the
help of an agent, deploys without a build step and must work as a PWA on modest phones.

## Decision

- Client in HTML, CSS (with design tokens) and JavaScript, with no framework and no bundler.
- Server with four production dependencies: `express`, `pg`, `dotenv`, `web-push`. No
  development dependencies: tests use `node:test`.

## Consequences

- ✅ No build step; deployments are immediate.
- ✅ Minimal, auditable dependency surface.
- ✅ The client script is tested as is from Node (`test/_cliente.js`).
- ⚠️ `index.html` is around 2,700 lines long. **Planned revision:** split it into ES modules,
  without needing to adopt a framework.
