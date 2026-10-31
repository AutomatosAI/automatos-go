# Google Play Console: Data safety answers

The exact answers for Play Console → Automatos Go → App content → Data safety, for when a Play
Console exists [D10] (OT-R15). Android testers for WebSummit install the EAS preview APK by link and
need none of this.

The same answers are data in [`privacy-labels.json`](privacy-labels.json) (`play` and
`playSecurity`). `src/release/__tests__/privacy-labels.test.ts` fails CI when this document's table
and the JSON differ, when Play and the App Store answers disagree, and when an answer stops matching
the code.

## Before you start

- Answer for the whole app, its SDKs included (Clerk, Expo, Sentry; LiveKit once Auto Live ships),
  and for both ways it works: hosted Studio and a server of the person's own. Google's exceptions
  are on-device processing, end-to-end encryption and ephemeral processing; data the app sends to a
  server the person chose is not exempt (privacy draft, Appendix A).
- **Shared is No for every type.** The recipients (Clerk, Expo, Retell, Sentry, Anthropic and the
  other model providers) act for Automatos as service providers, which Google does not count as
  sharing. A workspace's own provider key is used at the person's direction.

## Data collection and security

1. "Does your app collect or share any of the required user data types?" → **Yes**.
2. "Is all of the user data collected by your app encrypted in transit?" → Gerard chooses before the
   first Play submission. The app can talk plain HTTP to a server on a private network, so the
   honest answer depends on whether that lane ships:
   - **No**, while the plain-HTTP lane ships. A person may pair with their own server at `http://`
     on a private address (192.168.x, 10.x, 172.16–31.x, `.local`); the app shows a lasting "not
     encrypted" note, and the build allows it (Android `usesCleartextTraffic: true` through
     `expo-build-properties`; iOS `NSAllowsLocalNetworking`). Data sent to that server travels
     unencrypted, and Google does not exempt a server the person chose. Evidence:
     `src/connect/address.ts`, `src/connect/config.ts`, `app.json`.
   - **Yes**, only if the plain-HTTP lane is removed before the Play submission: the connect wave's
     `http://` rule for private addresses and Android's `usesCleartextTraffic` (a native change).
     Every other request is HTTPS.

   The test refuses "Yes" while `app.json` still sets `usesCleartextTraffic: true`.
3. Account creation → The app does not allow users to create an account. Sign-in is with an account
   made in Studio on the web, or with a pairing code from a server's operator. The app has no
   sign-up and no pointer to one [D64] (`src/connect/screens/WelcomeScreen.tsx`,
   `src/auth/screens/SignInScreen.tsx`).
4. "Do you provide a way for users to request that their data is deleted?" → **Yes**:
   https://automatos.app/privacy, section 13 "Keeping and deleting your data". A login is deleted on
   request through the contact form at https://automatos.app/contact or privacy@automatos.app;
   workspace content is erased by its owner in Studio. The app itself deletes nothing [D63].

## Data types

Every type the form lists, in its order. For each collected type the form asks whether it is
collected, shared or both, whether it is processed ephemerally, whether it is required or optional,
and why it is collected. "—" marks a question the form does not ask, because the type is not
collected. Purposes are separated by ";".

| Category | Data type | Collected | Shared | Processed ephemerally | Required or optional | Purposes | Why |
|---|---|---|---|---|---|---|---|
| Location | Approximate location | No | No | — | — | — | No location permission; photos lose their metadata; only the time zone is sent. |
| Location | Precise location | No | No | — | — | — | As Approximate location. |
| Personal info | Name | Yes | No | No | Required | Account management | The account's name in the hosted session token (Clerk's 'mobile' JWT template). |
| Personal info | Email address | Yes | No | No | Required | App functionality; Account management | Typed at hosted sign-in and sent to Clerk. |
| Personal info | User IDs | Yes | No | No | Required | App functionality; Account management | The Clerk and Automatos user ids in the session token; the paired device token on an own server. |
| Personal info | Address | No | No | — | — | — | Never asked for. |
| Personal info | Phone number | No | No | — | — | — | Sign-in asks for an email address, never a phone number. |
| Personal info | Race and ethnicity | No | No | — | — | — | Never asked for. |
| Personal info | Political or religious beliefs | No | No | — | — | — | Never asked for. |
| Personal info | Sexual orientation | No | No | — | — | — | Never asked for. |
| Personal info | Other info | No | No | — | — | — | No date of birth, gender or other personal details are asked for. |
| Financial info | User payment info | No | No | — | — | — | Nothing is sold or paid for in the app (D8). |
| Financial info | Purchase history | No | No | — | — | — | Nothing is sold in the app (D8). |
| Financial info | Credit score | No | No | — | — | — | Never asked for. |
| Financial info | Other financial info | No | No | — | — | — | Never asked for. |
| Health and fitness | Health info | No | No | — | — | — | No Health Connect and no health permission. |
| Health and fitness | Fitness info | No | No | — | — | — | No activity or fitness data is read. |
| Messages | Emails | No | No | — | — | — | The app reads and sends no email. |
| Messages | SMS or MMS | No | No | — | — | — | The app reads and sends no SMS or MMS. |
| Messages | Other in-app messages | Yes | No | No | Optional | App functionality | Messages to Auto and Auto's replies; Auto Live transcripts once it ships. |
| Photos and videos | Photos | Yes | No | No | Optional | App functionality | Photos the person takes or picks to attach, through the system photo picker (no media permission), re-encoded with no metadata first. |
| Photos and videos | Videos | No | No | — | — | — | The camera and the photo picker ask for images only, and the server's attachment allow-list has no video type. |
| Audio | Voice or sound recordings | Yes | No | No | Optional | App functionality | Auto Live sends the person's voice to Retell during a call (not built on the merged base yet; declared for its release). Quick-ask audio stays on the phone. |
| Audio | Music files | No | No | — | — | — | The server's attachment allow-list has no audio type. |
| Audio | Other audio files | No | No | — | — | — | The server's attachment allow-list has no audio type. |
| Files and docs | Files and docs | Yes | No | No | Optional | App functionality | Files the person picks in Files to attach to a message (PDF, Office documents, text). |
| Calendar | Calendar events | No | No | — | — | — | The phone's calendar is never read: the Command Centre calendar is the workspace's, from the server, and expo-localization's getCalendars() reads only the time zone. |
| Contacts | Contacts | No | No | — | — | — | No contacts access: app.json blocks READ_CONTACTS and WRITE_CONTACTS. |
| App activity | App interactions | Yes | No | No | Required | App functionality | The phone's last-seen time on its device record. No taps, screens or navigation are recorded (KR7). |
| App activity | In-app search history | No | No | — | — | — | The app has no search that is sent anywhere. |
| App activity | Installed apps | No | No | — | — | — | The app never lists or queries other apps. |
| App activity | Other user-generated content | Yes | No | No | Optional | App functionality | Answers, approvals, ticket and social-post notes, a thumbs up or down on the day's brief, and Report this (reason and note). |
| App activity | Other actions | Yes | No | No | Optional | App functionality; Fraud prevention, security, and compliance | The person's actions (answers, approvals, pausing a routine) in the workspace audit log. |
| Web browsing | Web browsing history | No | No | — | — | — | Links open in the system browser; the app records no browsing. |
| App info and performance | Crash logs | Yes | No | No | Optional | App functionality | Scrubbed crash and error reports to Sentry in the EU; Settings → Privacy & legal → Send crash reports turns them off (on by default). |
| App info and performance | Diagnostics | Yes | No | No | Required | App functionality | App version, platform, phone model, language and time zone on the phone's device record. |
| App info and performance | Other app performance data | No | No | — | — | — | No tracing, no app-start, frame or stall measurements, no profiler (KR7). |
| Device or other IDs | Device or other IDs | Yes | No | No | Required | App functionality | The random install id, the Expo push token and the EAS Update installation id. No advertising id. |

"Required" means the person cannot use the app without it. Name, email address and user IDs are
required on hosted Studio; a phone paired with an own server sends a device token instead of an
account's name and email, but the form has one answer per type, so they stay Required. Crash logs
are Optional because Settings → Privacy & legal → Send crash reports turns them off (it is on by
default).

## Changes from the privacy draft's Appendix A.2

The draft (`reports/mobile-review-2026-10-20/drafts/privacy-policy-automatos-go.md`, read only)
left these rows open. Wave A7 answers them from the code as built:

- **Crash logs**: Required [CHECK] → Optional. The crash-report switch shipped (US-021c, US-021d).
- **App interactions**: kept Yes, Required, for the phone's last-seen time only. The draft's "crash
  breadcrumbs if on" no longer applies: no touch, screen or navigation breadcrumbs are kept
  (US-021b).
- **Voice or sound recordings**: Ephemeral [CHECK] → No, until Retell confirms its audio retention
  is off [D53]. Gerard may then answer Yes.
- **Videos**: added as an explicit No. The draft listed Photos only; the pickers ask for images and
  the server's attachment allow-list has no video type.
- Encrypted in transit and account creation (the security questions above): both left [CHECK] in
  the draft. Account creation is answered by D64; encrypted in transit is Gerard's choice, with both
  honest answers written out.

## Notes for Gerard

- **App interactions versus Apple's Product Interaction.** The App Store answer is No: Apple's
  examples are launches, taps and scrolling, and the app records none of them. Play's App
  interactions is kept Yes for the last-seen time the server stamps on the phone's record, which
  Apple files under Other Usage Data. Answering No here would also be defensible; Yes is the
  cautious answer.
- **Audio before Auto Live.** Auto Live is not built on the merged base, so today no audio leaves
  the phone. The row is declared for the Auto Live release, as on the App Store.
- **The deletion page.** Google wants a page that names the app and gives the steps. The privacy
  policy's section 13 does once it is published with `privacy-facts.md` applied (OT-R3); a
  dedicated page would be clearer.
