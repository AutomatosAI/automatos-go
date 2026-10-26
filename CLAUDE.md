# CLAUDE.md — Automatos Go

The Automatos mobile app (iOS first): Auto chat, the Command Centre, push and
voice, in three styles (Studio / Play / HUD). Native Expo app, no WebView.
Public, Apache-2.0. Plan: `docs/prd/PRD-001-AUTOMATOS-GO-V1.md`; server side:
automatos-ai PRD-266.

## The rule

CI is the gate. Nothing runs on this machine except pure-Node checks: npm ci --ignore-scripts, npm run typecheck, npm run lint, npx vitest run, npm run check:bundle, npx expo-doctor, npx expo config --type introspect, npm run check:core, npm run check:routes. Never expo start, expo run:*, expo prebuild, eas *, a simulator, an emulator, Metro's dev server or any server; device checks are Gerard's.

## Stack

Expo SDK 54 · React Native 0.81.5 · React 19.1 · TypeScript 5.9 strict ·
expo-router 6 · `@clerk/expo` ~3.2.16 · TanStack Query · zod · vitest (node
environment, no React renderer). Node 22 (`.nvmrc`; Expo SDK 54 needs >= 20.19).
Scaffold lifted from the academy app's TestFlight tree.

## Commands

| Command                                    | What it does                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `npm ci --ignore-scripts`                  | install from the committed lockfile (lifecycle scripts off)                                              |
| `npm run typecheck`                        | `tsc --noEmit`                                                                                           |
| `npm run lint`                             | `eslint .` — the §4.11 guards in `eslint.config.js` (proved by `scripts/__tests__/eslint-rules.test.ts`) |
| `npx vitest run` / `npm run test:coverage` | tests; coverage gate 80/80/80, branches 70 on `src/core/*.ts`, `src/api/**`, `src/auth/**`               |
| `npm run check:bundle`                     | `expo export --platform ios` into `.expo/bundle-check` — compiles the JS bundle, no native build         |
| `npx expo-doctor`                          | Expo's project checks (CI job `expo-doctor · iOS bundle`)                                                |
| `npx expo config --type introspect`        | evaluates every config plugin without writing ios/ or android/                                           |
| `npm run check:core`                       | `src/core/web`, `src/core/frozen` and `src/core/route-manifest.json` match `core.lock.json` / the manifest (no hand edits, no drift) |
| `npm run check:routes`                     | server tables `src/**/routes.ts` (not `src/navigation/`) served at the pin or `pendingUpstream` (K4)     |

Lint guards: `fetch` / `XMLHttpRequest` only in `src/api/**`; `expo/fetch` only in
`src/api/transport.ts`; never `react-native-webview`; files warn over 400 lines and fail over
800; functions 50 lines (`.tsx` 150; test callbacks exempt, as on the web), depth 4,
complexity 10; no colour literals in `src/**` or `app/**` outside `src/styles/tokens/**`;
`src/core/*.ts` and `src/core/parity/**` import no React, React Native or Expo; `console` only
in `src/lib/logger.ts`.

CI (`.github/workflows/ci.yml`): jobs `typecheck · lint · test` and
`expo-doctor · iOS bundle` (names are read by branch protection — do not
rename). `malware-scan.yml` is never edited. GitHub Actions only checks.

Release (EAS Workflows, on Expo's servers with the project's own credentials; no
`EXPO_TOKEN`, no GitHub secret): `.eas/workflows/testflight.yml` on every push to
`main` (OTA update or native build → TestFlight, see the fingerprint trap) and
`.eas/workflows/pr-check.yml` on every PR to `main` (a comment: OTA or native build;
never builds). Both are pinned by `src/config/__tests__/eas-release.test.ts`. Delivery
does not wait for GitHub CI: a merge ships at once. Until `typecheck · lint · test`,
`expo-doctor · iOS bundle` and `scan` are required checks on `main` (a repository setting,
Gerard's), nothing stops a red PR from merging and shipping: merge green PRs only.
Until the repository is linked to the EAS project on expo.dev (no push trigger fires
without it), Claude starts the run after each green merge, from a clean checkout of
`main`: `npx eas-cli workflow:run .eas/workflows/testflight.yml --non-interactive`
(Gerard, 24 Oct: "let's do it ourselves"). Once linked, stop: the push trigger would
run it a second time.

## Release (A7)

- `docs/release/` is the store record: the App Store and Play answers, the review notes, the
  listing, the privacy facts the policy and Terms are edited from, the WebSummit checklist, and
  `README.md`, which maps every store requirement (R01–R23) to its proof and every owner step
  (OT-R1…) to its document. A change that alters what the app collects, asks for or says updates
  the matching file there in the same PR.
- The audits in `src/release/__tests__/` and `scripts/__tests__/release-*.test.ts` are store
  requirements, read from the whole product tree. Never weaken, skip or delete one to make a change
  pass: fix the change, or add an entry to that audit's ALLOWED list with the file, the exact text
  and the reason.
- Before the first submit of every native build, download its IPA and run
  `node scripts/release/scan-ipa.mjs <ipa>` (`docs/release/ipa-scan.md`): it must say PASS
  (ITMS-90683).
- Crash reporting's Sentry options are fixed policy (`src/observability/options.ts`, KR7): EU DSN
  only, the user's switch (on by default), `sendDefaultPii` false, never `setUser` or `Sentry.wrap`,
  no tracing, sessions, screenshots, view hierarchy or replays, scrubbed events and breadcrumbs.
  The store labels say Crash Data not linked and no Performance Data or Product Interaction because
  of them; changing one means changing the labels first.

## Environment

Build-time `EXPO_PUBLIC_*` values from the EAS environment of the build profile
(no `.env.example`: the secrets hook blocks `*.env.*`, so README.md
'Environment' and this list are the record). `scripts/check-release-env.js`
enforces them (production fails, preview/testflight warn); `src/lib/env.ts`
parses them with zod (blank = "not configured").

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key for hosted sign-in; `pk_live_` in production.
- `EXPO_PUBLIC_API_URL` — base URL of the hosted Automatos API (the built-in server).
- `EXPO_PUBLIC_WEB_URL` — base URL of hosted Studio, for links into Studio (a Deliverable, settings); never account creation.
- `EXPO_PUBLIC_SENTRY_DSN` — Sentry (EU) DSN; recommended, error reporting is off without it.

## Layout (PRD-001 §4.3)

```
app/                 expo-router screens (auth, connect, (app)/home, (app)/cc/*, sheets, settings, voice)
src/core/            pure TypeScript vendored from automatos-ai at a pinned SHA (no React, no DOM)
  web/               written ONLY by scripts/sync-core.ts (core.lock.json) — never by hand
  frozen/            files core no longer has (Play's chat, looks, mascot; deleted by PRD-261 W-A8), frozen at their last core SHA with a provenance header; check:core fails on any edit
src/api/             the one API client: bearer + X-Workspace-ID, capabilities, error taxonomy
src/auth/            AuthProvider interface; providers/clerk.ts (device.ts, oidc.ts added later)
src/connect/         discovery, QR pairing, server switching
src/chat/            the chat controller over src/core (turnReducer), streaming
src/cc/              Board, Calendar, Questions, Deliverables data and screens
src/push/            registration, categories, action handler, signature check
src/voice/           quick-ask (STT, TTS), Auto Live (LiveKit), voice screen
src/styles/          tokens, looks, the three layouts, fonts, mascot, the AI label
src/ui/              primitives shared by all three layouts
src/lib/             logger (the only console user), env (zod-parsed EXPO_PUBLIC_*)
src/app-state/       the shell: the signed-in gate (gate.ts decides), the session (useAppSession, useApiClient), the cache roots
src/navigation/      every app route (routes.ts) and web link → app route (web-links.ts); kits link only through them
scripts/             release-env guard, sync-core, check-routes
.eas/workflows/      EAS Workflows: testflight.yml (push to main), pr-check.yml (PRs)
plugins/             local config plugins: pinned background modes, Sentry upload guard (docs/native-modules.md)
```

Code rules (PRD-001 §4.11): HTTP only through `src/api/`; zod at every
boundary, unknown fields ignored; files 200–400 lines (never over 800),
functions < 50 lines, components < 150; pure logic outside React with tests in
`__tests__/` beside the module; immutable updates; no hardcoded URLs/keys
(EAS env or discovery); tokens only, never colour literals; copy in one
`strings.ts` per feature.

## Traps

- **Clerk needs react-dom shims.** `@clerk/expo` imports `react-dom`; `metro.config.js`
  maps `react-dom` and `react-dom/client` to no-op shims in `shims/react-dom/`. Never
  hand-map only Clerk's subpaths: two copies of `@clerk/react` → "ClerkLoaded can only be
  used within <ClerkProvider>".
- **Clerk ships `import.meta`.** `babel.config.js` keeps `unstable_transformImportMeta: true`
  (Hermes has no `import.meta`) and `react-native-worklets/plugin` (Reanimated 4).
- **extraPods.** `expo-build-properties` → `ios.extraPods` GoogleUtilities and RecaptchaInterop
  with `modular_headers: true` — Clerk's native pods fail to link without them. Still needed
  on `@clerk/expo` 3.2.16: its `ios/ClerkGoogleSignIn.podspec` (GoogleSignIn ~> 9.0) autolinks,
  because Expo autolinking takes every podspec in the package's top-level folders. Drop the
  extraPods only when that podspec is gone from the installed Clerk.
- **Clerk 3.2 needs iOS 17.** `@clerk/expo` 3.2.x also autolinks `ios/ClerkExpo.podspec`
  (`platforms :ios => '17.0'`), so `expo-build-properties` sets `ios.deploymentTarget: "17.0"`
  (pod install fails below it), plus `android.packagingOptions.exclude`
  `META-INF/versions/9/OSGI-INF/MANIFEST.MF` for clerk-android's duplicate entry. Clerk's own
  config plugin (`@clerk/expo` in `plugins`) would set both, but it defaults to adding the Sign
  in with Apple entitlement and injects the ClerkKit SPM packages for Clerk's native UI, which
  this app does not use — so it is not wired.
- **ITMS-90683.** App Store Connect bounces a binary that references a privacy framework
  (PHAsset, AVCaptureDevice, …) without its `NS…UsageDescription`, even if the app never
  asks. Every referenced framework gets an honest usage string naming Automatos Go.
- **legacy-peer-deps.** `.npmrc` sets it: the SDK 54 peer graph does not resolve strictly —
  `@clerk/react` 6.x and `@clerk/shared` 4.x (from `@clerk/expo` 3.2) peer react/react-dom
  `~19.1.4`, while React Native 0.81.5's renderer requires react 19.1.0 exactly. The lockfile is generated with it under Node 22
  from a clean state, so it carries every platform's optional binaries (CI is linux-x64).
- **Fingerprint = build quota.** `runtimeVersion.policy: fingerprint`: any native change
  (a native dependency, a config plugin, `app.json`) changes the fingerprint. On a push to
  `main`, `.eas/workflows/testflight.yml` looks for a finished `testflight` build with the
  tree's iOS fingerprint. Found: the merge is JavaScript only and ships as an OTA update on
  channel `testflight`, which TestFlight installs of a build with that fingerprint download on
  launch and run from the next launch. Not found: a native iOS build (from the monthly quota
  shared with the academy app [D43]) that goes to TestFlight automatically. `pr-check.yml`
  says on each PR which of the two its merge will be. Batch native changes per PR. The first
  build after the EAS-workflows PR is native (app.json gained the EAS link, so the fingerprint
  moved); builds 5–7 have no `updates.url` baked in and can never receive an OTA update.
- **Quick merges run side by side.** EAS concurrency can cancel runs but not queue them. A
  run waits only for a same-fingerprint build that has already started, so two merges whose
  lookups both come before the first build exists start two native builds: after a native
  merge, merge the next PR once that run's "Build iOS" job is running. For updates, only
  `main`'s head publishes, checked just before the export: an older run stops in
  `publish_update`'s `before_update` hook (red, "main is at …") and the newer run ships both
  changes.
- **"Found" means an EAS build, not a TestFlight upload.** If `submit_testflight` fails (no App
  Store Connect API key assigned, Apple down), the build still matches its fingerprint and
  every later JS merge updates a binary nobody has. Re-send that build before merging
  anything else: `eas submit -p ios --profile testflight --id <build id>` (Claude or Gerard).
- **The `preview` EAS environment holds only public `EXPO_PUBLIC_*` values.** `pr-check.yml`'s
  fingerprint runs a PR branch's config plugins in it (fork PRs never trigger EAS), so a secret
  added to `preview` would be readable by any branch: secrets go in an environment only `main`'s
  build uses. Delivery does not wait for CI: merge only green PRs (required checks on `main`
  make that automatic).
- **`[eas skip]`, `[skip eas]` or `[no eas]` in a commit message skips EAS Workflows.** Never
  quote one in a PR title, body or squash message (merge with `gh pr merge --squash --subject …
  --body …`): it skips delivery for that merge.
- **expo-doctor vs `@clerk/expo` 3.0.x.** Clerk 3.0.x declares a required peer on
  `expo-modules-core`, and expo-doctor fails either way (with it as a direct dependency:
  "should not be installed directly"; without: "Missing peer dependency"). Clerk >= 3.1.0
  drops the peer, so the app is on 3.2.16 with no direct `expo-modules-core` (it comes with
  `expo`) and expo-doctor passes with no `expo.doctor` exclusion (lead decision, 20 Oct).
  Never add `expo-modules-core` back as a direct dependency.
- **The EAS link is committed.** `app.json` carries `owner` `gerard161`,
  `extra.eas.projectId` and `updates.url` (`https://u.expo.dev/<projectId>`), and `eas.json`
  `submit.testflight.ios` the `ascAppId`: public identifiers (the project id ships inside
  every binary), not secrets (Gerard, 24 Oct). Changing any of them points the app at another
  EAS project, and app.json changes move the fingerprint (a native build).
- **No `.env.example`.** The workspace's secrets hook blocks Claude Code from writing
  `*.env.*` files, so the repo has none (lead decision, 20 Oct): every `EXPO_PUBLIC_*` name is
  listed under Environment above and in README.md. A new name goes in all three places
  (README, this file, `scripts/check-release-env.js`).

## Terms

| Term               | Meaning                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| **Auto**           | The workspace's AI, a proper noun (never "the assistant"). Labelled "Auto is an AI" at the top of every thread. |
| **Playbook**       | A reusable, saved routine (never "Recipe").                                                                     |
| **Mission**        | Orchestrated multi-agent work, broken into tasks on the board (never "Workflow" or "Job").                      |
| **Deliverable**    | Something an agent made — a document, image, file (never "Output" or "Artifact" in copy).                       |
| **Command Centre** | Board, Calendar, Questions and Deliverables (the web's "Command Center").                                       |

## Never

- No WebView (`react-native-webview` is never a dependency, not even transitive). Links to
  Studio open the system browser.
- No sign-up, social sign-in or Sign in with Apple. Nothing about plans, credits or prices.
  Nothing that deletes an account or a workspace.
- No secrets: no Clerk key or token in any file. `EXPO_PUBLIC_*` values come from the EAS
  environment. The EAS link and the Apple team and app ids are public identifiers, committed.
- No committed `ios/` or `android/`; no `expo prebuild`.

## Design sources (read only)

- Studio: `<workspace>/DUMPING AREA/design_handoff_automatos_mobile/` (README is the spec;
  tokens in `_ds/…/tokens/`). Where the handoff and a PRD decision differ, the decision wins.
- Play: `<workspace>/DUMPING AREA/automatos-play-ember/`; HUD:
  `<workspace>/DUMPING AREA/automatos-play-command/`.
- Decisions D1–D63: `<workspace>/reports/mobile-review-2026-10-20/decisions.md`.
