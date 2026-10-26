# TestFlight for WebSummit: the team, channels and EAS environments (OT-R11)

The build the team installs for WebSummit (10–12 Nov 2026) has to sign in to hosted Studio after
Clerk's 27 Oct production cutover. An over-the-air update must never swap the environment under the
build it lands on. Requirement R20 and owner step OT-R11 are in [README.md](README.md). How a merge
reaches phones in general (CI, EAS Workflows, the fingerprint loop, its traps) is in
[../release.md](../release.md). This page covers what WebSummit needs on top of that.

Proof: [src/release/\_\_tests\_\_/release-config.test.ts](../../src/release/__tests__/release-config.test.ts)
pins every fact below that the repository can show. The `eas.json` testflight profile, the
update job in [.eas/workflows/testflight.yml](../../.eas/workflows/testflight.yml) and the
fingerprint jobs in both EAS workflows all name one EAS environment, `preview`. The production
profile is channel `production`, environment `production`. The other pinned facts are
`runtimeVersion` policy `fingerprint` [D46], `ITSAppUsesNonExemptEncryption` false,
`supportsTablet` false, `com.automatos.app` on both platforms, `appVersionSource` `remote`, and the
build hook's `pk_live_` rule for production. On 26 Oct the repository and those facts agree: no
mismatch to report.

Delivery moved from GitHub Actions to EAS Workflows on 24 Oct. The kit's
`.github/workflows/testflight.yml` and its `eas update --environment` line no longer exist, so the
test reads the update job's `environment` field instead.

## Who installs what

| Phone | How | Review |
|---|---|---|
| iPhone (Gerard, Dave, Rikki) | TestFlight, internal group with automatic distribution. Every build `submit_testflight` uploads reaches the group. | None: internal testers need no Beta App Review [D51] |
| Android (team testers) | The EAS `preview` APK, installed by link from the build's page on expo.dev [D10] | None: no Play Console exists yet |
| Visitors | Watch on Gerard's phone, against the VPS demo [D51] | No public TestFlight link: a public link needs Beta App Review |

- **Internal testers are App Store Connect users.** Dave and Rikki need App Store Connect accounts
  on team `KGVA9933BG` (Gerard's individual developer account [D9]) with a role that can test, and
  must be added to the internal group. An individual account can add App Store Connect users. They
  never get certificates or EAS access.
- **Export compliance is answered in the build.** `ITSAppUsesNonExemptEncryption` is `false` in
  `app.json`, so App Store Connect does not hold each build waiting for the encryption question.
- **Android testers get no over-the-air updates.** Both EAS workflows publish and build iOS only
  (`platform: ios`). The `preview` profile's channel `preview` has no publisher. An Android tester
  sees a change only in a new APK: `eas build --platform android --profile preview`, started by a
  person, using one of the month's 15 Android builds [D43].

## How a merge ships

Every push to `main` runs [.eas/workflows/testflight.yml](../../.eas/workflows/testflight.yml)
([../release.md](../release.md), "Every push to `main`"):

1. The `fingerprint` job hashes the native side of the tree in the `preview` environment.
2. `get_ios_build` looks for a finished `testflight`-profile build with that fingerprint.
3. **Found:** `publish_update` publishes an over-the-air update on channel `testflight`, in the
   `preview` environment. Phones download it on launch and run it from the next launch. No build
   quota.
4. **Not found:** `build_ios` builds iOS with the `testflight` profile (one of the 15 iOS builds a
   month the two apps share [D43]) and `submit_testflight` uploads it to TestFlight.

**Batch native changes into one pull request [D43].** Each pull request gets a comment from
`pr-check.yml` before merging. The comment says which of the two the merge will be.

### Over the air, a build, or review

| Change | Ships as | Why |
|---|---|---|
| TypeScript under `src/` and `app/`; copy (`strings.ts`); images and fonts the code imports from `assets/` | An over-the-air update | Metro bundles them; the fingerprint does not move |
| An `EXPO_PUBLIC_*` value in the `preview` environment | The next over-the-air update (or build) | The update job inlines the environment's values when it exports. A value change alone starts nothing: it reaches phones with the next merge's update |
| `app.json` (permissions, usage strings, icons, splash, entitlements), a config plugin (`plugins/` or one `app.json` names), a package with native code, **`eas.json`**, `.easignore`, `package.json` scripts | A native iOS build | Each is a fingerprint source (`@expo/fingerprint` 0.15.5: `getExpoConfigSourcesAsync`, `getEasBuildSourcesAsync` hashes `eas.json` and `.easignore`, `getPackageJsonScriptSourcesAsync`) |
| A change of the app's primary purpose, or features unlike what was reviewed | A build and App Review, never an update | Apple 2.5.2: an app may not download code that adds or changes its features. Updates are for fixes and changes within what was reviewed. Internal TestFlight has no review, but the same update reaches App Store phones once the app is there |

A Design Kit theme's phone skin is data (`theme.json`'s `mobile` block), painted on the app's
built-in layouts. It never carries code (Apple 2.5.2). Installing a theme is neither an update nor
a build.

## Freeze on native merges, 9–12 Nov (proposed: Gerard's call)

The proposal: **no native merge from 9 Nov to the end of WebSummit on 12 Nov.**

- **The last native merge lands by Fri 6 Nov.** Its build then has time to reach every team
  iPhone, and the WebSummit checklist (`websummit-checklist.md`, OT-R14) can run on it.
- **During the freeze, JavaScript merges are fixes only.** After each one lands, Gerard's phone
  confirms it: two launches, then the fix is visible.
- **Why:** a native build waits up to about 75 minutes for the free plan's one macOS slot, then
  Apple processes it, then every phone installs it from TestFlight. A bad native build cannot be
  fixed over the air if it fails before the update check. Each one also spends build quota.

The `pr-check.yml` comment shows whether a pull request is native: "needs a native iOS build".

## Rollback

These are human steps: eas-cli with the project's credentials. Nothing in this repository runs
them.

**A bad over-the-air update.**

1. Find the last good update group on the branch the `testflight` channel serves (`testflight`,
   unless someone remapped the channel):
   `eas update:list --branch testflight --platform ios`.
2. Republish it: `eas update:republish --group <good group id> --platform ios --message "Roll back <bad sha>"`.
   An update group carries its runtime version, so it reaches only builds with that fingerprint.
   Pick a group from the same fingerprint as the bad one. Or drop back to the build's own bundle:
   `eas update:roll-back-to-embedded --branch testflight --platform ios --runtime-version <fingerprint>`.
3. Merge a revert pull request on `main`. **The next merge publishes `main`'s head**, so without the
   revert the bad code ships again with it.

**A bad native build.**

- Testers install the previous build from the TestFlight app (Automatos Go → Previous Builds).
- In App Store Connect, expire the bad build (TestFlight → the build → Expire Build).
- Merge a revert. It restores the earlier fingerprint, so `get_ios_build` finds the earlier build
  and the revert ships over the air, at no quota cost.

## EAS environment values

Builds and updates read `EXPO_PUBLIC_*` values from the EAS environment, never from the
repository. The names are the app's (`src/lib/env.ts`, `ENV_NAMES`). The build hook
`scripts/check-release-env.js` checks them:

| Name | preview | production |
|---|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Per the Clerk key choice below: `pk_live_…` (option A) or `pk_test_…` (option B) | The production instance's `pk_live_…` key; a production build fails without it |
| `EXPO_PUBLIC_API_URL` | The hosted Automatos API's base URL | The same |
| `EXPO_PUBLIC_WEB_URL` | Hosted Studio's URL, `https://ui.automatos.app` (the universal-link domain, `association.json`) | The same |
| `EXPO_PUBLIC_SENTRY_DSN` | The EU DSN from OT-R1, host ending `.ingest.de.sentry.io` (D44; the app refuses any other region, so crash reports would stay off) | The same EU DSN |

Who reads each environment:

- **`preview`:** the `testflight` profile's builds, both EAS workflows' `fingerprint` jobs,
  `publish_update` and the Android `preview` APKs. `pr-check.yml` runs a pull-request branch's
  config plugins in it. So `preview` holds public values only ([../release.md](../release.md),
  Traps). The four values above are public by design: each is inlined into the JavaScript bundle.
- **`production`:** the `production` profile's builds. No workflow uses it yet. A secret
  (`SENTRY_AUTH_TOKEN` for source maps, OT-R1) may go here only while no pull-request job reads it.
- **The guard runs in builds only.** `eas-build-pre-install` is an EAS Build hook. An update job is
  not a build and never runs it. A value changed in `preview` reaches phones in the next update
  unchecked.
- **The guard is strict for `production` only.** For `testflight` and `preview`, a missing value
  is a warning in the build log. The `pk_live_` prefix is not checked at all: a `pk_test_` key
  passes without a word. **Nothing stops a WebSummit build that signs in to Clerk's development
  instance.**

## The Clerk key for the WebSummit build (Gerard decides)

After the 27 Oct cutover, hosted Studio accepts tokens from Clerk's production instance only. The
WebSummit build uses the `testflight` profile, and that profile builds with the `preview`
environment. Its updates are published with `preview` too. The README's human step 1 still says
"a `pk_test_` key for preview". On those values, the WebSummit phones would sign in to the
development instance, and hosted Studio would refuse them.

Either option needs the same production-instance setup first ([../connecting.md](../connecting.md),
Hosted sign-in):

- the Native API on;
- the iOS and Android apps registered;
- passkeys;
- the `mobile` JWT template;
- 30-day sessions [D52];
- the native `azp` marker on automatos-ai #1216 (PRD-266 US-020) merged before the flag flips
  (PRD-001 §8).

A build made before the switch can take the new key over the air: the update inlines whatever the
environment holds when it is published.

### Option A: the `preview` environment carries the `pk_live_` key

- **No file changes and no build.** Set the value in `preview`. The next merge's update (or a run
  started by hand, [../release.md](../release.md)) carries the key to every TestFlight install with
  that fingerprint.
- **Android testers are covered.** The `preview` APKs read the same environment, so they sign in to
  production too.
- **Nothing left in `preview` signs in to the development instance.** Testing against the
  development instance needs a `development`-profile build (environment `development`), and none
  has been made. Automated device runs need a real account without MFA on the production instance,
  in a demo workspace with made-up data.
- **The README's human step 1 changes** to say `pk_live_` for preview (US-021q, or Gerard).
- **The guard does not check the key for `testflight`.** A later change back to a test key in
  `preview` ships without a warning. Checking the `pk_live_` prefix for the `testflight` profile
  too is a small change to `scripts/check-release-env.js`, but it guards builds only (see the guard
  above).

### Option B: the `testflight` profile and its updates move to the `production` environment

- **Four edits in one pull request, none of them this wave's files (KR1):**
  - `eas.json` `build.testflight.environment` becomes `production`;
  - `.eas/workflows/testflight.yml` `fingerprint` and `publish_update` `environment` become
    `production`;
  - `.eas/workflows/pr-check.yml` `fingerprint` `environment` becomes `production`, so its lookup
    stays the same as the delivery's.

  `eas-release.test.ts` and this page's test follow the profile, so they need no edit.
- **It costs one iOS build.** `eas.json` is a fingerprint source, so the merge is native. Batch it
  with other native work.
- **TestFlight and the store build share one set of values,** the ones the store build will use.
- **`production` comes within reach of pull-request branches.** `pr-check.yml` would run their
  config plugins in it. `production` must then hold public values only, and a secret
  (`SENTRY_AUTH_TOKEN`) needs an environment no pull request reads, or no home.
- **Android testers are not covered.** The `preview` APKs stay on `preview`. They need the
  `pk_live_` key there anyway, or no Android tester can sign in to hosted Studio. (The `testflight`
  profile extends `production`, so an Android build of it is a store build, not an APK to install
  by link.)
- **The guard is unchanged.** It keys on the build profile (`testflight`), not on the environment,
  so a test key in `production` would still pass a TestFlight build without a word.

**Recommendation:** option A for WebSummit. It needs no code change and no build, and it covers
Android. Option B can follow with the first store build, once a production release process exists.

## Owner steps (OT-R11)

1. **App Store Connect users.** Add Dave and Rikki as App Store Connect users on team `KGVA9933BG`
   (Users and Access), and add them to the TestFlight internal group with automatic distribution.
   Confirm each one sees the latest build in the TestFlight app.
2. **EAS environment values.** In the EAS project (`gerard161/automatos-go`), set the four values
   in the table above, in both `preview` and `production`. The Sentry DSN is the EU one (OT-R1).
3. **The Clerk key.** Choose option A or B before the WebSummit build is cut. Record the choice in
   the A7 pull request. For A, set `pk_live_…` in `preview` and check the next update's build log
   on expo.dev. For B, open the four-edit pull request and expect a native build.
4. **The freeze.** Decide whether native merges stop on 9 Nov, and tell whoever merges.
5. **After the cutover, on one iPhone and on one Android phone with a `preview` APK built after the
   key was set:** sign in to hosted Studio with a real account. On the iPhone, quit and relaunch
   the app twice first so the latest update runs. Settings → Privacy &
   legal → Version shows the build and the update, for example `1.0.0 (42) · update 1a2b3c4d`.
