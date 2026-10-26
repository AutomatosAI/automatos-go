# The IPA symbol scan

App Store processing rejects a binary that references a privacy framework without that framework's
`NS…UsageDescription` key in Info.plist (ITMS-90683), even when the app never asks for access. The
academy app's first upload was rejected for `PHAsset` without `NSPhotoLibraryUsageDescription`.

`src/release/__tests__/permissions.test.ts` checks every key in the config Expo evaluates, and
`docs/native-modules.md` 'Symbols and usage keys' records which installed module references which
framework. Neither can see the CocoaPods downloaded at build time (Sentry, MMKVCore, LiveKitWebRTC,
GoogleSignIn and its dependencies through Clerk), because they are not in `node_modules`. Only the
built binary shows what they reference. `scripts/release/scan-ipa.mjs` reads the built binary.
It replaces the foundation's manual OT-3 step (`strings` / `nm` on the IPA), and Xcode is not
needed.

Requirement R07 and owner step OT-R4 in [README.md](README.md).

## The rule

**Scan every native build before it is first submitted.**

- The `testflight` workflow (`.eas/workflows/testflight.yml`) uploads each native build to
  TestFlight automatically, straight after the build job. For these builds, run the scan as soon as
  the build finishes. Its result decides whether the build is used. On a FAIL, give the build to no
  tester outside the internal group, never submit it for App Review, and make a fixed build
  ([When it fails](#when-it-fails)). Apple's processing of the upload may also send an ITMS-90683
  email. The scan tells you which binary and which symbol caused it.
- A build made by hand without auto-submit is scanned before `eas submit`.
- An over-the-air update changes only JavaScript, never the binary. It needs no scan.

## 1. Get the IPA

The IPA is the build's application archive, kept by EAS.

**From the build page.** expo.dev → the Automatos Go project → Builds → the iOS build (profile
`testflight`, status Finished) → Download. Check the build number and commit on the page are the
ones you mean.

**From the command line,** under Node 22, signed in to EAS (`npx --yes eas-cli@latest login` once):

```sh
npx --yes eas-cli@latest build:list --platform ios --limit 1 --json
```

This prints a JSON array of builds. The IPA's address is `artifacts.buildUrl` of the first one. To
get the newest finished TestFlight build and download it in one go:

```sh
url=$(npx --yes eas-cli@latest build:list --platform ios --build-profile testflight \
  --status finished --limit 1 --json --non-interactive | jq -r '.[0].artifacts.buildUrl')
curl -fL -o automatos-go.ipa "$url"
```

Before using the build, check `appBuildVersion` and `gitCommitHash` in the same JSON. They name the
build and the commit it came from. (The flags are the ones eas-cli 25.3.0's `build:list` defines.)

## 2. Run the scan

From any checkout of `main` (the symbol list is `scripts/release/usage-symbols.json`), under Node 22:

```sh
node scripts/release/scan-ipa.mjs automatos-go.ipa
```

- An `.ipa` is extracted with the system `unzip` into a temp folder. The scan removes the folder
  when it ends, whatever the result. A path to an `.app` folder is scanned in place.
- The app's Info.plist is read with `plutil -convert json`. plutil ships with macOS, so Xcode is
  not needed. On a machine without plutil, convert Info.plist to JSON some other way and pass
  `--plist <file.json>`. `--plist`, when given, is always used, and the first lines of the output
  say which Info.plist was read.
- It scans the main executable, the binary of each `Frameworks/*.framework` and each
  `Frameworks/*.dylib`, searching each binary's bytes for every symbol in the list. It never
  uploads or fetches anything.

## 3. Read the result

```text
App: AutomatosGo.app; Info.plist: the bundle's own, via plutil
Scanned 9 binaries for 23 symbols:
  PHAsset → AutomatosGo → NSPhotoLibraryUsageDescription → present
  AVCaptureDevice → AutomatosGo → NSCameraUsageDescription → present
  AVCaptureDevice → AutomatosGo → NSMicrophoneUsageDescription → present
  LAContext → AutomatosGo → NSFaceIDUsageDescription → present
Not referenced: UIImageWriteToSavedPhotosAlbum, CLLocationManager, …, ATTrackingManager
PASS: every referenced symbol has its usage key, and nothing forbidden is referenced.
```

The numbers and rows above are an example. A real build shows its own.

- Each row reads **symbol → binary → key → status**: the symbol found, the binary that names it
  (relative to the `.app`), the Info.plist key it needs, and whether that key is `present` (a
  non-empty string), `missing`, or `forbidden` (a symbol no key can cover).
- `Not referenced` lists the symbols found in no binary.
- `Skipped (not a Mach-O binary)` names a `.dylib` that is not a binary. Resource files inside a
  framework are not scanned at all.
- `Not scanned (an app extension, own Info.plist)` names anything under `PlugIns/`. Automatos Go
  has no app extension. If one appears, it has its own Info.plist and needs its own check.
- The last line is `PASS` or `FAIL`.

| Exit code | Meaning |
|---|---|
| 0 | PASS: every key every referenced symbol needs is present, and nothing forbidden is referenced |
| 1 | FAIL: a key is missing or empty, or `ATTrackingManager` is referenced; each problem is a `FAIL:` line |
| 2 | The scan could not run (bad arguments, no `unzip` or plutil, no `Payload/*.app` in the IPA, no main executable); this is not a PASS |

Record the result for OT-R4: the build number, the commit, and the PASS line.

## When it fails

- **A key is missing.** Some binary references a framework the app has no key for. The row names
  the binary, and the binary names the package that brought it in. Either remove that dependency,
  or add the key to `app.json` `ios.infoPlist` with an honest string. A key the app uses says what
  for. A key it does not use is a notice: "Automatos Go does not …; a bundled library references
  it, so Apple requires this notice; the app never asks for access." Record the key in
  `docs/release/ios-usage-keys.json` and in `docs/native-modules.md` 'Symbols and usage keys', so
  that `permissions.test.ts` passes. The app.json change moves the fingerprint, so the next merge
  is a native build. Scan that build too.
- **`ATTrackingManager` is referenced.** Tracking code reached the binary, and KR10 forbids it: no
  tracking, no App Tracking Transparency, and a privacy label that says 'Tracking: No'. No key fixes
  this. Find the package that brought it in (the row names the binary), remove the package, and
  build again. Never add `NSUserTrackingUsageDescription`.
- **Exit 2.** Fix what the `error:` line says and run the scan again.

## What it can and cannot see

- The scan searches for names. A hit means the binary names the class or selector, which is what
  App Store processing checks for. It does not mean the app calls it.
- An enum constant such as `PHAccessLevelAddOnly` compiles to a number. The scan rarely finds it,
  so a miss proves nothing. That is why app.json keeps the notice keys `docs/native-modules.md`
  lists for the installed modules.
- `AVCaptureDevice` captures both video and audio, and a byte search cannot tell which one a binary
  uses. So a hit needs both the camera and the microphone key.
- The symbol list is `scripts/release/usage-symbols.json`. Each entry has the symbol, its framework,
  the key or keys it needs and why. `scripts/__tests__/release-scan-ipa.test.ts` keeps the list in
  step with the table and the 'Checked and referenced by no bundled module' list in
  `docs/native-modules.md`, and with `ios-usage-keys.json`. A class added to either document must
  be added to the list, or CI fails.
