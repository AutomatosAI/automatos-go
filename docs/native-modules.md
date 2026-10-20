# Native modules

Every native module Automatos Go v1 needs is in the first build (PRD-001 §4.2, D43): a
later wave adds no native module, config plugin or `app.json` change, because each
native change moves the fingerprint and costs an iOS build from the 15 a month shared
with the academy app.

How a version is chosen (kit decision K8):

- **expo install** — `npx expo install <pkg>` for every package Expo SDK 54 knows; it
  writes the version range from `expo/bundledNativeModules.json`.
- **K8** — otherwise the newest version whose `peerDependencies` accept expo 54,
  react-native 0.81.5, react 19.1.0 and react-native-worklets 0.5.1, checked with
  `npm view <pkg>@<version> peerDependencies` (20 Oct 2026). K8 packages are pinned
  exactly, so a patch release cannot move the fingerprint by itself.
- **US-001** — installed with the scaffold at the academy template's version; each one
  matches SDK 54's pin (`expo-doctor` "packages match versions required by installed
  Expo SDK" passes).

"Config plugin" names the plugin the package ships (`app.plugin.js`) and how US-002b wires it
into `app.json` ([Config plugins](#config-plugins)). The last column is filled in by US-002c.

## Modules

| PRD §4.2 need                                  | Package                               | Version                                   | How chosen                                                                                                                                                                                                                              | Config plugin                                                                                                                      | iOS frameworks / usage keys        |
| ---------------------------------------------- | ------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Sign-in                                        | `@clerk/expo`                         | 3.2.16 (`~3.2.16`)                        | US-001 + lead decision LEAD-20OCT: newest 3.2.x, peers `expo >=53 <56`                                                                                                                                                                  | ships one; deliberately not wired (it adds Sign in with Apple and Clerk's native UI packages, see CLAUDE.md traps)                 | US-002c                            |
| Passkeys                                       | `@clerk/expo-passkeys`                | 2.1.1 (exact)                             | K8, see [Clerk passkeys and React 19.1.0](#clerk-passkeys-and-react-1910)                                                                                                                                                               | none; its setup is the `webcredentials:clerk.automatos.app` associated domain, see [Passkeys setup](#passkeys-setup)               | US-002c                            |
| Sign-in storage                                | `expo-secure-store`                   | 15.0.8 (`~15.0.8`)                        | US-001                                                                                                                                                                                                                                  | `expo-secure-store` (wired in US-001)                                                                                              | US-002c                            |
| Push, actions                                  | `expo-notifications`                  | 0.32.17 (`~0.32.17`)                      | US-001                                                                                                                                                                                                                                  | `expo-notifications`, `enableBackgroundRemoteNotifications: true`                                                                  | US-002c                            |
| Push, actions                                  | `expo-local-authentication`           | 17.0.9 (`~17.0.9`)                        | expo install                                                                                                                                                                                                                            | `expo-local-authentication`                                                                                                        | US-002c                            |
| QR scan                                        | `expo-camera`                         | 17.0.10 (`~17.0.10`)                      | expo install                                                                                                                                                                                                                            | `expo-camera`, `barcodeScannerEnabled: true`                                                                                       | US-002c                            |
| Attachments                                    | `expo-image-picker`                   | 17.0.11 (`~17.0.11`)                      | expo install                                                                                                                                                                                                                            | `expo-image-picker`                                                                                                                | US-002c                            |
| Attachments                                    | `expo-document-picker`                | 14.0.8 (`~14.0.8`)                        | expo install                                                                                                                                                                                                                            | `expo-document-picker`                                                                                                             | US-002c                            |
| Attachments (HEIC to JPEG)                     | `expo-image-manipulator`              | 14.0.8 (`~14.0.8`)                        | expo install                                                                                                                                                                                                                            | none                                                                                                                               | US-002c                            |
| Files                                          | `expo-file-system`                    | 19.0.24 (`~19.0.23`)                      | US-001 (SDK 54 pins `~19.0.24`; the lock resolves 19.0.24)                                                                                                                                                                              | `expo-file-system` (applied by prebuild without an entry)                                                                          | US-002c                            |
| Files: system document viewer                  | `react-native-file-viewer-turbo`      | 0.8.0 (exact)                             | K8, see [Document viewer](#document-viewer)                                                                                                                                                                                             | `react-native-file-viewer-turbo` (Android `<queries>` for `showOpenWithDialog` only); not wired                                    | US-002c                            |
| Voice: speech to text                          | `expo-speech-recognition`             | 3.1.3 (exact)                             | US-001; npm dist-tag `sdk-54` = 3.1.3; peers `expo`, `react`, `react-native` `"*"`                                                                                                                                                      | `expo-speech-recognition`, `androidSpeechServicePackages`                                                                          | US-002c                            |
| Voice: text to speech                          | `expo-speech`                         | 14.0.8 (`~14.0.8`)                        | US-001                                                                                                                                                                                                                                  | none                                                                                                                               | US-002c                            |
| Voice: Auto Live                               | `@livekit/react-native`               | 3.1.0 (exact)                             | K8: newest; peers `react "*"`, `react-native "*"`, `livekit-client "^2.20.0"`, `@livekit/react-native-webrtc "^150.1.0"`; engines `node >=20`                                                                                           | none (through `@livekit/react-native-expo-plugin`)                                                                                 | US-002c                            |
| Voice: Auto Live                               | `@livekit/react-native-webrtc`        | 150.1.0 (exact)                           | K8: newest, and the line `@livekit/react-native` 3.1.0 peers; peers `react-native ">=0.60.0"`; podspec `ios 12.0`                                                                                                                       | none (through `@config-plugins/react-native-webrtc`)                                                                               | US-002c                            |
| Voice: Auto Live                               | `@livekit/react-native-expo-plugin`   | 1.1.0 (exact)                             | K8: newest; peers `expo "*"`, `react "*"`, `react-native "*"`, `@livekit/react-native "^2.1.0 \|\| ^3.0.0"`. 1.1.0 is the first to add the livekit/podspecs source at prebuild (LiveKitWebRTC leaves the CocoaPods trunk on 2 Dec 2026) | `@livekit/react-native-expo-plugin`, `android.audioType: communication`                                                            | US-002c                            |
| Voice: Auto Live                               | `@config-plugins/react-native-webrtc` | 13.0.0 (exact)                            | K8: the SDK 54 line; peers `expo "^54"` (14.0.0 peers `expo "^55"`, 15.0.x `expo ">=56"`)                                                                                                                                               | `@config-plugins/react-native-webrtc`                                                                                              | US-002c                            |
| Styles: HUD rings and grid, mascot tint        | `@shopify/react-native-skia`          | 2.2.12 (exact, as expo install writes it) | expo install; peers `react ">=19.0"`, `react-native ">=0.78"`, `react-native-reanimated ">=3.19.1"` (optional). The newest, 2.14.0, peers `react-native-worklets ">=0.7.0"` and SDK 54 pins 0.5.1                                       | none                                                                                                                               | US-002c                            |
| Styles: mascot clips                           | `expo-video`                          | 3.0.16 (`~3.0.16`)                        | US-001                                                                                                                                                                                                                                  | `expo-video`, no background playback, no picture in picture                                                                        | US-002c                            |
| Styles: fonts                                  | `expo-font`                           | 14.0.12 (`~14.0.12`)                      | US-001                                                                                                                                                                                                                                  | `expo-font` (US-002d embeds the fonts)                                                                                             | US-002c                            |
| Styles: haptics                                | `expo-haptics`                        | 15.0.8 (`~15.0.8`)                        | US-001                                                                                                                                                                                                                                  | none                                                                                                                               | US-002c                            |
| Storage: encrypted query cache                 | `react-native-mmkv`                   | 4.3.2 (exact)                             | K8, see [MMKV](#mmkv)                                                                                                                                                                                                                   | none                                                                                                                               | US-002c                            |
| Storage (MMKV 4 runtime)                       | `react-native-nitro-modules`          | 0.37.1 (exact)                            | K8, see [MMKV](#mmkv)                                                                                                                                                                                                                   | none                                                                                                                               | US-002c                            |
| Errors (Sentry EU)                             | `@sentry/react-native`                | 7.2.0 (`~7.2.0`)                          | expo install; peers `expo ">=49.0.0"` (optional), `react ">=17.0.0"`, `react-native ">=0.65.0"`                                                                                                                                         | `@sentry/react-native`, EU `url`; see [Sentry source maps](#sentry-source-maps)                                                    | US-002c                            |
| Time (digest timezone)                         | `expo-localization`                   | 17.0.9 (`~17.0.9`)                        | expo install                                                                                                                                                                                                                            | `expo-localization`                                                                                                                | US-002c                            |
| K11: push taps while the app is closed (§4.8)  | `expo-task-manager`                   | 14.0.9 (`~14.0.9`)                        | expo install                                                                                                                                                                                                                            | `expo-task-manager` (applied by prebuild without an entry; its `fetch` mode is removed, see [Background modes](#background-modes)) | US-002c                            |
| K11: `userInterfaceStyle: automatic`           | `expo-system-ui`                      | 6.0.9 (`~6.0.9`)                          | expo install                                                                                                                                                                                                                            | `expo-system-ui`                                                                                                                   | US-002c                            |
| K11: the `development` profile (§4.2)          | `expo-dev-client`                     | 6.0.21 (`~6.0.21`)                        | expo install                                                                                                                                                                                                                            | `expo-dev-client` (applied by prebuild without an entry)                                                                           | US-002c                            |
| K11: the handoff's icon set                    | `lucide-react-native`                 | 1.60.0 (exact)                            | K8: newest; peers `react "^16.5.1 \|\| ^17.0.0 \|\| ^18.0.0 \|\| ^19.0.0"`, `react-native "*"`, `react-native-svg "^12.0.0 \|\| ^13.0.0 \|\| ^14.0.0 \|\| ^15.0.0"` (the app has 15.12.1). JavaScript only, on `react-native-svg`       | none                                                                                                                               | none (JavaScript)                  |
| Not in §4.2: native build settings             | `expo-build-properties`               | 1.0.10 (`~1.0.10`)                        | US-001                                                                                                                                                                                                                                  | `expo-build-properties` (wired in US-001: iOS 17.0, extraPods); see [Minimum OS versions](#minimum-os-versions)                    | none (config only, no native code) |
| Not in §4.2: an optional peer of `@clerk/expo` | `expo-web-browser`                    | 15.0.11 (`~15.0.11`)                      | US-001                                                                                                                                                                                                                                  | `expo-web-browser` (Android `experimentalLauncherActivity` only); not wired                                                        | US-002c                            |
| Not in §4.2: an optional peer of `@clerk/expo` | `expo-crypto`                         | 15.0.9 (`~15.0.9`)                        | US-001                                                                                                                                                                                                                                  | none                                                                                                                               | US-002c                            |

Support package, not native: `livekit-client` 2.23.0 (exact), the peer of
`@livekit/react-native` (`^2.20.0`) and of its dependency `@livekit/components-react`
2.9.24 (`^2.20.1`). Its own peer `@types/dom-mediacapture-record ^1` is type-only and not
installed (`legacy-peer-deps`); `tsc` passes because `expo/tsconfig.base` sets
`skipLibCheck`.

## Clerk passkeys and React 19.1.0

Every published `@clerk/expo-passkeys` line from 1.0.0 to 2.1.1 peers
`react "^18.0.0 || ~19.0.3 || ~19.1.4 || ~19.2.3 || ~19.3.0-0"`; none accepts the
19.1.0 that React Native 0.81.5's renderer requires exactly. 2.1.1 is taken because:

- `npm view @clerk/expo-passkeys@2.1.1 peerDependencies` → `expo ">=54 <59"`,
  `react-native "*"`, the React range above; its dependency `@clerk/shared ^4.41.0` is the
  4.41.0 that `@clerk/expo` 3.2.16 already installs, so there is one copy.
- The React peer is never exercised: the package's `dist/` imports only `expo`,
  `react-native`, `buffer` and `@clerk/shared` — no `react`.
- It is the same mismatch `@clerk/react` 6.x (from `@clerk/expo` 3.2) already carries,
  which `.npmrc`'s `legacy-peer-deps=true` covers.

## Document viewer

AC: "a system document viewer that opens PDF/DOCX/XLSX in QuickLook on iOS and the
system viewer on Android (evaluate react-native-file-viewer-turbo first)".

Chosen: `react-native-file-viewer-turbo` 0.8.0, the maintained fork of
`react-native-file-viewer`. Its README: "utilizes the QuickLook Framework on iOS and the
ACTION_VIEW intent to launch the default app associated with the specified file on
Android"; "requires React Native 0.76 or newer (New Architecture) and is compatible with
Expo SDK 52 or newer"; 0.7.0+ is New Architecture only (the app has `newArchEnabled:
true`). Peers `expo "*"` (optional), `react "*"`, `react-native "*"`. `open(path)` takes a
`file://` path from `expo-file-system`. On Android it shares files through its own
FileProvider (`${applicationId}.fileviewerturbo.provider`); its config plugin is needed
only for `showOpenWithDialog`.

Not chosen: `expo-sharing` opens the share sheet, not a preview; a WebView viewer is
ruled out by D-NO-WEBVIEW.

## MMKV

`react-native-mmkv` 4.3.2 is the newest; it peers `react "*"`, `react-native "*"` and
`react-native-nitro-modules "*"`, because 4.x is a Nitro module, so
`react-native-nitro-modules` 0.37.1 (the newest; peers `react "*"`, `react-native "*"`)
is installed beside it. Encryption: `createMMKV({ id, encryptionKey, encryptionType })`
with `encryptionType` `'AES-128'` (default) or `'AES-256'` (`src/specs/MMKVFactory.nitro.ts`).

MMKV 4.3.2's generated code is from nitrogen 0.35.9 (its devDependencies); no release
between 0.35.9 and 0.37.1 in mrousavy/nitro is marked breaking. Both build against
React Native 0.85.3 in their own repos (devDependencies); no React Native version check
was found in either podspec or `android/build.gradle`. The native compile is proven only by the first iOS build (OT-3).

3.x (no Nitro) was not taken: K8 takes the newest compatible line.

## What is not installed

- `react-native-webview` — never, not even transitively (D-NO-WEBVIEW): the lockfile has
  no `node_modules/react-native-webview` entry.
- `expo-apple-authentication` — no Sign in with Apple (D-SIGNIN).
- `@react-native-async-storage/async-storage` — MMKV is the store (removed in US-001).

## Config plugins

US-002b wires every plugin the first build needs, so no later wave touches `app.json`
(D-NATIVE-ONCE). `app.json` `plugins`, in order:

| Plugin                                   | Options                                                                         | Why                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `expo-router`                            | none                                                                            | US-001                                                                                                                                                                                                                                                                               |
| `expo-secure-store`                      | none                                                                            | US-001                                                                                                                                                                                                                                                                               |
| `expo-notifications`                     | `enableBackgroundRemoteNotifications: true`                                     | adds `remote-notification` to `UIBackgroundModes`, the mode its background task checks (`BackgroundModule.swift`). `mode` stays at the plugin default (`development`), as in the academy app's TestFlight builds                                                                     |
| `expo-local-authentication`              | none                                                                            | Face ID before approve or answer; its usage string is US-002c's (`ios.infoPlist`)                                                                                                                                                                                                    |
| `expo-camera`                            | `barcodeScannerEnabled: true`                                                   | the pairing QR code. 17.0.10's plugin reads no such option: barcode scanning is always built in (Android: `com.google.mlkit:barcode-scanning` 17.3.0 in its `android/build.gradle`). Expo's current camera docs list the option (default `true`), so it is written down and stays on |
| `expo-image-picker`                      | none                                                                            | attachments                                                                                                                                                                                                                                                                          |
| `expo-document-picker`                   | none                                                                            | attachments; no iCloud container (its plugin adds iCloud entitlements only with `ios.usesIcloudStorage`, which is unset)                                                                                                                                                             |
| `expo-speech-recognition`                | `androidSpeechServicePackages: ['com.google.android.googlequicksearchbox']`     | as the academy template: Android `<queries>` for the Google app's `RecognitionService`. Usage strings come from `ios.infoPlist` (US-002c), which the plugin keeps                                                                                                                    |
| `@livekit/react-native-expo-plugin`      | `android.audioType: 'communication'`                                            | Auto Live is a two-way call (the README's default, written down). `ios.addPodSources` stays `true`: LiveKitWebRTC moves to livekit/podspecs                                                                                                                                          |
| `@config-plugins/react-native-webrtc`    | none                                                                            | WebRTC's Android permissions and `ios.bitcode: false`                                                                                                                                                                                                                                |
| `expo-video`                             | `supportsBackgroundPlayback: false`, `supportsPictureInPicture: false`          | mascot clips play in the app only; with both `false` the plugin removes `audio` from `UIBackgroundModes` (D33)                                                                                                                                                                       |
| `@sentry/react-native`                   | `url: 'https://de.sentry.io/'`                                                  | Sentry EU (D44); see [Sentry source maps](#sentry-source-maps)                                                                                                                                                                                                                       |
| `expo-localization`                      | none                                                                            | digest timezone                                                                                                                                                                                                                                                                      |
| `expo-system-ui`                         | none                                                                            | carries `userInterfaceStyle: automatic` to Android (K11)                                                                                                                                                                                                                             |
| `expo-build-properties`                  | iOS `deploymentTarget: '17.0'`, `extraPods`; Android `packagingOptions.exclude` | US-001 (CLAUDE.md traps); see [Minimum OS versions](#minimum-os-versions)                                                                                                                                                                                                            |
| `./plugins/with-pinned-background-modes` | none                                                                            | see [Background modes](#background-modes)                                                                                                                                                                                                                                            |
| `./plugins/with-sentry-upload-guard`     | none                                                                            | see [Sentry source maps](#sentry-source-maps)                                                                                                                                                                                                                                        |

Prebuild applies some plugins without an entry (`@expo/prebuild-config`'s
`withLegacyExpoPlugins` and the SDK's own; `expo config --type introspect` lists them in
`_internal.pluginHistory`): `expo-dev-client` (with `expo-dev-menu` and `expo-dev-launcher`),
`expo-file-system`, `expo-task-manager`, `expo-updates` and `expo-splash-screen`.

Not wired, on purpose: `@clerk/expo` (CLAUDE.md traps); `expo-web-browser` (its plugin acts
only on Android `experimentalLauncherActivity`); `react-native-file-viewer-turbo` (its plugin
adds Android `<queries>` for `showOpenWithDialog` only; the app calls `open`). `expo-font`
gets its font list in US-002d and `expo-splash-screen` its image in US-002e.

Permission strings are not plugin options: US-002c writes them into `ios.infoPlist`, and every
plugin above keeps a string that is already there. Until then `expo config --type introspect`
shows the plugins' defaults ("Allow $(PRODUCT_NAME) to …").

## Minimum OS versions

iOS `deploymentTarget` stays `17.0` (US-001, for `@clerk/expo`'s `ClerkExpo.podspec`). No other
pod asks for more:

| Pod (package)                                                  | `s.platforms` iOS                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| `ClerkExpo` (`@clerk/expo`)                                    | 17.0                                                                  |
| `react-native-skia` (`@shopify/react-native-skia`)             | 14.0                                                                  |
| `ClerkExpoPasskeys` (`@clerk/expo-passkeys`)                   | 13.4; passkeys need iOS 16 at run time (Clerk's guide: target `16.0`) |
| `livekit-react-native-webrtc` (`@livekit/react-native-webrtc`) | 12.0                                                                  |
| `livekit-react-native` (`@livekit/react-native`)               | 10.0                                                                  |
| React Native 0.81.5 (`min_ios_version_supported`)              | 15.1                                                                  |

Android `minSdkVersion` is not set, so it is React Native 0.81.5's default, 24
(`gradle/libs.versions.toml`). The most any module asks is 24: `@livekit/react-native`,
`@livekit/react-native-webrtc`, `@clerk/expo` and `react-native-file-viewer-turbo`; Skia,
Clerk passkeys, Sentry and `expo-speech-recognition` default to 21. Clerk's guide says
passkeys need Android 9 (API 28): a run-time requirement (the passkeys library builds at
minSdk 21), so raising minSdk to 28 would only drop Android 7 and 8 for email-code and password
sign-in too.

## Associated domains and app links

K9, asserted in `src/config/__tests__/app-config.test.ts` against `app.json` and the
introspected entitlements and Android manifest:

- `ios.associatedDomains` is exactly `applinks:ui.automatos.app` (universal links: PRD-266
  §4.9 serves `apple-app-site-association` on ui.automatos.app for `/go/*`, `/command-center`
  and `/chat`, app id `KGVA9933BG.com.automatos.app`) and `webcredentials:clerk.automatos.app`
  (passkeys on Clerk's production Frontend API host).
- `android.intentFilters` is one `VIEW` filter, `autoVerify: true`, categories `BROWSABLE` and
  `DEFAULT`, for `https://ui.automatos.app` with `pathPrefix` `/go`, `/command-center` and
  `/chat` (PRD-266 §4.9 serves `assetlinks.json`). ui.automatos.app has no other route that
  starts with `/go` (automatos-ai `frontend/app/` @ 630fc1c85).

### Passkeys setup

The `@clerk/expo-passkeys` README covers only the JavaScript. Clerk's Expo passkeys guide
(clerk.com/docs/reference/expo/passkeys, read 20 Oct 2026) asks for an iOS `deploymentTarget` of
at least 16.0 (the app has 17.0), `associatedDomains` `applinks:<Frontend API>` and
`webcredentials:<Frontend API>`, and on Android an auto-verified `https://<Frontend API>` intent
filter. Wired: `webcredentials:clerk.automatos.app`. Not wired, because K9 fixes the list:

- `applinks:clerk.automatos.app`: universal links from Clerk's host carry Clerk's redirect
  flows (OAuth, email links), which the app does not use (D-SIGNIN: email code, password and
  passkey only).
- An Android `https://clerk.automatos.app` filter: it would open every Clerk link on the phone
  (a Studio email-verification link, say) in the app instead of the browser.

Owner steps (Clerk dashboard → Native applications), before passkeys work on a device: the iOS
app (App ID prefix `KGVA9933BG`, bundle id `com.automatos.app`), which makes Clerk serve the
`webcredentials` association; the Android app (`com.automatos.app` and the SHA-256 of the EAS
signing certificate), which makes Clerk serve `assetlinks.json`.

## Background modes

`ios.infoPlist.UIBackgroundModes` is `['remote-notification']` (K11), and `expo-notifications`
adds the same mode. Prebuild applies `expo-task-manager`'s plugin without an entry
(`withLegacyExpoPlugins`), and that plugin always adds `fetch`; the app registers no background
fetch task (the notification task needs only `remote-notification`).
`plugins/with-pinned-background-modes.js` resets the final Info.plist to the list `app.json`
declares. `expo config --type introspect`, 20 Oct: `["remote-notification","fetch"]` without it,
`["remote-notification"]` with it (asserted in `app-config.test.ts`). No `audio` (D33).

## Sentry source maps

- The plugin options hold only the EU `url`. No organisation, project or auth token is in the
  repo: sentry-cli takes `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` from the build
  env, and the plugin says so when the config is read ("Missing config for organization,
  project. Environment variables will be used as a fallback during the build").
- Without a token, the plugin's build steps would fail the build: it wraps iOS "Bundle React
  Native code and images" in `sentry-xcode.sh`, which exits 1 when sentry-cli cannot upload
  unless `SENTRY_DISABLE_AUTO_UPLOAD=true`; on Android `sentry.gradle` runs an upload task after
  each bundle task.
- `plugins/with-sentry-upload-guard.js` keeps the build independent of the token. It appends
  `if [ -z "$SENTRY_AUTH_TOKEN" ]; then export SENTRY_DISABLE_AUTO_UPLOAD=true; fi` to
  `ios/.xcode.env`, which both Sentry build phases source through React Native's
  `with-environment.sh`, and a `gradle.taskGraph.whenReady` block to `android/app/build.gradle`
  that disables the `*_SentryUpload_*` tasks when `SENTRY_AUTH_TOKEN` is unset.
- So with no token in the EAS environment the build succeeds and nothing is uploaded (the Xcode
  log says "SENTRY_DISABLE_AUTO_UPLOAD=true, skipping sourcemaps upload"). To upload, once the
  Sentry EU account exists (human-gated, D44): `SENTRY_AUTH_TOKEN` (secret), `SENTRY_ORG` and
  `SENTRY_PROJECT` in the EAS environments. `SENTRY_DISABLE_AUTO_UPLOAD=true` in the environment
  still turns the upload off with a token present.
- Proven here by unit tests on the plugin's mods (`plugins/__tests__/`); the native build that
  runs it is the first EAS build (OT-3), since nothing runs prebuild on this machine.

## expo-doctor

`npx expo-doctor` 1.21.5: 18/18 checks pass, including "Validate packages against React
Native Directory package metadata". No `expo.doctor.reactNativeDirectoryCheck.exclude`
entry exists, so there is no exclusion to justify.

## Installing

`npx expo install <pkgs> -- --ignore-scripts` adds a bare config plugin to `app.json` for
packages it knows (it added `@sentry/react-native` and `expo-localization` on 20 Oct).
Plugins are wired with their options by US-002b, so that change was reverted: in this
story only `package.json`, `package-lock.json` and this file change.
