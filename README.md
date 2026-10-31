# WaterWise Calculator — Android App (React + TypeScript + Capacitor)

Developed by **Eslam Abubakr** (`#WaterWiseByEslam`)

Water treatment engineering calculator: NaOCl chlorination & SMBS dechlorination, CT verification,
dosing pump sizing/calibration, pool/basin volume & turnover, and offline project storage.
Bilingual Arabic (RTL) / English (LTR).

## 📱 تحميل التطبيق (Get the APK)
Every push builds an installable Android APK automatically via GitHub Actions:

1. Go to the repo's **Actions** tab → **Build Android APK** → open the latest green run.
2. Download the **WaterWise-Calculator-APK** artifact (zip) and extract `WaterWise-Calculator.apk`.
3. Copy to your phone → open it → allow **"Install unknown apps"** → Install.

To publish a permanent download link, push a tag (e.g. `git tag v2.0.0 && git push origin v2.0.0`)
and the APK is attached to a GitHub **Release**.

## 🍎 iPhone / any phone: install as PWA
The app is deployed to GitHub Pages: **https://eslamabubakrnalco.github.io/Tank---Monitor/**

- **iPhone (Safari):** open the link → Share ⬆️ → **Add to Home Screen**.
- **Android (Chrome):** open the link → ⋮ menu → **Install app**.

Works offline after the first open. Updates automatically on every merge to `main`.

## Project layout
| Path | Purpose |
|---|---|
| `src/App.tsx` | UI (tabs: Dosing, Pump, Pool, Saved projects) |
| `src/core/engine/` | Deterministic calculation engine (`dosing.ts`, `pump.ts`, `pool.ts`) + tests |
| `src/core/auth/` | 3-day password rotation |
| `src/core/storage/` | Offline project storage |
| `src/services/ai/` | Optional AI advisor (offline fallback) |
| `android/` | Native Android project (Capacitor) |
| `.github/workflows/android-apk.yml` | CI that builds the APK |

## Local development
```bash
npm install
npm run dev        # web dev server
npm test           # engine unit tests
npm run build      # production web build (also an installable PWA)
```

## Build the APK on your own PC (optional)
Requires Android Studio (JDK 17 + Android SDK).
```bash
npm run build
npx cap sync android
npx cap open android      # then Build → Build APK(s)
# or headless:
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

## Google Play release (later)
Play Store needs a **signed release AAB**: create a keystore in Android Studio
(Build → Generate Signed Bundle), keep the `.jks` file safe and **never commit it**.

## iOS
`npx cap add ios && npx cap open ios` — requires a Mac with Xcode and an Apple Developer account.
