# API reference

JSON REST API served under `/api`. Every response is `application/json` except
`GET /api/backup`, which is downloaded as a file.

> Error codes, header names and some field names are Spanish identifiers (`X-Casa`,
> `version_desfasada`, `copias`…). They are part of the API contract and are documented here
> exactly as the server returns them.

- [Conventions](#conventions)
- [Access and profiles](#access-and-profiles)
- [Errors](#errors)
- [Health](#health)
- [State](#state)
- [Backups](#backups)
- [Push notifications](#push-notifications)
- [Other routes](#other-routes)
- [Example](#example)

---

## Conventions

| | |
|---|---|
| Base URL | `https://<host>/api` |
| Format | UTF-8 JSON; maximum body size 4 MB |
| Concurrency | Optimistic versioning through the `_version` field of the state |
| Dates | Keys in the household time zone: day `YYYY-MM-DD`, week `YYYY-Www`, month `YYYY-MM` |

## Access and profiles

Two independent headers with different purposes:

| Header | Required | Purpose |
|---|---|---|
| `X-Casa` | only if the server sets `CODIGO_CASA` | **Access**: do you belong to this household? Without it, `401` |
| `X-Perfil` | no (defaults to the parents' profile) | **Product authorization**: which rules apply to the request |

`X-Perfil` takes the `id` of one of the profiles defined in
[`public/perfiles.js`](../public/perfiles.js): three profiles with role `child` and `papas` with
role `parent`.

> `X-Perfil` is not a credential: inside the household anyone can pick any profile. It enforces
> product rules (a child cannot approve their own chores); it does not authenticate. Access
> control is `X-Casa`. See [SECURITY.md](../SECURITY.md).

**Rate limiting:** 30 wrong house codes from one IP within 15 minutes block that IP for the rest
of the window (`429`). Codes are compared in constant time.

## Errors

Single format:

```json
{ "error": "snake_case_code" }
```

| Status | `error` | When |
|---|---|---|
| 400 | `estado_invalido` · `copia_invalida` · `suscripcion_invalida` | Body lacks the minimum shape |
| 400 | `json_invalido` | Malformed JSON |
| 401 | `codigo_casa` | `X-Casa` is missing or wrong |
| 403 | `solo_papas` | Route reserved for the parents' profile |
| 403 | `cambio_no_permitido` | A child attempts a change outside their permissions (includes `detalles`) |
| 404 | `no_encontrado` · `copia_no_encontrada` · `no_suscrito` | Resource does not exist |
| 409 | `version_desfasada` | Another write happened first (includes the current `version`) |
| 409 | `ciclo_desfasado` | The submitted state belongs to a previous week or month |
| 413 | `peticion_invalida` | Body larger than 4 MB |
| 429 | `demasiados_intentos` | House-code rate limit reached |
| 500 | `error_servidor` | Internal error (no details in the response) |

---

## Health

### `GET /api/health`

Public, no headers. Used by the hosting platform as its health check.

```json
{ "ok": true, "db": true, "protegida": false }
```

| Field | Meaning |
|---|---|
| `db` | `DATABASE_URL` is configured |
| `protegida` | The server requires `X-Casa` |

## State

### `GET /api/state`

Returns the whole household document **already up to date**: week and month cycles applied,
shape normalized and streaks recalculated. See [DATA-MODEL.md](DATA-MODEL.md).

```json
{
  "members": [ { "id": "papas", "name": "…", "role": "parent", "color": "#8b6fd6", "load": "normal" } ],
  "fixedTasks": [ … ],
  "extraTasks": [ … ],
  "currentWeek": "2026-W44",
  "currentMonth": "2026-10",
  "_version": 128
}
```

### `PUT /api/state`

Saves the whole document. The client sends back the `_version` it received.

| Response | Body |
|---|---|
| `200` | `{ "ok": true, "version": 129 }` |
| `409` | `{ "error": "version_desfasada", "version": 130 }` → reload and reapply |
| `403` | `{ "error": "cambio_no_permitido", "detalles": [ "…" ] }` |

Rules enforced by the server, in this order:

1. Version check (`_version` = 0 is accepted as an unchecked write, for legacy clients).
2. Full allow-list sanitization: types, lengths, enums and references.
3. Child-profile limits: a child may only tick or submit **their own** chores, request rewards and
   trade in the marketplace. Economy, catalogs, calendar, streaks and history belong to the
   parents.
4. Membership in the current cycle.
5. Normalization, streak recalculation and conditional write.
6. After responding, push notifications to whoever is affected.

### `GET /api/backup` · parents

Downloads the state as `casa-copia-YYYY-MM-DD.json` (`Content-Disposition: attachment`).

### `POST /api/restore` · parents

Replaces the state with the document in the body. **A safety backup of the current state is saved
first.** Responds `{ "ok": true }`.

### `POST /api/reset` · parents

Resets to the sample state. **A safety backup is saved first.** Responds `{ "ok": true }`.

## Backups

### `GET /api/copias` · parents

The 50 most recent backups.

```json
{
  "copias": [
    { "id": 41, "dia": "2026-10-28", "motivo": "diaria", "version": 128,
      "creada": "2026-10-28T06:12:09.114Z", "bytes": 18432 }
  ]
}
```

`motivo` (reason): `diaria` (daily) · `antes_de_reiniciar` (before reset) · `antes_de_restaurar`
(before restore).

### `POST /api/copias/:id/restaurar` · parents

Restores the given backup after saving a safety backup. `404 copia_no_encontrada` if it does not
exist.

## Push notifications

### `GET /api/push/clave`

```json
{ "clave": "<base64url VAPID public key>" }
```

### `POST /api/push/suscribir`

Registers the device to receive notifications for the profile given in `X-Perfil`, in the
language given in `idioma` (`es` or `en`; anything else falls back to `es`). Calling it again
updates the profile and the language.

```json
{ "suscripcion": { "endpoint": "https://web.push.apple.com/…", "keys": { "p256dh": "…", "auth": "…" } }, "idioma": "en" }
```

Only HTTPS endpoints of known push services (Apple, Google, Mozilla, Microsoft) are accepted.
Response: `{ "ok": true, "perfil": "<id>" }`.

### `POST /api/push/baja`

Unsubscribes a device.

```json
{ "endpoint": "https://…" }
```

### `POST /api/push/prueba`

Sends a test notification **only** to the given `endpoint`. `404 no_suscrito` if it is not
registered.

### `GET /api/push/estado` · parents

Number of subscribed devices per profile.

```json
{ "suscripciones": { "papas": 2 } }
```

### `POST /api/push/recordatorios` · parents

Sends the evening reminder. Designed to be triggered by an external scheduler (GitHub Actions).

| Parameter | Effect |
|---|---|
| — | Only acts between 17:00 and 21:30 (household time) and **once a day** |
| `?simular=1` | Returns the notifications it would send, without sending or recording anything |
| `?forzar=1` | Ignores the time window (manual testing) |

| Response | Meaning |
|---|---|
| `{ "ok": true, "dia": "…", "avisos": 3, "entregados": 4 }` | Sent |
| `{ "ok": true, "yaEnviado": true, "dia": "…" }` | Already sent today |
| `{ "ok": true, "fueraDeHora": true, "hora": "22:31", "ventana": "17:00–21:30" }` | Outside the window |
| `{ "simulado": true, "dia": "…", "avisos": [ … ] }` | Dry run |

## Other routes

| Route | Description |
|---|---|
| `GET /demo` | The full app with fictitious data; makes no API requests |
| `GET /.well-known/assetlinks.json` | Digital Asset Links for the Android app (requires `ANDROID_FINGERPRINT`; `503` otherwise) |
| `GET /privacidad.html` | Privacy policy |

## Example

```bash
curl -s https://<host>/api/state \
  -H "X-Casa: XXXX-XXXX-XXXX" \
  -H "X-Perfil: papas"
```
