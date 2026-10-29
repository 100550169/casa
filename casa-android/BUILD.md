# Building the Android app (quick technical reference)

> If you are not comfortable with a terminal, use **[PLAY-STORE-GUIDE.md](PLAY-STORE-GUIDE.md)**,
> which explains the same steps in detail and assumes no prior knowledge.

## Requirements

| Requirement | Check |
|---|---|
| Node 18+ | `node -v` |
| JDK **17** (Java 8 will not work) | `java -version` |
| Android SDK (bundled with Android Studio) | `ANDROID_HOME` variable set |
| Bubblewrap | `npm i -g @bubblewrap/cli` |
| The app **deployed over HTTPS** | open your address in a browser |

> ⚠️ The `.aab` has **not been generated or tested** yet (the machine these instructions were
> written on had no Android SDK). The steps are the standard Bubblewrap ones.

## 1. Create the signing key (once, forever)

```bash
keytool -genkeypair -v -keystore casa-firma.keystore -alias casa -keyalg RSA -keysize 2048 -validity 10000
```

It will ask for a password and some details. **Store the password in your password manager.**

- If you **lose** this file or its password, **you will never be able to publish updates again**.
- If someone **steals** it, they can sign apps pretending to be you.
- It is listed in `.gitignore`, so it is never pushed to GitHub. Keep a separate backup
  (external drive or password manager).

## 2. Set your address

In `twa-manifest.json`, replace `TU-SERVICIO` with the name of your Render service
(`https://<your-service>.onrender.com`). It appears in five fields: see the comment inside the
file.

## 3. Generate the project and build

```bash
cd casa-android
bubblewrap init --manifest https://<your-service>.onrender.com/manifest.webmanifest
```

```bash
bubblewrap build
```

The output is `app-release-bundle.aab`: that is what you upload to Google Play.

## 4. Domain verification (the step people get stuck on)

The order **matters**, because the fingerprint does not exist until the app has been uploaded:

1. Upload the `.aab` to Play Console.
2. Go to **App integrity → Play app signing** and copy the **SHA-256** fingerprint.
3. On Render: **Environment → Add Environment Variable** → `ANDROID_FINGERPRINT` = that
   fingerprint.
4. Wait for the redeploy and check:

```bash
curl https://<your-service>.onrender.com/.well-known/assetlinks.json
```

It should return JSON containing your fingerprint. If it returns the
`Falta ANDROID_FINGERPRINT` error (*missing ANDROID_FINGERPRINT*), the variable has not been
applied yet.

Without this step the app **opens with the browser bar visible** instead of full screen.

## 5. Later updates

The app wraps the web app, so **app changes go live on their own** when you deploy on Render,
without touching Google Play. A new `.aab` is only needed when you change the icon, the name or
the address. In that case, increase `appVersionCode` in `twa-manifest.json` and repeat step 3.
