# App Store Connect: App Privacy answers

The exact answers for App Store Connect → Automatos Go (`com.automatos.app`) → App Privacy. Gerard
enters them before the first external TestFlight build or App Review (OT-R2). Internal TestFlight for
WebSummit does not need them [D51].

The same answers are data in [`privacy-labels.json`](privacy-labels.json).
`src/release/__tests__/privacy-labels.test.ts` fails CI when this document's table and the JSON
differ, and when an answer stops matching the code (tracing switched on, tap breadcrumbs kept, a
user on crash events, a video picker, a location permission). US-021f holds the app's privacy
manifest (`app.json` → `expo.ios.privacyManifests`) to the same collected types.

## Before you start

- Answer for the whole app, its SDKs included (Clerk, Expo, Sentry; LiveKit once Auto Live ships),
  and for both ways it works: hosted Studio and a server of the person's own. Apple exempts neither:
  data the app sends to a server the person chose is still collected (privacy draft, Appendix A).
- **Privacy Policy URL** (App Privacy → Privacy Policy): https://automatos.app/privacy, the address
  the app opens from Settings → Privacy & legal and from Welcome (`src/release/legal-links.ts`, KR8).
  Leave "User Privacy Choices URL" empty.

## Step 1: Data collection

"Do you or your third-party partners collect data from this app?" → **Yes, we collect data from
this app.**

## Step 2: Data types

Tick these 11 types and no others (Collected = Yes in the table below):

- Contact Info: Name, Email Address
- User Content: Photos or Videos, Audio Data, Customer Support, Other User Content
- Identifiers: User ID, Device ID
- Usage Data: Other Usage Data
- Diagnostics: Crash Data, Other Diagnostic Data

## Step 3: Each data type

For each ticked type, App Store Connect asks three questions, in this order:

1. How the data is used: tick **App Functionality** only. Never Third-Party Advertising,
   Developer's Advertising or Marketing, Analytics, Product Personalization or Other Purposes.
   Apple's App Functionality covers authentication, features, security, crash minimisation and
   customer support.
2. Whether it is linked to the user's identity: the "Linked to you" column.
3. Whether it is used for tracking: always **No**.

The table has every type in the form's order. "—" marks a question the form does not ask, because
the type is not collected.

| Category | Data type | Collected | Purposes | Linked to you | Used for tracking | Why |
|---|---|---|---|---|---|---|
| Contact Info | Name | Yes | App Functionality | Yes | No | The app never asks for a name, but on hosted Studio every request carries the account's session token, minted from Clerk's 'mobile' JWT template, which holds name, first_name and last_name. |
| Contact Info | Email Address | Yes | App Functionality | Yes | No | Typed on the sign-in screen and sent to Clerk to sign in to hosted Studio. |
| Contact Info | Phone Number | No | — | — | — | Sign-in asks for an email address, never a phone number. |
| Contact Info | Physical Address | No | — | — | — | The app never asks for a postal address. |
| Contact Info | Other User Contact Info | No | — | — | — | No other contact details are asked for. |
| Health & Fitness | Health | No | — | — | — | No HealthKit or Health Connect: no health usage key and no health permission. |
| Health & Fitness | Fitness | No | — | — | — | No motion or fitness data is read; NSMotionUsageDescription is the notice for a bundled library the app never calls. |
| Financial Info | Payment Info | No | — | — | — | Nothing is sold or paid for in the app (D8). |
| Financial Info | Credit Info | No | — | — | — | Nothing is sold or paid for in the app (D8). |
| Financial Info | Other Financial Info | No | — | — | — | Nothing is sold or paid for in the app (D8). |
| Location | Precise Location | No | — | — | — | No location permission (app.json blocks Android's location permissions; iOS has no location usage key). Every photo is re-encoded before upload, so no EXIF GPS leaves the phone. The time zone is sent, never a place. Clerk keeps the IP address and an IP-derived city on hosted sign-in sessions, for its own session security; the app does not read or use it. |
| Location | Coarse Location | No | — | — | — | As Precise Location: no location permission, photos lose their metadata, only the time zone is sent; Clerk's IP-derived city on hosted sessions is Clerk's. |
| Sensitive Info | Sensitive Info | No | — | — | — | The app asks for no special-category data. |
| Contacts | Contacts | No | — | — | — | No contacts access: no contacts usage key; app.json blocks READ_CONTACTS and WRITE_CONTACTS. |
| User Content | Emails or Text Messages | No | — | — | — | The app reads and sends no email or SMS. Chat with Auto is declared as Other User Content. |
| User Content | Photos or Videos | Yes | App Functionality | Yes | No | Photos the person takes or picks to attach to a message for Auto: photos only (the camera and the photo picker ask for images; the server's attachment allow-list has no video type), re-encoded on the phone first. |
| User Content | Audio Data | Yes | App Functionality | Yes | No | Auto Live calls send the person's voice to Retell, over LiveKit, when the workspace can use Auto Live. Quick-ask audio is never sent to Automatos: it is recognised on the phone, except on iPhone for a language chosen in Settings → Voice other than the iPhone's own whose dictation model is not installed, where Apple's speech recognition processes it and the app receives only the text. Auto Live (A6 US-020a–e) is not built on the merged base: today no audio goes to Automatos or Retell; the row is declared for the Auto Live release, so neither the labels nor the privacy manifest change when it ships. |
| User Content | Gameplay Content | No | — | — | — | Not a game. |
| User Content | Customer Support | Yes | App Functionality | Yes | No | Report this on Auto's messages and Deliverables: the reason and an optional note, sent to the workspace (on hosted Studio also to Automatos's moderation inbox). |
| User Content | Other User Content | Yes | App Functionality | Yes | No | Messages to Auto, files attached from Files, answers to agents' questions (in the app and from a notification), approvals, ticket and social-post verdicts with their notes; Auto Live transcripts once it ships. |
| Browsing History | Browsing History | No | — | — | — | Studio and legal pages open in the system browser; the app records no browsing. |
| Search History | Search History | No | — | — | — | The app has no search that is sent anywhere. |
| Identifiers | User ID | Yes | App Functionality | Yes | No | The Clerk and Automatos user ids in the session token on hosted Studio; the paired device token on an own server. |
| Identifiers | Device ID | Yes | App Functionality | Yes | No | The random install id the app creates (on the phone's record at pairing and push registration), the Expo push token, and the EAS Update installation id in update checks. No advertising identifier. |
| Purchases | Purchase History | No | — | — | — | Nothing is sold in the app (D8). |
| Usage Data | Product Interaction | No | — | — | — | No analytics SDK. Crash reports keep no console, touch, click, input or navigation breadcrumbs, no user-interaction tracing and no session tracking (KR7), so no launches, taps or screens are recorded. |
| Usage Data | Advertising Data | No | — | — | — | No advertising and no advertising SDK. |
| Usage Data | Other Usage Data | Yes | App Functionality | Yes | No | The phone's last-seen time on its device record, and the person's actions (answers, approvals) in the workspace audit log. |
| Diagnostics | Crash Data | Yes | App Functionality | No | No | Crash and error reports to Sentry in the EU, scrubbed on the phone: no user, no IP address from the app (sendDefaultPii false; Sentry's IP setting is OT-R1), no chat, question or notification text. Settings → Privacy & legal → Send crash reports turns them off. A native crash event can carry Sentry's random installation id, which is not tied to the account. |
| Diagnostics | Performance Data | No | — | — | — | No tracing: tracesSampleRate 0 with the auto-performance, app-start, frames and stall tracers off and no profiler (KR7). |
| Diagnostics | Other Diagnostic Data | Yes | App Functionality | Yes | No | App version, platform, phone model, language and time zone on the phone's device record (pairing and push registration). |
| Surroundings | Environment Scanning | No | — | — | — | The camera scans a pairing QR code on the phone and nothing else; no AR or scene data. |
| Body | Hands | No | — | — | — | No hand tracking. |
| Body | Head | No | — | — | — | No head tracking. Face ID is checked by the phone; nothing about it is sent. |
| Other Data | Other Data Types | No | — | — | — | Nothing outside the types above. |

"Linked to you" is Yes wherever the data sits on a record tied to the account: the Clerk user, the
`users` row, or the phone's `mobile_devices` row. Crash Data is the one collected type that is not
linked. The scrubber removes the user from every event, the app attaches no IP address, and Sentry's
"Prevent storing of IP addresses" setting is OT-R1.

## Tracking: No

Automatos Go does not track anyone, so no type is "used for tracking" and the app needs no App
Tracking Transparency prompt. No data is used for advertising, combined with other companies' data
or shared with a data broker. There is no advertising identifier. The app has no analytics,
advertising, attribution or tracking SDK and no `NSUserTrackingUsageDescription`
(`src/release/__tests__/dependency-audit.test.ts`), and its privacy manifest says
`NSPrivacyTracking: false` with no tracking domains.

## Changes from the privacy draft's Appendix A.1

The draft (`reports/mobile-review-2026-10-20/drafts/privacy-policy-automatos-go.md`, read only)
left these rows open. Wave A7 answers them from the code as built:

- **Product Interaction**: [CHECK] → No. The draft said Yes if Sentry breadcrumbs record taps and
  screens. Console, touch, click, input and navigation breadcrumbs are dropped, and user-interaction
  tracing and session tracking are off (US-021b, `src/observability/`).
- **Crash Data**: Linked No [CHECK] → No. Events carry no user (`scrubEvent`) and no IP address from
  the app (`sendDefaultPii: false`). Sentry's IP setting stays an owner step (OT-R1).
- **Performance Data**: [CHECK] → No. `tracesSampleRate` is 0, the auto-performance, app-start,
  frames and stall tracers are off, and no profiler is installed.
- **Precise Location** and **Coarse Location**: No [CHECK] → No. Every photo is re-encoded before
  upload, so no EXIF GPS is sent (A2 US-009b; US-021i audits it app-wide). The build has no
  location permission or usage key. Clerk's IP-derived city on hosted sign-in sessions is Clerk's
  session record, which the app neither reads nor uses: see the notes.
- **Emails or Text Messages**: [CHECK] → No. Chat with Auto is Other User Content, as the draft
  suggested.

Every other row keeps the draft's answer. Other Diagnostic Data now also names the phone model,
which push registration sends (`src/push/registration/device-facts.ts`); the answer is unchanged.

## Notes for Gerard

- **Audio Data before Auto Live.** Auto Live (A6 US-020a–e) is not built on the merged base, so
  today no audio goes to Automatos or Retell: quick-ask sends only the recognised text. On iPhone, a
  language chosen in Settings → Voice other than the iPhone's own is recognised by Apple's speech
  recognition when its dictation model is not installed (Apple processes that audio and the app
  receives only the text; Gerard, 27 Oct 2026). Audio Data
  is declared now so that neither these answers nor the privacy manifest (a native change) move when
  Auto Live ships. Until then the label over-states this build; it never under-states it. If you
  would rather answer No until Auto Live ships, change `privacy-labels.json` first: the test then
  asks for this table and the manifest to follow, and the manifest change costs an iOS build.
- **Clerk's sessions.** On hosted sign-in, Clerk records the IP address, the device type and an
  IP-derived city on each session, for its own session security. That is Clerk's record of a
  sign-in, not location data the app collects. The privacy draft's section 08 lists Clerk's
  session details (IP address, device type) among what Clerk receives.
- **Native crash events.** A crash written by the iOS or Android Sentry SDK can carry Sentry's own
  random installation id. It is not tied to the account, so Crash Data stays "not linked". OT-R1
  checks the first native event.
- **Name.** The app never asks for a name. On hosted Studio, the session token it sends with every
  request is minted from Clerk's `mobile` JWT template, which holds the account's name. That is why
  Name is collected and linked.
- **When the app changes.** If a later change alters what the app sends, update
  `privacy-labels.json` first. The test then names each line of this document that no longer
  matches, and App Store Connect needs the new answers before the next submission.
