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
(`.nvmrc`). The build and release setup is lifted from the Automatos Academy
app's TestFlight tree.

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
| `EXPO_PUBLIC_WEB_URL`               | Base URL of hosted Studio, opened by "Create an account in Studio".             |
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
`malware-scan.yml` runs on every push and pull request.

Releases: `.github/workflows/testflight.yml` runs after CI succeeds on `main`.
It compares the tree's fingerprint with the last finished TestFlight build and
either ships an over-the-air update (JavaScript-only change) or starts a native
build and submits it. It waits while a TestFlight build is already in progress,
so two quick merges never start two native builds.

## Human steps

These need a person with the accounts; nothing in this repository does them.

1. **Link the EAS project.** Run `eas init` under the Expo account and commit
   `owner`, `extra.eas.projectId` and `updates.url` to `app.json` in one PR.
   Create the EAS environments' values: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
   (a `pk_test_` key for preview, the `pk_live_` key for production),
   `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL` and, later,
   `EXPO_PUBLIC_SENTRY_DSN`. Until the project is linked, the TestFlight
   workflow stops with "run eas init".
2. **App Store Connect.** Create the app record "Automatos Go" (bundle id
   `com.automatos.app`) under the team, add the team's App Store Connect users,
   and put `ascAppId` (and `appleId` if wanted) into `eas.json` under `submit`.
3. **First iOS builds.** Make the first development and TestFlight builds at a
   terminal, because EAS creates the signing credentials interactively. Before
   the first submit, check that every framework the binary references has its
   usage string.
4. **GitHub settings.** Add `EXPO_TOKEN` as a secret of the `testflight`
   environment and restrict that environment to `main`. After the first CI run,
   make `typecheck · lint · test`, `expo-doctor · iOS bundle` and `scan`
   (malware-scan) required checks on `main`.
5. **Push security.** Leave Expo's "enhanced push security" off on the EAS
   project: push to self-hosted installs depends on it.
6. **Clerk.** On the production instance: Native API on, the iOS and Android
   apps registered (so Clerk serves the `webcredentials` association), passkeys
   enabled, the `mobile` JWT template, 30-day sessions.

## Licence

Apache License 2.0 — see [LICENSE](LICENSE).
