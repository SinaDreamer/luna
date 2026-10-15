# Luna: shared cycle tracker

A private, Flo-style period, PMS and fertility tracker for two people. She logs; Luna learns her cycle and predicts
periods, PMS days and the fertile window. Her partner sees her current status and predictions on their own device.
One React codebase runs as a **Windows/Mac desktop app** (Electron) and an **iOS app** (Capacitor).

## What it does

- **Today:** a cycle ring, current phase, days until the next period, fertile window with chance of pregnancy, PMS
  forecast with her typical PMS signs, and prediction confidence.
- **Calendar:** logged and predicted periods, fertile days, ovulation and PMS days. Tap a day to log flow, PMS, mood,
  symptoms, LH test, basal temperature, intimacy and a private note.
- **Insights:** learned cycle, period, luteal and PMS lengths; cycle-history chart; back-tested prediction accuracy;
  which PMS signs repeat; full cycle table.
- **Partner view:** a read-only Today, Calendar and Insights, plus support tips for the current phase and how she
  has felt over the last 2 days. **She controls what is shared** (Settings → What your partner can see). Raw logs,
  notes, temperatures, LH tests and intimacy logs never leave her account.
- Reminders, JSON export/import, delete-all, and light and dark themes.

## How the self-calibration works (`src/lib/cycle.js`)

1. **Periods** are detected from flow logs. One-day gaps are bridged, spotting alone doesn't start a period, and
   bleeding less than 15 days after a period start is treated as irregular bleeding.
2. **Every estimate** (cycle length, period length, luteal phase, PMS lead time) is a recency-weighted mean of her
   own cycles (each older cycle counts 15% less), blended with a starting assumption from onboarding. That prior
   counts like 2 cycles at first and fades as data accumulates.
3. **Outliers** (cycles about 2× her median, which is likely a forgotten log, or far outside her normal spread by a
   robust median/MAD test) are shown in history but kept out of predictions. Naturally irregular cycles are not
   dropped.
4. **Ovulation** defaults to 14 days before the next period and is replaced by her real luteal length once she logs
   positive LH tests or a basal-temperature shift (3-over-6 rule).
5. **PMS** timing is learned from the run of PMS-flagged days and PMS-type symptoms or moods before each period.
6. **Accuracy** is back-tested: for every past cycle, Luna checks what it *would* have predicted from earlier data
   only, and shows the average error.

Tests: `npm test` (13 tests, covering the engine and partner-view privacy).

> Predictions are estimates. Luna is not a medical device and not a contraceptive method.

---

## 1. Run it on Windows (works right now)

```bash
npm install
npm run app            # build and open the desktop app
npm run dist:win       # build the installer -> release/Luna Setup 1.0.0.exe
```

Without Firebase configured, Luna runs in **local mode**: everything works on one device, but there is no partner
sharing.

## 2. Turn on sharing (Firebase, free tier, about 5 minutes)

1. Go to <https://console.firebase.google.com> → **Add project** (Analytics can be off).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database**. Pick a region near you (for example `eur3`) and start in
   **production mode**.
4. Firestore → **Rules** tab → replace the contents with [`firestore.rules`](firestore.rules) → **Publish**.
   These rules are what keep her raw logs private, so don't skip this step.
5. **Project settings (gear) → Your apps → Web (`</>`)** → register "Luna" and copy the config values.
6. Copy `.env.example` to `.env` and fill in the values. The web API key is not a secret; access is enforced by the
   rules from step 4.
7. Rebuild: `npm run dist:win` (the config is baked in at build time).

Then:
- **She** creates an account and picks *"I'm tracking my cycle"*. After a short setup, she goes to **Settings →
  Partner sharing → Create invite code**.
- **You** create an account, pick *"I'm the partner"* and enter her code.

## 3. Mac desktop app

On a Mac, with this folder and the same `.env`:

```bash
npm install
npm run dist:mac       # -> release/Luna-1.0.0.dmg
```

The build is unsigned, so the first time you open it, right-click → **Open**. Signing and notarisation need an Apple
Developer account (set `CSC_LINK` and `APPLE_ID` for electron-builder).

## 4. iOS app

The Xcode project is already generated in `ios/` (Capacitor 8, Swift Package Manager, so no CocoaPods). Building
it requires a **Mac with Xcode 16+**:

```bash
npm install
npm run ios:sync       # rebuild web code and copy it into ios/
npm run ios:open       # opens Xcode
```

In Xcode: select the **App** target → *Signing & Capabilities* → choose your Team (your Apple ID works) → change the
bundle ID from `com.luna.cycle` to something unique (for example `com.yourname.luna`) → connect the iPhone → **Run**.

- With a free Apple ID, the app has to be re-installed from Xcode every 7 days.
- With the Apple Developer Program ($99/year), you can use **TestFlight** to install it on both iPhones without a
  cable, and builds last 90 days.

Run `npm run ios:sync` again after every code change.

## Project layout

```
src/lib/cycle.js          prediction engine (pure functions, unit-tested)
src/data/                 local storage backend + Firebase backend (auth, sync, invites)
src/components/           Today, Calendar, DayLogSheet, Insights, Settings, onboarding, auth
electron/main.cjs         desktop shell (serves the app from a secure app:// origin)
ios/                      generated Xcode project (Capacitor)
firestore.rules           security rules: raw logs readable by her only
```

Phase colours (period `#d03a63`, fertile `#2196b8`, PMS `#7a5fd8`, with lighter steps for dark mode) were checked
for colour-vision deficiency. The calendar also uses shape (filled circle, dashed outline, ring, bar), so colour is
never the only signal.
