# Google Play package

This folder contains everything needed to publish **Casa** on Google Play as an Android app
(Trusted Web Activity), on a **private** closed-testing track.

## Where to start

- **[PLAY-STORE-GUIDE.md](PLAY-STORE-GUIDE.md)** — the complete step-by-step guide, without
  jargon. Start here.
- **[BUILD.md](BUILD.md)** — just the commands, if you are comfortable with a terminal.

## Status

| | |
|---|---|
| Address | `https://<your-service>.onrender.com` (set it in `twa-manifest.json`, where it says `TU-SERVICIO`) |
| PWA on the server | done: `public/manifest.webmanifest`, `public/sw.js`, `public/iconos/` |
| Verification route | done: `/.well-known/assetlinks.json` in `server.js` |
| Privacy policy | done: `public/privacidad.html` — **add your email address** |
| `.aab` file | **not generated**: requires JDK 17 + Android SDK |
| Signing fingerprint | **pending**: Google Play provides it after the first upload (`ANDROID_FINGERPRINT` variable) |

## Before publishing

1. Open `public/privacidad.html` and replace `RELLENA-TU-CORREO@ejemplo.com` with your email
   address.
2. Deploy on Render.
3. Follow the guide.

## Reminder

The Android app is a **wrapper** around the web app: your changes go live when you deploy on
Render, **without going through Google Play again**. A new `.aab` is only needed when you change
the icon, the name or the address.
