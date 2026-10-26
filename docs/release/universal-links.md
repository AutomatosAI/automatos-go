# Universal links and App Links (OT-R9)

A link to a chat or to the Command Centre on ui.automatos.app opens Automatos Go instead of the
browser when the phone has the app (R18). It takes two halves that must agree:

- **The app's half** is `app.json`: `ios.associatedDomains` and the Android intent filter with
  `autoVerify: true`. It is baked into each native build.
- **The server's half** is automatos-ai's frontend on ui.automatos.app, which serves
  `/.well-known/apple-app-site-association` (iOS) and `/.well-known/assetlinks.json` (Android),
  signed out, as 200 `application/json` with no redirect (PRD-266 W3 US-018c,
  `frontend/lib/universal-links.ts`).

One value is missing: the SHA-256 of the certificate that signs the Android app. Until it is set,
`assetlinks.json` lists nothing and Android opens these links in the browser. iOS needs nothing
more. Requirement R18 and owner step OT-R9 in [README.md](README.md).

## The values

[association.json](association.json) records them; automatos-ai origin/main 10c59c259 serves them.

| Platform | Value |
|---|---|
| iOS app ID | `KGVA9933BG.com.automatos.app` (Apple team `KGVA9933BG`, bundle id `com.automatos.app`) |
| iOS domains | `applinks:ui.automatos.app`; `webcredentials:clerk.automatos.app` (passkeys, served by Clerk) |
| iOS paths | `/go/*`, `/command-center`, `/command-center/*`, `/chat`, `/chat/*` |
| Android package | `com.automatos.app` |
| Android filter | `https://ui.automatos.app`, path prefixes `/go`, `/command-center`, `/chat`, auto-verified |
| Android fingerprints | the frontend service's `ANDROID_APP_SHA256_CERT_FINGERPRINTS`: **owner, step 1** |

[src/release/\_\_tests\_\_/association.test.ts](../../src/release/__tests__/association.test.ts)
fails CI when `app.json` and association.json disagree: the iOS domains, the app ID against the
bundle id and `eas.json`'s Apple team, the Android package, the one verified filter's host and
path prefixes, and that every link one phone opens the other opens too. It also fails when this
page stops naming a value. The server's own test (automatos-ai
`frontend/app/__tests__/prd266-universal-links.test.ts`) holds the files it serves to the same
values. A change to the app's half is a native change (a new iOS build); a change to the
server's half needs no app build.

What a tapped link opens is `src/navigation/web-links.ts`'s mapping, the same one links inside
the app use: `/chat` opens Home, `/chat?chatId=<id>` that conversation, `/command-center` the
Board, `/command-center?tab=questions` Questions, `/go/pair` the pairing screen. ui.automatos.app
has no page under `/chat/` or `/command-center/` today (automatos-ai `frontend/app` @ 10c59c259);
those components are the server's, kept for later pages, and a path the app has no screen for
shows its Lost screen. Android's `pathPrefix` is a plain string prefix, so `/chat` also matches
`/chats`: no page on ui.automatos.app starts with `/go`, `/chat` or `/command-center` other than
these, and a new one that does would open in the app on Android.

## 1. Read the Android signing certificate's SHA-256

Under Node 22 (the repo's `.nvmrc`), signed in to EAS (`npx --yes eas-cli@latest login` once):

```sh
npx --yes eas-cli@latest credentials -p android
```

Choose the `preview` build profile (the APK the Android testers install), then the application
identifier `com.automatos.app`. Under **Keystore**, copy the **SHA256 Fingerprint**: 32 pairs of
hexadecimal digits separated by colons. Write it in upper case (`AB:CD:…`); the server drops any
other spelling without an error.

- No keystore listed: no Android build has run yet. The first EAS Android build of the
  `preview` profile generates one; come back after it. Do not generate or upload one by hand
  for this step.
- If another profile shows a different keystore, copy its fingerprint too: every certificate an
  installed APK can carry goes in the list.

The fingerprint is a public value (anyone can read it from the APK or from `assetlinks.json`),
not a secret.

## 2. Set it on the automatos-ai frontend service

Railway → the automatos-ai project → the **frontend** service → Variables:

```text
ANDROID_APP_SHA256_CERT_FINGERPRINTS=AB:CD:…:EF
```

Several certificates go comma-separated, in one value. Deploy the staged change: Railway applies
a variable only on a deploy. The route reads the variable on every request, so no code changes.

Then record the value in this repository: in [association.json](association.json), replace
`"OWNER — OT-R9"` with the list, `["AB:CD:…:EF"]`, in a pull request. The test checks its
spelling.

## 3. Check what the server serves

Status, type and redirect, for both files:

```sh
for f in apple-app-site-association assetlinks.json; do
  curl -sS -o /dev/null -w "$f %{http_code} %{content_type} redirect=[%{redirect_url}]\n" \
    "https://ui.automatos.app/.well-known/$f"
done
```

Each line ends `200 application/json redirect=[]`. A 3xx or a sign-in page means the frontend's
middleware is not letting the path through signed out; a 404 means the deployed frontend
predates PRD-266 W3. Apple and Google never follow a redirect for these files.

The iOS file:

```sh
curl -fsS https://ui.automatos.app/.well-known/apple-app-site-association | jq -c .
```

prints exactly:

```json
{"applinks":{"details":[{"appIDs":["KGVA9933BG.com.automatos.app"],"components":[{"/":"/go/*"},{"/":"/command-center"},{"/":"/command-center/*"},{"/":"/chat"},{"/":"/chat/*"}]}]}}
```

The Android file:

```sh
curl -fsS https://ui.automatos.app/.well-known/assetlinks.json | jq .
```

shows one statement: `relation` `["delegate_permission/common.handle_all_urls"]`, `target`
`namespace` `android_app`, `package_name` `com.automatos.app`, and `sha256_cert_fingerprints`
your list. `[]` means the variable is unset or every value in it was malformed: recheck step 2.

**Apple's CDN copy.** iPhones do not fetch the file from ui.automatos.app; they ask Apple's CDN,
which fetches and caches it:

```sh
curl -fsS https://app-site-association.cdn-apple.com/a/v1/ui.automatos.app | jq -c .
```

shows the same app ID and components. The CDN refreshes on Apple's schedule and can lag the
server; an iPhone reads it when the app is installed or updated, so reinstall the TestFlight build
on a phone that installed it before the CDN showed the right file.

**Google's copy.** Google's Digital Asset Links statements API reads what Android's verifier
reads:

```sh
curl -fsS 'https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://ui.automatos.app&relation=delegate_permission/common.handle_all_urls' | jq .
```

lists a statement whose `target.androidApp.packageName` is `com.automatos.app` and whose
`certificate.sha256Fingerprint` is each fingerprint from step 1.

**Clerk (passkeys only, not the tap test).** `webcredentials:clerk.automatos.app` works once the
iOS app is registered in Clerk's dashboard → Native applications (docs/native-modules.md
'Passkeys setup'):
`curl -fsS https://clerk.automatos.app/.well-known/apple-app-site-association | jq .webcredentials`
lists `KGVA9933BG.com.automatos.app`.

## 4. Tap a /chat and a /command-center link on each phone

On a phone signed in to hosted Studio, with a build installed after step 3 passed. Put these two
links where a tap opens them, such as a note or a message to yourself:

- `https://ui.automatos.app/chat`
- `https://ui.automatos.app/command-center`

**iPhone.** Tap each in Notes or Messages. Automatos Go opens, at Home for `/chat` and at the
Board for `/command-center`. Typing the address into Safari, or tapping a link on a
ui.automatos.app page, never opens an app: that is iOS, not a failure. If Safari opens instead,
long-press the link: an "Open in Automatos Go" entry means the association works and an earlier
choice sent the link to Safari (choose the entry once); no such entry means it failed: recheck
step 3, then reinstall the app.

**Android.** Tap each in Messages, Gmail or Keep. The app opens directly, with no "Open with"
chooser, at the same screens. Settings → Apps → Automatos Go → Open by default lists
ui.automatos.app as a verified link. Android verifies when the app is installed, so after a fix
reinstall the APK; with adb, `adb shell pm get-app-links com.automatos.app` shows the domain's
state (`verified` when it works), and `adb shell pm verify-app-links --re-verify
com.automatos.app` runs the check again.

| Phone | Build | `/chat` opens Home | `/command-center` opens the Board | Date | By |
|---|---|---|---|---|---|
| iPhone (TestFlight) | | | | | |
| Android (preview APK) | | | | | |

## When Play App Signing exists

Google re-signs every app it delivers from Play with its own app signing key, so an install from
Play carries that key's certificate, not EAS's. When the app has a Play Console listing (D10):
Play Console → Automatos Go → App integrity → App signing → the app signing key certificate's
**SHA-256 certificate fingerprint**. Add it to `ANDROID_APP_SHA256_CERT_FINGERPRINTS` after the
EAS one, comma-separated (keep the EAS one: the preview APK is still signed with it), and to
association.json's list. Redo steps 3 and 4 with an install from Play.

## When the Apple team changes

The app ID's prefix, `KGVA9933BG`, is the Apple team the app is signed under (`eas.json`'s
`appleTeamId`). At a transfer to an organisation team, the prefix changes to the new team's id,
and iOS stops opening these links in the app until the server lists the new app ID. Change it
together in:

- automatos-ai `frontend/lib/universal-links.ts` `IOS_APP_ID` (the file's `appIDs` is a list, so
  the old and the new app ID can be served side by side during the move);
- [association.json](association.json) `ios.appID` and `eas.json`'s `appleTeamId` (the test
  checks they agree);
- Clerk's dashboard → Native applications (the passkeys association);

then redo steps 3 and 4.

## Self-hosted installs

The association is ui.automatos.app's only. A self-hosted install's web address is not one of the
app's associated domains, so its links open in the browser; it serves the same two files, and
they do nothing there (W3 K14).
