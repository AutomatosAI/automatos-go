# Android spike: the first local builds (1 Nov 2026)

The first time Automatos Go was built for Android. A local spike on branch `spike/android-local`, run by
Dave on his own machine at his request. It is an exception to this repo's rule that nothing native runs
locally (CLAUDE.md, "The rule"): `expo prebuild` and Gradle ran here, on emulators. Nothing native is
committed: `android/` stays gitignored.

## Result

A release APK of Automatos Go builds for `arm64-v8a` and runs on Android 17 and Android 16 emulators: the
first screen, the "Connect to your own server" screen, and a discovery request to a local server over plain
HTTP. Nothing was tried on a real phone.

| Build        | compileSdk / targetSdk                 | Gradle memory                                                                   | Result                                                                                                                                                                                    |
| ------------ | -------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A, first try | 36 / 36 (React Native 0.81's defaults) | Expo template: `-Xmx2048m -XX:MaxMetaspaceSize=512m`                            | Failed after 1,131 tasks: Metaspace ran out in `expo-updates:kspReleaseKotlin`, `expo-dev-menu:lintVitalAnalyzeRelease` and `expo-modules-core:lintVitalAnalyzeRelease`. No compile error |
| A, retry     | 36 / 36                                | `-Xmx8g -XX:MaxMetaspaceSize=2g` on the command line                            | Built                                                                                                                                                                                     |
| B            | 37 / 37, build-tools 37.0.0            | `plugins/with-gradle-memory.js`                                                 | Built; ran on both emulators                                                                                                                                                              |
| C            | **37 / 36**, build-tools 37.0.0        | EAS's medium-worker default, `-Xmx4g -XX:MaxMetaspaceSize=1g`, every task rerun | Built, every one of 1,273 tasks rerun; runs on Android 17                                                                                                                                 |

Build times aren't comparable: A's first try filled the Gradle cache that the later builds reused. Every
APK is 93 MB, signed with the template's debug key.

| Check                                                                  | Result                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 16 KB page size (Google Play requirement)                              | Builds A, B and C: the APK is zip-aligned for 16 KB, and all 32 native libraries have 16 KB ELF LOAD alignment (WebRTC, Skia, MMKV, Hermes and the rest)                                                                                                                                                                                                     |
| Android 17 emulator: Pixel 10, API 37.2, Play Store image, 16 KB pages | Builds B and C run. Cold start 784 ms (B) and 388 ms (C). No crash, no JavaScript error                                                                                                                                                                                                                                                                      |
| Android 16 emulator: Pixel 8, API 36, Play Store image                 | Build B runs (cold start 8.7 s, on a host running three emulators)                                                                                                                                                                                                                                                                                           |
| Network                                                                | `GET /.well-known/automatos.json` to the local edition at `http://10.0.2.2:8000` (the emulator's alias for the host) returned 200; the app showed the server's "not taking phones yet" answer (`LOCAL_REMOTE_ACCESS` off). A real home-network address wasn't tried                                                                                          |
| Permissions in build B's APK                                           | None of `app.json`'s `blockedPermissions`. Beyond the allowed list, from Gradle dependencies: `READ_APP_BADGE` and launcher badge permissions (`me.leolin:ShortcutBadger` through `expo-notifications`), Google Play's install-referrer service (`com.android.installreferrer` through `expo-application`), and `REORDER_TASKS` (`androidx.test:core` 1.7.0) |

### Build C

Build C is the branch as it stands: compileSdk 37, targetSdk 36 and `REORDER_TASKS` blocked. It ran with
the Gradle memory an EAS medium worker passes (`-Xmx4g -XX:MaxMetaspaceSize=1g
-XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8`, on the command line, which overrides
`gradle.properties` as EAS does) and `--rerun-tasks`, so the lint and KSP tasks that ran out of Metaspace
at 512 MB ran again. It built. So EAS's defaults are very likely enough, and `GRADLE_OPTS` is a fallback,
not a fix to make first. One local build is the evidence; the first EAS Android build is the proof.

- APK: `targetSdkVersion` 36, `compileSdk` 37, no `REORDER_TASKS`, zip-aligned for 16 KB, all 32 libraries
  16 KB-aligned.
- Sentry: with no `SENTRY_AUTH_TOKEN` and no `SENTRY_DISABLE_AUTO_UPLOAD`, the release build skipped
  `createBundleReleaseJsAndAssets_SentryUpload_*`. `plugins/with-sentry-upload-guard.js` works on Android.
- Android 17 emulator: cold start 388 ms, no crash, no JavaScript error.

Running three emulators and a full Gradle build on a 16 GB Mac swapped heavily: the Android 17 emulator
hung twice ("Process system isn't responding", then QEMU's CPU threads stopped). Run one emulator during a
build.

## Pairing (build C, Android 17)

The local edition in `paired` mode (`LOCAL_REMOTE_ACCESS=paired`), a code from
`python -m scripts.mint_pairing_code`, and the address `http://10.0.2.2:8000` typed into "Connect to
your own server":

- The "Pair with this server?" card showed the edition, the address and the unencrypted-network warning,
  and paired nothing before **Pair**. `POST /api/v1/mobile/pair` returned 200.
- The AI notice listed the server's providers (AWS Bedrock, Claude Code, OpenRouter).
- The app then loaded the paired workspace: chat history, tasks, agents, "needs you", suggestions,
  notifications, and the installed themes. It drew the workspace's chosen theme (Arcade, with the
  member's saved look) from the phone block.
- `POST /api/proactive/brief/open` answered `404 brief_off`, as designed while Proactive Auto is off.

On the emulator's default GPU mode (host OpenGL), the app crashed on its first home screen: a SIGSEGV in
`libEGL_emulation.so` (`createNativeSync` inside `eglSwapBuffers`), with React Native Skia's
`OpenGLWindowContext::present()` as the caller. The emulator warns at boot that API 37 needs GLES 3.1
and that hardware OpenGL is deprecated on macOS. With `-gpu swiftshader_indirect` the same build runs
the paired home screen without a crash. So this is the emulator's GL driver, not the app, but Skia on
real Android GPUs is still worth a real-device check.

## The keyboard

With the composer open (Arcade's TYPE), the on-screen keyboard covered the message box: typing went
in, out of sight. The Sheet moved for the keyboard on iOS only. `useKeyboardHeight` listened for
`keyboardWillShow` / `keyboardWillHide`, which only iOS sends, and the Sheet's `KeyboardAvoidingView`
had no behaviour on Android, on the assumption that Android resizes the window for the keyboard. It
doesn't here: React Native 0.81 draws edge to edge (`edgeToEdgeEnabled`). The fix listens for
`keyboardDidShow` / `keyboardDidHide` on Android and gives the Sheet `padding` on both platforms; with
it, the box sits above the keyboard and a message sends and gets Auto's answer.

Return in the box inserts a new line on both platforms by design (PRD-001 US-009a, D-COMPOSER); the
send button sends.

`ChatFrame`, `FirstOpen`, `CandyHome` and `PlayHome` had the same iOS-only `KeyboardAvoidingView`
behaviour. Every one now takes `KEYBOARD_AVOIDING_BEHAVIOUR` ('padding') from `use-keyboard-height.ts`,
and `src/ui/__tests__/sheet-keyboard.test.ts` fails on any `KeyboardAvoidingView` in `src/` or `app/`
that doesn't. `PinnedSuggestion` shrinks to one line while the keyboard is up through
`useKeyboardHeight`, so it now does that on Android too. Checked on Android 17 with the on-screen
keyboard, typing into each style's message box:

| Style  | Where                             | Result                                      |
| ------ | --------------------------------- | ------------------------------------------- |
| Studio | the home's thread (`ChatFrame`)   | box above the keyboard                      |
| Play   | the home, a new chat (`PlayHome`) | box above the keyboard                      |
| HUD    | TYPE (`Sheet`)                    | box above the keyboard                      |
| Arcade | TYPE (`Sheet`)                    | box above the keyboard; sent, Auto answered |
| Candy  | Chat (`CandyHome`)                | box above the keyboard                      |

`FirstOpen`'s whole screen isn't mounted anywhere yet (Play shows its hello inside `PlayHome`), so it
was changed to match but not seen. Candy's box first sat about 52 dp above the keyboard:
`CandyComposer` padded by the home indicator's inset plus its own 28 inside the lift, and the keyboard
already covers the inset. It now pads through `useKeyboardSafeBottom` (the Sheet's rule: the inset
only while the keyboard is down) and sits its own 28 above the keyboard. The guard test fails on any
file with a `TextInput` that reads the raw bottom inset; CLAUDE.md's Traps carry the rule.

The threads also kept their scroll place as the keyboard shrank them, so the newest replies slid
under the box and the top of a bubble peeked above it (Studio's, Play's and Candy's threads scroll to
the end only when a row is added). `use-end-in-view.ts` now follows a shrink while someone is at the
end (someone scrolled back up stays put), to the content's foot: FlatList's `scrollToEnd` stops at
the last row, short of the thread's bottom padding. HUD's transcript already followed its end.

A new row (a sent message, Auto's writing chip) now scrolls to the content's foot too: the three
lists' own scroll-on-add helpers, each on `scrollToEnd`, are folded into `use-end-in-view.ts`. When
the message box grows a line, the layout event can arrive before the native list has its new height,
and Android clamps the scroll to the old end; the hook scrolls again a frame later. A reply that grows
taller than the writing chip still ends flush with the box: the threads never scroll while a reply
grows (the handoff's 'Interactions'), which is Gerard's call.

The emulator's own keyboard: the AVDs were made with `hw.keyboard=no`, so the Mac's keyboard typed
nothing. With `hw.keyboard=yes` in the AVD's `config.ini` and
`adb shell settings put secure show_ime_with_hard_keyboard 1`, the Mac's keyboard types and the
on-screen one still shows.

## Changes on this branch

- `app.json`, `expo-build-properties`: `compileSdkVersion` 37 and `buildToolsVersion` "37.0.0"
  (Android 17), from React Native 0.81.5's 36 and 36.0.0; `targetSdkVersion` stays 36, Google Play's
  requirement. React Native 0.81.5 pins 36, so compiling against 37 is past what it was tested with.
- `app.json`: `REORDER_TASKS` blocked, with its reason in `docs/release/android-permissions.json` and the
  expected list in `src/config/__tests__/store-rules.ts`. The badge permissions stay: the app sets the
  badge count. The install-referrer service stays for now: the app never calls `getInstallReferrerAsync`,
  so blocking it is a choice to make, not a fix.
- `plugins/with-gradle-memory.js` and its test: raises the heap and Metaspace on the
  `org.gradle.jvmargs` line, keeping its other flags, for local builds. EAS ignores it: its workers pass
  their own `org.gradle.jvmargs`, which override `gradle.properties`. On EAS the lever is `GRADLE_OPTS` in
  the build profile's `env`.
- `docs/native-modules.md`: the plugin, the Android SDK levels, `REORDER_TASKS`, the merged manifest.
  CLAUDE.md's layout line names the new plugin.

Changing `app.json`'s `expo-build-properties` and adding a config plugin changes the iOS fingerprint as
well: landing this costs an iOS native build (CLAUDE.md, the fingerprint trap). Batch it with other native
changes.

## Why not targetSdk 37

Build B targeted 37 and ran, but targeting Android 17 turns on its behaviour changes
([Android 17 behaviour changes](https://developer.android.com/about/versions/17/behavior-changes-17)):

- `ACCESS_LOCAL_NETWORK` becomes a runtime permission the app must ask for. "Connect to your own server"
  on a home network needs it, and nothing in the app asks for it yet. iOS has the equivalent
  (`NSLocalNetworkUsageDescription`).
- On large screens (600 dp and wider), the app can no longer opt out of the system ignoring its
  orientation, resizing and aspect-ratio limits, so `orientation: "portrait"` stops applying on tablets and
  foldables.
- Background audio is stricter. The app plays audio only while open (D33), but that is untested.

Google Play asks for target 36, so 37 gains nothing yet. Raising it is its own change, with
`ACCESS_LOCAL_NETWORK` asked for and large screens checked first.

## Not tested yet

- Signing in with Clerk: this build has no `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` ("Sign-in is not configured
  in this build").
- Push (needs a Firebase project and `google-services.json`), answering from a notification while the app is
  closed, App Links verification (needs the signing key's SHA-256 in `assetlinks.json`), passkeys, voice
  (speech recognition, the spoken reply, LiveKit), the camera QR scanner, TalkBack, tablets, and real phones.
- `armeabi-v7a`, `x86` and `x86_64` builds (this spike built `arm64-v8a` only), an AAB for Play, and an EAS
  Android build.

## The screens (Arcade, Android 17)

Opened by deep link: home, the Command Centre's Board, Calendar, Questions and Deliverables, Chats,
Notifications, Settings, Settings → Notifications and Voice, and the voice screen. Each drew the
paired workspace's data; no JavaScript error was logged.

- **Fixed:** Settings → Notifications and the approval hints said "Face ID". Android's prompt takes a
  fingerprint, a face or the screen lock, so the copy now names those there (`check-copy.android.ts`;
  the iPhone's copy is unchanged).
- **As designed:** Settings → Voice names Google's on-device voices from their codes ("Voice IOB
  (en-US)", `voiceName`): Android gives them no friendly names.
- **Not Android's:** in Arcade, Chats' and Notifications' titles are cut short ("Conversation…",
  "Notificat…") beside their header buttons. The pixel face is wide; a 390 pt iPhone is narrower
  still.

## Next

1. Check Skia's drawing on a real Android phone.
2. Decide on the install-referrer service: block it, or keep it and say why in the Data Safety work.
3. With the Play Console and Firebase set up: push, App Links, and the first EAS Android build. If it runs
   out of Metaspace, set `GRADLE_OPTS` in `eas.json` (docs/native-modules.md, "Gradle memory").

## Reproduce

Android SDK with platform `android-37.0`, build-tools 37.0.0, the image
`system-images;android-37.2;google_apis_playstore_ps16k;arm64-v8a`, JDK 17 and Node 22 (`.nvmrc`).

```bash
npm ci
CI=1 npx expo prebuild --platform android --clean --no-install
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
adb install -r -g app/build/outputs/apk/release/app-release.apk
```

The 16 KB checks, from `android/`, with build-tools 36 or later and the NDK the build installed:

```bash
APK=app/build/outputs/apk/release/app-release.apk
"$ANDROID_HOME/build-tools/37.0.0/zipalign" -c -P 16 -v 4 "$APK" | tail -1
READELF=$(ls "$ANDROID_HOME"/ndk/*/toolchains/llvm/prebuilt/*/bin/llvm-readelf | tail -1)
mkdir -p /tmp/apk-libs && unzip -qo "$APK" 'lib/*' -d /tmp/apk-libs
for so in /tmp/apk-libs/lib/*/*.so; do
  echo "$("$READELF" -lW "$so" | awk '$1=="LOAD"{print $NF}' | sort -u | head -1) $(basename "$so")"
done | grep -vE '^0x(4000|10000) ' || echo "every library is 16 KB-aligned"
```
