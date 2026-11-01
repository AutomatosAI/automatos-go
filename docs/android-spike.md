# Android spike: the first local builds (1 Nov 2026)

The first time Automatos Go was built for Android. A local spike on branch `spike/android-local`, run by
Dave on his own machine at his request. It is an exception to this repo's rule that nothing native runs
locally (CLAUDE.md, "The rule"): `expo prebuild` and Gradle ran here, on emulators. Nothing native is
committed: `android/` stays gitignored.

## Result

Automatos Go builds for Android and runs on Android 17 and Android 16 emulators: the first screen, the
"Connect to your own server" screen, and a discovery request to a local server over plain HTTP.

| Build        | compileSdk / targetSdk                 | Gradle memory                                                           | Result                                                                                                                                                                                    |
| ------------ | -------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A, first try | 36 / 36 (React Native 0.81's defaults) | Expo template: `-Xmx2048m -XX:MaxMetaspaceSize=512m`                    | Failed after 1,131 tasks: Metaspace ran out in `expo-updates:kspReleaseKotlin`, `expo-dev-menu:lintVitalAnalyzeRelease` and `expo-modules-core:lintVitalAnalyzeRelease`. No compile error |
| A, retry     | 36 / 36                                | `-Xmx8g -XX:MaxMetaspaceSize=2g` on the command line                    | Built in 6m 44s                                                                                                                                                                           |
| B            | **37 / 37**, build-tools 37.0.0        | `plugins/with-gradle-memory.js`: `-Xmx4096m -XX:MaxMetaspaceSize=1536m` | Built in 4m 1s, no command-line override                                                                                                                                                  |

Both are release APKs for `arm64-v8a` (93 MB), signed with the template's debug key.

| Check                                                                  | Result                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16 KB page size (Google Play requirement)                              | APK zip-aligned for 16 KB; all 32 native libraries have 16 KB ELF LOAD alignment (WebRTC, Skia, MMKV, Hermes and the rest)                                                                                                                                                   |
| Android 17 emulator: Pixel 10, API 37.2, Play Store image, 16 KB pages | Runs. Cold start 784 ms. No crash, no JavaScript error                                                                                                                                                                                                                       |
| Android 16 emulator: Pixel 8, API 36, Play Store image                 | Runs (cold start 8.7 s, on a host running three emulators)                                                                                                                                                                                                                   |
| Network                                                                | `GET /.well-known/automatos.json` to the local edition at `http://10.0.2.2:8000` returned 200; the app showed the server's "not taking phones yet" answer (`LOCAL_REMOTE_ACCESS` off)                                                                                        |
| Permissions in the final APK                                           | None of `app.json`'s `blockedPermissions`. Two `android.permission.*` not in its allowlist: `READ_APP_BADGE`, `REORDER_TASKS`. Launcher badge permissions for Samsung, Huawei, Oppo, Sony, HTC and others, and Google Play's install-referrer service, merged from libraries |

## Changes on this branch

- `app.json`: `expo-build-properties` → `android.compileSdkVersion` 37, `targetSdkVersion` 37,
  `buildToolsVersion` "37.0.0" (from React Native's 36 / 36 / 36.0.0). Google Play requires target API 36
  today; 37 is Android 17.
- `plugins/with-gradle-memory.js` and its test: sets `org.gradle.jvmargs` in `gradle.properties`, since
  `expo-build-properties` has no option for it. An EAS Android build would likely hit the same Metaspace
  limit; this plugin is the fix to carry over.

## Not tested yet

- Signing in with Clerk: this build has no `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` ("Sign-in is not configured
  in this build").
- Pairing with a local server: needs `LOCAL_REMOTE_ACCESS=paired`, which also closes the local edition's
  no-sign-in lane for the browser. Not switched for this spike.
- Push (needs a Firebase project and `google-services.json`), answering from a notification while the app is
  closed, App Links verification (needs the signing key's SHA-256 in `assetlinks.json`), passkeys, voice
  (speech recognition, the spoken reply, LiveKit), the camera QR scanner, TalkBack, and real phones.
- `armeabi-v7a`, `x86` and `x86_64` builds (this spike built `arm64-v8a` only), and an AAB for Play.

## Next

1. Decide on `READ_APP_BADGE`, `REORDER_TASKS` and the launcher badge permissions: block them in
   `app.json` or record why they stay, for Play's Data Safety form.
2. Pair with a local server in `paired` mode, then walk the app's screens on Android 17.
3. With the Play Console and Firebase set up: push, App Links, and the first EAS Android build.

## Reproduce

Android SDK with platform `android-37.2` and the image `system-images;android-37.2;google_apis_playstore_ps16k;arm64-v8a`,
JDK 17, Node 22 (`.nvmrc`).

```bash
npm ci
CI=1 npx expo prebuild --platform android --clean --no-install
cd android && SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
adb install -r -g app/build/outputs/apk/release/app-release.apk
```
