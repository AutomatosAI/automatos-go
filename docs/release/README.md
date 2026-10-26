# Release record: Automatos Go

This folder is the store record for Automatos Go. It covers two releases:

- **Internal TestFlight for WebSummit (10–12 Nov 2026).** The team's phones (Gerard, Dave, Rikki
  and other App Store Connect users) install the build from TestFlight's internal group, so there is
  no Beta App Review [D51]. Android testers install the EAS preview APK by link.
- **App Store and Google Play review, after WebSummit.** No Play Console exists yet [D10]; the Play
  answers here are drafted for when it does.

Wave A7 of PRD-001 (US-021, kit `scripts/ralph/prd-001-release.json`) built this folder. Each store
requirement is proven in one of three ways:

- **A test.** A vitest test that reads the repository (`src/release/__tests__/*.test.ts`,
  `scripts/__tests__/release-*.test.ts`). CI runs it on every pull request, so a later change that
  breaks the requirement fails CI.
- **A gate check.** A line in `scripts/ralph/acceptance-prd001-release.sh` that checks a file or a
  config value.
- **An owner step.** A human step in App Store Connect, Play Console, Sentry, EAS, Clerk or on a
  phone. The document named in the row holds the exact text or values; the OT id is the step in
  "Human steps (OWNER)" below.

How a merge reaches phones (CI, EAS Workflows, over-the-air updates and native builds) is in
[../release.md](../release.md).

## Requirement → where it is proven

A row reads "pending US-021x" until the story that proves it is built.

| Id | Requirement | Source | Proof |
|---|---|---|---|
| R01 | Crash reports leave the phone scrubbed: no chat text, question text, push payloads or call ids | D44; PRD §4.10; US-021 AC2 | pending US-021b, US-021c |
| R02 | No user id on crash events; IP storage off in Sentry | privacy draft §07 and A.1 [CHECK] | pending US-021b; OWNER OT-R1 |
| R03 | A switch to turn crash reports off, so Play may list crash logs as optional | privacy draft A.2 [CHECK] | pending US-021c, US-021d |
| R04 | The privacy policy and Terms are linked in the app at stable URLs | Apple 5.1.1(i); PRD §4.7; US-021 AC1 | pending US-021d; OWNER OT-R3 |
| R05 | App Store privacy labels and Play data safety match what the app does | App Store Connect App Privacy; Play Data safety; privacy draft A.1/A.2 | pending US-021e; OWNER OT-R2, OT-R15 |
| R06 | A privacy manifest (PrivacyInfo.xcprivacy via app.json) matching the labels, with every required-reason API | Apple privacy manifests; Expo SDK 54 guide; critic-store-policy | pending US-021f; OWNER OT-R4 |
| R07 | A usage string for every framework the binary references | ITMS-90683 (academy, 19 Oct); PRD §4.1 | pending US-021g, US-021h; OWNER OT-R4 |
| R08 | Android uses the system photo picker and requests no READ_MEDIA_* permission | Google Play photo and video permissions policy; privacy draft A.3 | pending US-021g; OWNER OT-R5 |
| R09 | Photo location (EXIF GPS) is stripped before upload | privacy draft §07 [CHECK]; critic-security-privacy; built in A2 US-009b | pending US-021i; OWNER OT-R6 |
| R10 | Secure storage is cleared on the first launch after a reinstall, and sign-out clears the phone | privacy draft §07 [CHECK] | pending US-021j; OWNER OT-R7 |
| R11 | No analytics, advertising or tracking SDK; Tracking: No | privacy draft §06 [CHECK], A | Test: [src/release/\_\_tests\_\_/dependency-audit.test.ts](../../src/release/__tests__/dependency-audit.test.ts) (US-021a) |
| R12 | No pointer to account creation and no deletion in the app | D63, D64; Apple 5.1.1(v); Google Play account deletion | pending US-021k |
| R13 | Nothing about plans, credits or prices | D8; Apple 3.1.1, 3.1.3 | pending US-021k |
| R14 | No 'nothing leaves your server' copy | D70; connect KC16 | pending US-021k |
| R15 | The AI label on every way to talk to Auto; Report this on Auto's messages and Deliverables; the consent names every AI provider, Retell included | PRD-264 EUAI-11a; Apple 1.2, 5.1.2(i); Google generative-AI policy; D15, D23, D70, D73 | pending US-021k |
| R16 | One minimum age, 16, everywhere | D12; terms draft §02 | pending US-021k, US-021p; OWNER OT-R13 |
| R17 | Dynamic Type at the largest accessibility size in every style | US-021 AC3; D38 | pending US-021l; OWNER OT-R8 |
| R18 | Universal-link association values; the Android signing fingerprint | PRD-266 §4.9; W3 K14 | pending US-021m; OWNER OT-R9 |
| R19 | A CI check that Expo's enhanced push security stays off | PRD §4.10; D21; foundation OT-5 | pending US-021n; OWNER OT-R10 |
| R20 | Release channels and EAS environments consistent; the internal TestFlight team | D46, D50, D51; PRD §8 (Clerk pk_live_) | pending US-021o; OWNER OT-R11 |
| R21 | Reviewer access: a demo account without MFA in a Business workspace, a long-lived review pairing code, review notes | Apple 2.1, 2.3.1; Play App access; D13 | pending US-021p; OWNER OT-R12 |
| R22 | Store listing, age-rating answers, export compliance | App Store Connect; Play IARC; ITSAppUsesNonExemptEncryption | pending US-021p; OWNER OT-R13 |
| R23 | The WebSummit checklist run on Gerard's phone | US-021 AC4; PRD §10 | pending US-021q; OWNER OT-R14 |

### What R11's test checks

- No `package.json` dependency or devDependency, and no `package-lock.json` entry (nested ones
  included, npm aliases read as the package they really are), matches the denylist in
  `src/release/__tests__/support/denylist.ts`: Firebase, Segment, Amplitude, Mixpanel, PostHog,
  Datadog, Bugsnag, Instabug, New Relic, AppsFlyer, Adjust, Branch, the Facebook SDKs, App Tracking
  Transparency, Google Mobile Ads, AdMob, Application Insights and `react-native-webview`. A failure
  names the package, where it is and why it is denied.
- `@sentry/react-native` is the only crash or error SDK: no other one is declared or installed, and
  every installed `@sentry/*` package comes from its own dependency tree.
- `app.json` has no `NSUserTrackingUsageDescription`, and its privacy manifest says
  `NSPrivacyTracking: false` with no tracking domains.

## Human steps (OWNER)

Steps the build cannot take. Each one is also in the kit's `ownerTest` list and in the A7 pull
request.

| Id | Step | Needed for |
|---|---|---|
| OT-R1 | In Sentry's EU region (de.sentry.io), create the project. Turn on "Prevent storing of IP addresses" and keep the default data scrubber on; note how long events are kept. Put the EU DSN in `EXPO_PUBLIC_SENTRY_DSN` in the EAS preview and production environments (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` only if source maps are wanted). On the phone, open Settings → Privacy & legal → Send a test error report. In Sentry, check the event has no user, no IP address, and every planted test field removed or shown as `[redacted]`. Check the first native crash event the same way. | R01, R02, R03 |
| OT-R2 | In App Store Connect → App Privacy, enter the answers in `app-store-privacy.md`, before the first external TestFlight build or App Review. | R05 |
| OT-R3 | Publish the privacy policy and the Terms at https://automatos.app/privacy and https://automatos.app/terms (the 30 Oct drop, D14), with `privacy-facts.md` applied, a fixed date and one minimum age. Both addresses answer 200, and the company site's footer link is not `#`. | R04, R16 |
| OT-R4 | On the first iOS build after this wave (the privacy manifest is a native change): no ITMS-90683 or ITMS-91053 email from Apple. Download the IPA and run `node scripts/release/scan-ipa.mjs <ipa>`; it says PASS (`ipa-scan.md`). Run the scan again before the first submit of every native build. | R06, R07 |
| OT-R5 | On the next Android preview APK, the app's permissions (Settings → Apps → Automatos Go → Permissions, or `aapt dump permissions`) match `android-permissions.json`, and attaching a photo opens the system photo picker with no permission prompt. | R08 |
| OT-R6 | With Location on for the Camera, take a photo in the app and attach a library photo that has GPS data; send both. Download each stored attachment and run `exiftool -gps:all -a <file>`: no GPS tags. Repeat on Android. | R09 |
| OT-R7 | Delete the app on the iPhone while signed in to hosted Studio and reinstall it from TestFlight: it opens at Welcome, signed out. Repeat while paired to the VPS: it opens at Welcome, not paired. | R10 |
| OT-R8 | Run the matrix in `accessibility-pass.md` on Gerard's iPhone at the largest Larger Text size, with Bold Text and Reduce Motion on, in every style. Attach the screenshots to the A7 pull request. | R17 |
| OT-R9 | Universal links (`universal-links.md`): read the Android signing certificate's SHA-256 from EAS credentials, set `ANDROID_APP_SHA256_CERT_FINGERPRINTS` on the automatos-ai frontend service and redeploy. Check both association files and Apple's CDN copy, then tap a /chat link and a /command-center link on each phone. | R18 |
| OT-R10 | Once `EXPO_TOKEN` exists in the `testflight` GitHub environment, run the "Expo push security" workflow once by hand: it is green, and Expo's enhanced push security is off. | R19 |
| OT-R11 | TestFlight team and environments (`testflight.md`): add Dave and Rikki as App Store Connect users and to the internal group; set the EAS preview and production environment values; decide how the WebSummit build gets the `pk_live_` Clerk key after the 27 Oct cutover (the preview environment carries it, or the testflight profile and its updates move to the production environment). | R20 |
| OT-R12 | Reviewer access, before App Review (after WebSummit): a demo account on the production Clerk instance without MFA, in a Business demo workspace with made-up data (questions waiting, a ticket in Review, a social post awaiting approval, Deliverables, Auto Live ready); a long-lived review pairing code on the VPS (needs backend support: an open question); and the App Store Connect review notes and Play App access filled in from `app-review-notes.md` and `play-app-access.md`. | R21 |
| OT-R13 | Fill in the store listing fields, the age-rating questionnaires (ending at 16+) and export compliance from `store-listing.md`, `age-rating.md` and `export-compliance.md`. Resolve the live Terms' minimum age of 18 against D12's 16. | R16, R22 |
| OT-R14 | Run the WebSummit checklist (`websummit-checklist.md`) on Gerard's phone against hosted Studio and the VPS demo, including the iOS App Privacy Report domain check, and fill in its results table. | R23 |
| OT-R15 | When a Play Console exists (D10), fill in the Data safety form from `play-data-safety.md`, including the "encrypted in transit" answer for plain HTTP on private networks. | R05 |
