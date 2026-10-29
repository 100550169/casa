# ADR-0011 · Runtime UI translation with a shared phrase catalog

**Status:** accepted

## Context

The app was written in Spanish for a Spanish-speaking household. Publishing it meant offering
English as well, chosen per device. The interface is a single, framework-free `index.html`
([ADR-0008](0008-framework-free-client.md)) with around 400 user-facing phrases embedded in
template literals across ~2,700 lines. Push notifications are composed on the server, also in
Spanish.

## Decision

- **Spanish stays the source language.** The code keeps its Spanish strings; nothing is rewritten.
- **One catalog** in `public/i18n.js`, a UMD module loaded by both the browser and the server
  (the same pattern as `public/perfiles.js`):
  - exact phrases: the **whole text of a DOM node**, with inner whitespace collapsed, mapped to
    its translation;
  - patterns with placeholders (`"Hola, {1}"` → `"Hi, {1}"`) for phrases that embed names or
    numbers. Placeholder values are copied as is, unless they are themselves an exact catalog
    phrase (day names, reward types).
- **In the browser**, `traducirDom()` translates text nodes and the `placeholder`, `title`,
  `aria-label` and `alt` attributes of whatever the app renders, and a `MutationObserver`
  applies it to every later render, modal, sheet and dialog (`alert`/`confirm`/`prompt` are
  wrapped). Elements marked `translate="no"` are skipped.
- **Only whole-node matches are translated**, so household data (chore names, notes) is never
  translated by accident. Single letters are never in the catalog: weekday initials come from
  `diasCortos()` so they cannot collide with avatar initials.
- **Language is a device preference**, stored in `localStorage` (never in the shared state) and
  defaulting to the browser language. Changing it reloads the page.
- **On the server**, each push subscription stores its language (migration 010) and
  `push.enviar()` translates every notification with `traducirAviso()` before delivery.
- **The demo** ships English sample data, because household data is not part of the UI catalog.

## Alternatives

- **Translation keys everywhere** (`t("menu.title")`): the conventional approach, but it means
  touching hundreds of template fragments in a file with no component boundaries and no type
  checking, with a high risk of regressions for no product benefit today.
- **An i18n library (i18next, FormatJS)**: adds dependencies and still requires the same
  rewrite of every string.
- **Two copies of the UI**: unmaintainable.

## Consequences

- ✅ Zero changes to the rendering code; Spanish behavior is byte-for-byte the same.
- ✅ One catalog shared by the client and the push notifications.
- ✅ Covered by `test/i18n.test.js`, including a check that every notification produced by
  `services/avisos.js` has a translation.
- ⚠️ A phrase that is not in the catalog stays in Spanish: new UI text must be added to the
  catalog (see [CONTRIBUTING](../../CONTRIBUTING.md#adding-ui-text)).
- ⚠️ Sentences split by inline tags (`<b>`) are translated fragment by fragment, which limits
  word order in a few places.
- ⚠️ **Planned evolution:** when the client is split into ES modules, move to explicit keys
  module by module; the catalog already holds every translation.
