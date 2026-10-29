# 📱 Casa — Publishing the app on Google Play

This guide takes you from a deployed web app to having Casa installed on your family's phones
**from Google Play**, like any other app, on a **private track**: it does not show up in search
results and only the people you invite by email can install it.

**Actual effort:** about 2–3 hours of work, plus **waiting times** you cannot control (Google's
identity verification can take days).

---

## Read this first

### What this Android app really is

It is not a "native" app with the code inside. It is a **wrapper** (a Trusted Web Activity, TWA)
that opens your web app full screen, without the browser bar, with its own icon on the phone.

That has a **great** consequence: whenever you change the app, it updates itself when you deploy
on Render. **There is no need to go through Google Play every time.**

And an important one: **it still needs the server**. If Render is down or the phone is offline,
the app does not work.

### Do you really need the Play Store?

Be honest with yourself before spending time and money. The web app already supports **"Add to
Home Screen"** on Android and iPhone: it gets an icon, runs full screen and works the same.
**It is free and immediate.**

The Play Store gives you a more familiar installation for children, managed updates, and an app
that does not depend on nobody deleting the shortcut by accident. It costs you **$25**, an
identity verification and this setup time.

It does **not** help on iPhone: Apple does not allow TWAs, so iPhones keep using "Add to Home
Screen".

### Access: the house code

Casa **has no accounts**: no sign-up, no passwords, no email. People get in with the **house
code** (once per device) and by picking one of the four fixed profiles.

⚠️ **Before publishing on Google Play, make sure `CODIGO_CASA` is set on Render.** Without it,
anyone who installed the app from the store would get straight into your household: the server
address ships inside the package. With it, anyone without the code only sees the 🔒 "Esta casa es
privada" (*this household is private*) screen.

Also make sure `DATABASE_URL` is set on Render. Without a database the app cannot save anything.

---

## PART 1 — Preparation (this is where the waiting happens)

1. Go to **https://play.google.com/console** with your Google account.
2. Create a **personal developer account**: it costs a **one-time $25 fee** (not a
   subscription).
3. Google will ask you to **verify your identity** with an ID document. **This can take from a
   few hours to several days.** Nothing speeds it up; continue with Part 2 meanwhile.

> **A detail that surprises many people:** the "12 testers for 14 days" requirement applies to
> moving to **public production**. If you stay on **closed testing**, **it does not apply**. You
> can stay on that track indefinitely.

---

## PART 2 — Install the tools (on your computer)

1. **JDK 17.** Download it from https://adoptium.net ("Temurin 17 (LTS)").
   ⚠️ If you already have Java, check the version: **Java 8 will not work**. Open a terminal and
   run `java -version`.
2. **Android Studio**, from https://developer.android.com/studio. Accept the default options
   during installation: what you need is the **SDK** it ships with.
3. **Bubblewrap**, the tool that builds the app. In a terminal:

```bash
npm install -g @bubblewrap/cli
```

---

## PART 3 — Create your signing key

It is your digital signature: it proves to Google that updates come from you.

In a terminal, inside the `casa-android` folder:

```bash
keytool -genkeypair -v -keystore casa-firma.keystore -alias casa -keyalg RSA -keysize 2048 -validity 10000
```

It will ask you to make up a password and some details (name, city…; anything works).

> 🔴 **The most important part of this guide.**
> - **Store the `casa-firma.keystore` file and its password in your password manager.**
> - If you **lose** them, you will **never** be able to update your app again; you would have to
>   publish a brand-new app.
> - Do not push them to GitHub (they are already excluded in `.gitignore`).
> - When Play Console offers it, **enable "Play App Signing"**: Google keeps a backup of the key
>   for you.

---

## PART 4 — Build the app

Set your address (`https://<your-service>.onrender.com`) in `twa-manifest.json`: replace
`TU-SERVICIO` in the five fields listed in the comment inside the file.

In a terminal, inside the `casa-android` folder:

```bash
bubblewrap init --manifest https://<your-service>.onrender.com/manifest.webmanifest
```

It will ask some questions; almost all of them are pre-filled from `twa-manifest.json`, so you
can accept them with Enter. When it asks for the key, point it to `casa-firma.keystore` and the
alias `casa`.

```bash
bubblewrap build
```

When it finishes you will have **`app-release-bundle.aab`**. That is your app.

---

## PART 5 — Upload it to Google Play

1. In Play Console: **"Create app"**. Name: `Casa`. Default language: Spanish. Type: **App**.
   Free.
2. In the left menu, go to **"Testing" → "Closed testing"** → create a release.
3. Upload `app-release-bundle.aab`.
4. Under **"Testers"**, add your family's **Google account emails**. Only those accounts will be
   able to install it.
5. Google will ask you to fill in a few mandatory forms. Here are the answers:

### Store listing
- **Short description:** "Organize household chores as a family."
- **Icon:** use `public/iconos/icono-512.png` (already generated).
- **Screenshots:** take 2–3 screenshots from a child's phone.
- **Privacy policy:** `https://<your-service>.onrender.com/privacidad.html`
  (already published; **open that file and add your email** where it says `RELLENA-TU-CORREO`).

### "Data safety" form

⚠️ Answer carefully: a false declaration is grounds for removing the app. Casa **collects no
email addresses or passwords**, because it has no accounts: the only personal data are first
names and activity inside the app.

- Does the app collect data? **Yes.**
- **Personal info → Name:** yes. Collected, not shared. Required. Purpose: app functionality.
  They are first names, written in the code itself.
- **Personal info → Email address:** **no**. The app never asks for one.
- **Personal info → Passwords (credentials):** **no**. The app has no passwords.
- **App activity → In-app actions:** yes (ticked chores, points, swaps).
- Encrypted in transit? **Yes** (HTTPS).
- Can users request deletion of their data? **Yes.**
- **Device identifiers:** only when notifications are enabled, the push address generated by
  the browser. Collected, not shared. Optional. Purpose: notifications.
- Shared with third parties? **No.** Notifications travel encrypted through the system's push
  service (Google), which cannot read them; Google Play does not consider that "sharing". There
  are no analytics and no ads.

### Content rating
The standard questionnaire: **no violence, no sexual content, no gambling, no purchases**. It
will be rated suitable for everyone.

### Target audience
Google asks whether the app targets children. Since it is distributed **only to your family on a
closed track**, select your children's actual age range and answer honestly. Because it is not
public, it does not enter the "Teacher Approved / Families" program.

---

## PART 6 — Domain verification (do not skip it)

This is what makes the app open **full screen** instead of with the browser bar. The order
matters, because the data does not exist until you upload the app:

1. In Play Console: **"App integrity"** → **"Play app signing"**.
2. Copy the **SHA-256** fingerprint (a long string of letters and numbers separated by `:`).
3. On **Render** → **Environment** → **Add Environment Variable**:
   - **Key:** `ANDROID_FINGERPRINT`
   - **Value:** the fingerprint you just copied
4. Save and wait for the redeploy.
5. Check it by opening in a browser:
   `https://<your-service>.onrender.com/.well-known/assetlinks.json`

If you see JSON with your fingerprint, it works. If you see an error saying
`Falta ANDROID_FINGERPRINT` (*missing ANDROID_FINGERPRINT*), the variable has not been applied
yet: wait a minute and reload.

---

## PART 7 — Install it on the phones

1. In Play Console, on your closed-testing track, copy the **opt-in link**.
2. Send it to your family (or open it yourself on their phones).
3. They accept being testers and get the **Install from Google Play** button.
4. On first launch, each person enters the house code (if asked) and picks their profile.

---

## Questions you will have

**Do I need to upload the app again every time I change something?**
No. The app opens your web app, so changes arrive on their own when you deploy on Render. You
only go back to Google Play when you change the icon, the name or the address.

**What about iPhone?**
Apple does not support this. iPhones keep using Safari → Share → "Add to Home Screen". With the
work already done (icon and manifest), it looks just as good.

**Does the app show up if someone searches the Play Store?**
No. On closed testing only the people on your email list can see it.

**What would it take to publish it openly one day?**
Complying with Google's **Families policy** (which requires, among other things, verifiable
parental controls and an additional listing review), reviewing **GDPR** compliance with someone
qualified — it involves minors' data — and adding an in-app data-deletion flow, which Google
requires from apps that allow users to sign up.

**The app opens with the browser bar at the top.**
Part 6 is missing, or the fingerprint was copied incorrectly. Check
`/.well-known/assetlinks.json`.

**I lost the key file.**
If you enabled "Play App Signing", contact Google Play support: they can help you reset it. If
you did not, there is no fix: you would have to publish a new app.
