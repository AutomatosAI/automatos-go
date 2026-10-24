# Automatos Go

Automatos Go is the Automatos mobile app (iOS first). Studio is where you set
things up; Automatos Go is where you talk to Auto when you are away from the
desk: ask, answer the questions your agents raise, glance at the Command Centre
board, and look at what was made. It is a native app, not a web view, and a
lite companion: the workspace, agents, playbooks and themes are set up in
Studio.

It ships with three styles you can flip between: **Studio** (cream paper or
Studio Dark), **Play** (Ember, with Auto the mascot) and **HUD** (voice first,
square panels, glow and grid). Hosted Studio users sign in with Clerk;
self-hosted users pair their phone with their install by scanning a QR code in
Studio.

The plan is [PRD-001](docs/prd/PRD-001-AUTOMATOS-GO-V1.md). The server side
(pairing, discovery, push, store duties) is automatos-ai
[PRD-266](https://github.com/AutomatosAI/automatos-ai/pull/1257)
(`docs/PRDS/PRD-266-AUTOMATOS-GO-BACKEND.md`).

## Stack

Expo SDK 54 · React Native 0.81.5 · React 19.1 · TypeScript 5.9 (strict) ·
expo-router 6 · `@clerk/expo` ~3.2.16 + expo-secure-store · TanStack Query ·
zod at every boundary · vitest (pure TypeScript, node environment). Node 22
(`.nvmrc`). The build setup is lifted from the Automatos Academy app's
TestFlight tree; releases run on EAS Workflows (see CI and release).

## Commands

```bash
npm ci --ignore-scripts   # install from the committed lockfile
npm run typecheck         # tsc --noEmit
npm run lint              # eslint .
npm test                  # vitest run
npm run test:coverage     # vitest with the coverage gate (src/core, src/api, src/auth)
npm run check:bundle      # expo export --platform ios: compiles the JS bundle, no native build
npm run check:doctor      # expo-doctor
npm run format:check      # prettier --check .
```

## Environment

The app reads these build-time values; Expo inlines them into the bundle. Cloud
builds take them from the EAS environment of the build profile, and there is no
`.env.example` in this repository. `scripts/check-release-env.js` runs before
every EAS build: a production build fails without the required ones, preview
and TestFlight builds warn. An empty value turns the feature off with a "not
configured" state instead of a crash (`src/lib/env.ts`).

| Name                                | What it is                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key for hosted sign-in (`pk_live_` required in production).   |
| `EXPO_PUBLIC_API_URL`               | Base URL of the hosted Automatos API, the built-in server.                      |
| `EXPO_PUBLIC_WEB_URL`               | Base URL of hosted Studio, for links into Studio (a Deliverable, settings).     |
| `EXPO_PUBLIC_SENTRY_DSN`            | Sentry (EU) DSN for error reports; recommended, reporting stays off without it. |

## Recording a real chat turn

The parity corpus (`src/core/__fixtures__/parity/`) tells us when the app's
stream parser and the server disagree. Its `contract` files are built from the
frame catalogue; `recorded` files are real turns, and only
`scripts/record-turn.ts` writes them. It posts one message to `POST /api/chat`
(a new chat in that workspace), keeps the body's chunks as they arrived, waits
for the turn to finish, reads the saved messages back and writes
`recorded-<time>.json`. `npx vitest run` then checks that the parser's answer
and receipts equal the message the server saved.

```bash
AUTOMATOS_API_URL=https://<api host> \
AUTOMATOS_TOKEN=<a Clerk session token> \
AUTOMATOS_WORKSPACE_ID=<workspace uuid> \
  npx tsx scripts/record-turn.ts "What is on my board?" [--out <dir>]
```

The file names the server by its origin only and never holds the token or a
header; the script refuses to write it if the token or the workspace id appears
anywhere in it. This repository is public: record in a workspace whose content
may be published, and read the file before committing it.

## CI and release

CI (`.github/workflows/ci.yml`) runs two jobs on every pull request and every
push to `main`: **typecheck · lint · test** and **expo-doctor · iOS bundle**.
`malware-scan.yml` runs on every push and pull request. GitHub Actions only
checks; nothing there builds or ships.

Releases run on [EAS Workflows](https://docs.expo.dev/eas/workflows/introduction/),
on Expo's servers with the EAS project's own credentials (no GitHub secret, no
`EXPO_TOKEN`). The app is linked to the EAS project in `app.json` (`owner`,
`extra.eas.projectId`, `updates.url`: public identifiers, committed) and uses
`runtimeVersion.policy: fingerprint`, a hash of everything native.

- **Every push to `main`** (`.eas/workflows/testflight.yml`): EAS fingerprints the
  tree and looks for a finished `testflight` build with the same iOS fingerprint.
  Found: the merge is JavaScript only and ships as an over-the-air update on the
  `testflight` channel; TestFlight installs of that build download it on launch
  and run it from the next launch. Not found: the merge changed something native
  (a native dependency, a config plugin, `app.json`), so EAS builds iOS with the
  `testflight` profile, one of the month's iOS builds, and sends the build to
  TestFlight with the commit message as "What to Test". If a build with the same
  fingerprint has already started, the run waits for it and then ships an
  update.
- **Every pull request to `main`** (`.eas/workflows/pr-check.yml`): the same
  fingerprint lookup, then a comment on the PR saying whether merging it ships
  over the air or needs a native build. No build and no update.

Delivery does not wait for GitHub CI: a merge ships at once. Until the checks
below are required on `main` (human step 2), nothing stops a red pull request
from merging and shipping, so merge green pull requests only.

EAS runs two pushes side by side (it can cancel runs, not queue them):

- Two merges close together, the first one native, can start two native
  builds: the second run only waits for a build that has already started.
  After a native merge, merge the next pull request once that run's
  "Build iOS" job is running.
- An update publishes only from `main`'s head. An older run stops just before
  publishing (red, "main is at …") and the newer run ships both changes.

A build counts as found once EAS has built it, whether or not it reached
TestFlight. If the "Send the build to TestFlight" job fails, re-send that build
with `eas submit -p ios --profile testflight --id <build id>` before merging
anything else; otherwise later updates go to a build nobody has. If that job
times out waiting for Apple's processing (30 minutes), the upload still worked
and automatic distribution still delivers it; only "What to Test" is missing.

A commit message containing `[eas skip]`, `[skip eas]` or `[no eas]` skips both
workflows: keep them out of pull request titles, bodies and squash messages.

The first build after the EAS-workflows change is a native build: `app.json`
gained the EAS link, so the fingerprint moved. Builds 5–7 were made without
`updates.url`, so they never receive over-the-air updates; install the newer
build from TestFlight.

## Human steps

These need a person with the accounts; nothing in this repository does them.

1. **EAS environment values.** In the EAS project's `preview` and `production`
   environments: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (a `pk_test_` key for
   preview, the `pk_live_` key for production), `EXPO_PUBLIC_API_URL`,
   `EXPO_PUBLIC_WEB_URL` and, later, `EXPO_PUBLIC_SENTRY_DSN`. TestFlight builds
   and updates read `preview`.
2. **GitHub link.** The Expo GitHub app installed on `AutomatosAI/automatos-go`
   and the repository connected in the EAS project's GitHub settings
   (expo.dev → project → GitHub): `push` and `pull_request` workflows and the PR
   comment need it. Make `typecheck · lint · test`, `expo-doctor · iOS bundle` and
   `scan` (malware-scan) required checks on `main`: delivery does not wait for
   CI, so these are the only gate (admins included, since `enforce_admins` is on).
3. **App Store Connect.** The app record "Automatos Go" (bundle id
   `com.automatos.app`, Apple ID `6825362378`, the `ascAppId` in `eas.json`)
   with the team's App Store Connect users. An App Store Connect API key
   assigned to the app on EAS (`eas credentials --platform ios` → App Store
   Connect: Manage your API Key), so the workflow can upload without a prompt.
   A TestFlight internal group with automatic distribution on: the workflow
   uploads each build and sets "What to Test", and Apple hands it to those
   groups. Signing credentials live on EAS (created at a terminal for the first
   builds). Before an App Store submit, check that every framework the binary
   references has its usage string.
4. **Push security.** Leave Expo's "enhanced push security" off on the EAS
   project: push to self-hosted installs depends on it.
5. **Clerk.** On the production instance: Native API on, the iOS and Android
   apps registered (so Clerk serves the `webcredentials` association), passkeys
   enabled, the `mobile` JWT template, 30-day sessions.

## Licence

Apache License 2.0 — see [LICENSE](LICENSE).
