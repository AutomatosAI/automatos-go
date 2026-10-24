# Release: CI, EAS Workflows, updates and builds

How a merge to `main` reaches phones. **On `main`** since #10 and #11 (24 Oct 2026).

Two systems, two jobs:

| System | Files | What it does |
|---|---|---|
| GitHub Actions | [.github/workflows/ci.yml](../.github/workflows/ci.yml), `malware-scan.yml` | Checks. It never builds or ships. |
| EAS Workflows, on Expo's servers | [.eas/workflows/testflight.yml](../.eas/workflows/testflight.yml), [.eas/workflows/pr-check.yml](../.eas/workflows/pr-check.yml) | Ships: an over-the-air update, or a native build sent to TestFlight. |

EAS Workflows run with the EAS project's own credentials. There is no `EXPO_TOKEN` and no GitHub
secret. Both workflow files are pinned by
[src/config/__tests__/eas-release.test.ts](../src/config/__tests__/eas-release.test.ts).

## GitHub CI

On every pull request and every push to `main`:

| Job name | Steps |
|---|---|
| `typecheck · lint · test` | `npm ci --ignore-scripts`, `npm run typecheck`, `npm run lint`, `npm run test:coverage`, `npm run check:core`, `npm run check:routes` |
| `expo-doctor · iOS bundle` | `npm ci --ignore-scripts`, `npx --yes expo-doctor`, `npm run check:bundle` (`expo export` of the iOS bundle; no native build) |
| `scan` (`malware-scan.yml`) | The malware scan, on every push and pull request. Never edited. |

Branch protection reads the job names: do not rename them.

**Delivery does not wait for CI.** A merge ships at once. Until these three are required checks on
`main` (a repository setting, a human step), nothing stops a red pull request from merging and
shipping. Merge green pull requests only.

## The EAS link

Committed, public identifiers, not secrets ([CLAUDE.md](../CLAUDE.md), "The EAS link is
committed"):

- [app.json](../app.json): `owner` `gerard161`, `extra.eas.projectId`, `updates.url`
  (`https://u.expo.dev/<projectId>`), `runtimeVersion.policy: fingerprint`.
- [eas.json](../eas.json): `submit.testflight.ios` with `appleTeamId` `KGVA9933BG` and `ascAppId`
  `6825362378`.

Changing any of them points the app at another EAS project, and any `app.json` change moves the
fingerprint, which costs a native build.

## Every push to `main`: `testflight.yml`

```
 push to main
   -> fingerprint        the iOS fingerprint of the tree       (environment: preview)
   -> get_ios_build      a finished testflight-profile build with that fingerprint?
                         (waits if one with it is already building)
        found     -> publish_update      over-the-air update, channel "testflight"
                                         (before_update hook: stop unless this is main's head)
        not found -> build_ios           native iOS build, profile "testflight"
                     -> submit_testflight upload to TestFlight (the submit job)
```

- **Found** means the merge is JavaScript only. The update goes to channel `testflight`.
  TestFlight installs of a build with that fingerprint download it on launch and run it from the
  next launch. No build quota is used.
- **Not found** means something native changed: a native dependency, a config plugin or
  `app.json`. EAS builds iOS with the `testflight` profile and uploads it to TestFlight. Internal
  groups with automatic distribution get it.
- **Only `main`'s head publishes an update.** The `before_update` hook reads `main` from GitHub and
  stops an older run (red, "main is at …"); the newer run ships both changes.
- `concurrency.cancel_in_progress` is `false`: a running delivery is never cancelled.
- Source maps are not uploaded (`upload_sentry_sourcemaps: false`): the repository holds no Sentry
  token.

## Every pull request to `main`: `pr-check.yml`

The same fingerprint lookup, without waiting for a build in progress. It then comments on the PR:

- "Automatos Go: merging this PR ships as an over-the-air update.", with the matching build, or
- "Automatos Go: merging this PR needs a native iOS build."

It never builds and never publishes. Pull requests from forks do not trigger EAS Workflows. A
newer push to the same PR cancels the older check.

## Profiles

[eas.json](../eas.json):

| Profile | Channel | EAS environment | Notes |
|---|---|---|---|
| `development` | `development` | `development` | Development client, internal distribution |
| `preview` | `preview` | `preview` | Internal distribution; Android APK |
| `testflight` | `testflight` | **`preview`** | Extends `production`; `autoIncrement`. Used by both workflows |
| `production` | `production` | `production` | `autoIncrement` |

`appVersionSource` is `remote`: EAS holds the build numbers.

## The release-env guard

`eas-build-pre-install` runs [scripts/check-release-env.js](../scripts/check-release-env.js) on the
EAS build server before anything compiles. For `production`, a missing `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
(or one that is not `pk_live_`), `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_WEB_URL` fails the build. For
`preview` and `testflight` the same problems only warn, so a device-test build can use test keys.
An unset `EXPO_PUBLIC_SENTRY_DSN` always only warns.

The `EXPO_PUBLIC_*` values come from the profile's EAS environment. There is no `.env.example`; the
names are listed in [README.md](../README.md), "Environment".

## Starting the run by hand (until the repository is linked)

The push trigger fires only once the GitHub repository is linked to the EAS project (expo.dev →
project → GitHub). Until then, after each green merge, start the run from a clean checkout of
`main`:

```bash
npx eas-cli workflow:run .eas/workflows/testflight.yml --non-interactive
```

A run started this way has no commit sha, so the `before_update` head check is skipped. Run it from
`main`'s head. Once the repository is linked, stop doing this: the push trigger would run it a
second time.

## Traps

- **Native change = build quota.** Native iOS builds come out of the EAS plan's monthly iOS build
  allowance, shared with the academy app (D43). Batch native changes into one PR, and read the PR
  check's comment before merging.
- **Two quick merges can start two native builds.** EAS can cancel runs but not queue them, and a
  run waits only for a same-fingerprint build that has already started. After a native merge, merge
  the next PR once that run's "Build iOS" job is running.
- **"Found" means EAS built it, not that it reached TestFlight.** If "Send the build to TestFlight"
  fails (no App Store Connect API key assigned, Apple down), the build still matches its
  fingerprint and every later JavaScript merge updates a binary nobody has. Re-send it before
  merging anything else: `eas submit -p ios --profile testflight --id <build id>`.
- **Skip words.** `[eas skip]`, `[skip eas]` or `[no eas]` in a commit message skips EAS Workflows.
  Keep them out of PR titles, bodies and squash messages (merge with
  `gh pr merge --squash --subject … --body …`).
- **The `preview` environment holds only public values.** `pr-check.yml` runs a PR branch's config
  plugins in it, so a secret there would be readable from any branch. Secrets go in an environment
  only `main`'s build uses.
- **Builds 5–7 never update.** They were made without `updates.url`. Install a newer build from
  TestFlight. The first build after the EAS Workflows change was native, because `app.json` gained
  the EAS link.

## Plan limits

- EAS's `testflight` job type needs a paid plan: EAS refused it on the free plan (run `01a16b62`,
  24 Oct). The workflow uses the `submit` job instead, the same upload `eas submit` does. The cost is
  that builds arrive without "What to Test" notes.
- Over-the-air updates use no build quota.
- An EAS workflow file must stay under 16 KiB (noted in `eas-release.test.ts`).

## Human steps

These need a person with the accounts. The full list is in [README.md](../README.md), "Human
steps":

1. EAS environment values for `preview` and `production`.
2. The Expo GitHub app on `AutomatosAI/automatos-go`, the repository linked in EAS, and the three
   required checks on `main`.
3. App Store Connect: the app record, an API key assigned on EAS, a TestFlight internal group with
   automatic distribution.
4. Expo's "enhanced push security" left off ([push.md](push.md)).
5. Clerk: Native API, the apps, passkeys, the `mobile` template, 30-day sessions
   ([connecting.md](connecting.md)).

## Not in place yet

The release wave (A7, kit `prd-001-release.json`, every story `passes: false`; the kit is not
committed yet and lands on `feat/a7-release` when the wave starts) plans crash
reporting (Sentry EU, with a scrubber and a switch), Settings → Privacy & legal, a legal line on
Welcome, and the App Store privacy labels. Today Sentry is never started. Android settings exist in `app.json`, but there is no
Play Console listing yet, and both workflows build and update iOS only. The kit was written before the move to EAS Workflows: its plan for a GitHub
environment holding `EXPO_TOKEN` is replaced by what this page describes.
