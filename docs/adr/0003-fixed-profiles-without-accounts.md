# ADR-0003 · Fixed profiles instead of user accounts

**Status:** accepted · supersedes the accounts, families and email-invitation model (v1–v2)

## Context

The first version had sign-up, passwords, email verification, families and invitations. For a
single household all of that added friction (a child does not remember passwords), dependencies
(email provider, tokens) and attack surface, while providing nothing: the members of the
household do not change.

## Decision

- Four **fixed profiles** defined in `public/perfiles.js`, a UMD module loaded by both the server
  and the browser: a single definition, so the two can never diverge.
- **Short, stable** ids, referenced throughout the document.
- Picking a profile **is not authentication**. Access control is a separate concern
  ([ADR-0010](0010-optional-house-code.md)); profiles only determine which product rules apply,
  and the server enforces them (`applyChildLimits`, `soloPapas`).
- Migration: `adoptarPerfiles()` translates the old UUIDs into profile ids.

## Alternatives

- **Keep accounts**: complexity with no benefit for a single home.
- **A PIN per profile**: friction for children; the rules that matter already live on the server.

## Consequences

- ✅ Authentication, email, sessions and tokens were removed.
- ✅ Getting into the app takes one tap.
- ⚠️ Inside the household anyone can use any profile. This is accepted: it is a household issue,
  not a technical one.
- ⚠️ Changing a profile id requires migrating the document.
