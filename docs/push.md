# Notifications, Face ID and Remove this phone

What makes a phone buzz, how the phone registers and checks each notification, what a person can
do from one, and where each setting lives.

## Status (24 Oct 2026)

**The app side is on a branch, not merged.** The server side (W2) merged into automatos-ai `main`
late on 24 Oct as #1300 (`bd0e60b2b`). This page was written from the W2 branch at `c1577f457`.
Checked against the merge: in the files W2 changed, `main` differs from `c1577f457` only in the
pairing QR's console warning (`frontend/components/settings/phones-devices/pair-phone-qr.tsx`),
`mobile_theme` back in discovery's `CAPABILITY_ROUTES` (the branch at `c1577f457` had dropped it),
and two tests.

| Part | Where | State |
|---|---|---|
| App side | automatos-go `feat/a4-push` at `64eb2b5` | Built. PR #12 open (ready for review), CI green |
| Server side | automatos-ai `main`, #1300 (`bd0e60b2b`) | Merged 24 Oct |

The app shows notifications only when discovery lists the `push` capability **and**
`push.expo: true` ([src/api/capabilities.ts](../src/api/capabilities.ts), `canPush`). automatos-ai
`main` lists `push` and `digest` (`CAPABILITY_ROUTES` in `orchestrator/services/mobile/discovery.py`).
`push.expo` is always true on SaaS and, on a self-hosted install, only once its operator agreed
(`orchestrator/services/push/consent.py`, `expo_push_allowed`). The daily digest also needs
`digest`.

A4 adds no native module: `expo-notifications` and `expo-local-authentication` are already in the
build, and the iOS background mode is `remote-notification` ([app.json](../app.json)). So A4 ships
as an over-the-air update.

Paths below marked `A4:` are on `feat/a4-push`; `W2:` are automatos-ai's, on `main` since #1300.

## The path of one notification

```
 automatos-ai                                                         the phone
 event (question_pending, review_pending, auto_message, ...)
   -> in-app notification row
   -> fan-out: who, which phones, their switches            (W2: services/push/fanout.py)
   -> signed v2 payload, one per phone                      (W2: services/push/payload.py)
   -> POST https://exp.host/--/api/v2/push/send             (W2: services/push/expo.py)
        -> Apple (APNs) or Google (FCM) -> the phone
                                             -> parse, then verify sig with this phone's push_key
                                             -> unverified: show nothing, do nothing
                                             -> verified: banner; Reply / Open / tap
                                                -> stale check -> the record's screen
```

## What sends a push (server, W2)

Only these events push (`W2:orchestrator/services/push/payload.py`, `PUSH_TYPE_EVENTS`):

| Push type | Events | Who gets it | Android channel |
|---|---|---|---|
| `needs_answer` | `question_pending`, `approval_pending`, `mission_plan_ready` | owners, admins, editors | `questions` (high) |
| `review` | `review_pending`: a ticket enters Review (a Mission's own card is skipped) | roles that may update Missions | `review` |
| `auto_message` | `auto_message`: Auto posts without being asked (a watcher, a scheduled task, a Mission, the daily digest); at most one chat every 600 s, except the digest | that person only | `auto` |

How the server decides (`W2:services/push/fanout.py`, `recipients.py`,
`core/services/notification_dispatcher.py`):

- A push goes out after the in-app notification and carries that row's id.
- Quiet hours hold a push back unless its severity is `urgent` or `security`.
- Membership and role are read again at send time.
- An eligible phone is active, has push on, an Expo push token and a push key, and is iOS or
  Android. On SaaS that is a `clerk` row; on a local install a `paired` row. Browsers never get a
  push.
- A local install sends nothing until its operator agrees (see "Operator side").
- Per-person switches are `notification_preferences` rows with destination `push`. The person's
  row wins over the workspace's; no row means on.

**What it says.** The title is "{agent or Auto} · {AI badge}". A question carries its plain text
(up to 500 characters) and up to 3 options of 80 characters or less, only when they fit unchanged.
Otherwise, and for a redacted question or any other event, the body is a generic line: "A question
needs your answer", "An approval is waiting for you", "A Mission plan is ready for you", "A ticket
is ready for review · #0419" or "Auto messaged you".

## Registration (phone)

`A4:src/push/PushRoot.tsx` is mounted once, lazily, beside the signed-in screens in
`A4:app/(app)/_layout.tsx`. On mount it registers the Android channels and the iOS categories,
clears a push record left by another server, and starts the session's one registrar
(`A4:src/push/registration/registrar.ts`).

The registrar runs at launch, on resume, after a permission change, when the OS hands over a new
token and after the in-context ask. Runs never overlap. It registers only when the server pushes
through Expo, the build has its EAS project id, and the OS permission is granted
(`A4:src/push/registration/register.ts`):

- `POST /api/v1/mobile/devices` with `{install_id, platform, app_version, locale, timezone,
  expo_push_token, digest_time?}` (W2 adds `name?`). The answer is `{device_id, push_key}`; the key
  comes only on first registration.
- The push key is saved **before** the registration counts as done, in one keychain item,
  `automatos.push-record.v1`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, listed in the key registry
  (`A4:src/push/registration/key-store.ts`). Never MMKV, a log or Sentry.
- Sent again only when something changed, or after 24 h.
- A hosted phone with no key for its row revokes its own row and registers once more, at most once
  a day. An own server stays "key missing": deleting its row would end the device token. The
  phone says "Pair it again to turn them on."
- Turning notifications off in the iPhone's Settings sends `PATCH …/devices/{id}
  {push_enabled: false}` once.
- A 409 becomes a status on the Notifications screen, never a retry: `push_token_in_use` (another
  account on this phone gets its notifications), a row an admin revoked, and so on.

**The ask** (`A4:src/push/prompt/policy.ts`). "Get a notification when Auto needs you" with **Turn
on** / **Not now**. It is offered only once something needs the person (the needs-you total is
above zero) or from the second session on, never at launch. Not now holds it back 7 days. After 2
declines only Settings → Notifications offers it. The OS prompt appears only after **Turn on**.

## The signature check (phone)

Anyone who holds a phone's Expo push token can send it a push. So the phone posts nothing, follows
no link and marks nothing read unless the push is signed by its own server
(`A4:src/push/signature/verify.ts`, `canonical.ts`; server `W2:services/push/payload.py`).

- Payload v2: `{v: 2, type, workspace_id, notification_id?, grant_id?, link_type?, link_id?,
  ticket_number?, question?, options?, iat, sig}`. Every id is a JSON string. A `v` other than 2
  (v1 included) is refused.
- `sig` is lowercase hex HMAC-SHA256, keyed with the phone's `push_key` as UTF-8 bytes, over the
  compact JSON array
  `["v2", type, workspace_id, notification_id, grant_id, link_type, link_id, ticket_number, question, options, iat]`.
  A missing string field is `""`; `options` is the list or `[]`. Received strings are used as
  received.
- Fresh means `iat` is at most 7 days old and at most 5 minutes ahead.
- A push received while the app is open must verify within 2 s, or nothing is shown
  (`A4:src/push/inbound/receive.ts`).
- A push for another workspace on the same server still verifies, says so, and acts on nothing.
- Shared test vectors: `W2:orchestrator/tests/fixtures/prd266_push_signature_vectors.json`.

## What a person can do from a notification

Categories (`A4:src/push/platform/categories.ts`; server `QUESTION_CATEGORY_FORMAT`,
`OPEN_CATEGORY`):

| Category | Buttons |
|---|---|
| `automatos.question.0` … `automatos.question.3` (the number of options carried) | **Reply…** (unlocked phone only) and **Open** |
| `automatos.open` (everything else, a redacted question included) | **Open** |

There is no Approve button and no option buttons. Every button opens the app.

**Reply** (`A4:src/push/inbound/answer.ts`). `POST /api/v1/approval-grants/{grant_id}/answer
{answer_text}`, sent once and never queued. The text is trimmed and cut to 4,000 characters. The
route answers compare-and-swap, so "Answered" needs the grant granted with this phone's words:

| Result | What the phone shows |
|---|---|
| The phone's answer won | "Answered #0419." |
| Someone answered first, or the question closed | "That question was already answered." |
| Network failure | "Not sent. Open the question to answer it." |
| Signature did not verify | "This notification couldn't be checked, so nothing was sent." |

Each response is handled once: the last 50 handled keys are kept across launches.

**Open or tap** (`A4:src/push/links/targets.ts`, `stale.ts`). `link_type` picks the screen:

| `link_type` | Opens |
|---|---|
| `question` | Command Centre → Questions |
| `task` | The ticket |
| `social_post` | The post as it will publish |
| `chat` | The conversation |
| anything else | Home, where the needs strip is |

Before it opens, the phone asks for the record again with the person's own credentials, for up to
4 s. Gone → a plain line ("That question was already answered or closed." and so on) and a fallback
screen. A network failure or a timeout opens the screen anyway. A chat's 403 counts as gone, because
another person's chat id would silently start a new chat.

**Android channels** (`A4:src/push/platform/channels.ts`): Questions, Ready for review, Auto. All
three hide their text on the lock screen.

**The badge** (`A4:src/push/badge.ts`). The app icon shows the needs-you total while the app runs.
Pushes carry no badge.

## Settings

**Settings → Notifications** (`/settings/notifications`, `A4:app/(app)/settings/notifications.tsx`,
copy in `A4:src/push/strings.ts`):

| Section | What it does | Stored |
|---|---|---|
| This phone | One sentence on its state, and at most one button (Turn on notifications, Open Settings, Try again) | — |
| What notifies you | Needs an answer · Ready for review · Auto messaged you | The person's `push` rows in `notification_preferences` |
| Daily digest | On/off, and a time of 07:00, 08:00 or 09:00 in the phone's time zone (default 08:00). Needs `digest`. With `digest_now` too, **Send today's brief now**: `POST /api/v1/mobile/digest/now`, then a toast on its 202 (the brief arrives as Auto's message with a notification), *Try again in N minutes* on a 429 (`retry_after_seconds`, rounded up), one plain line on any other failure; disabled for 5 minutes after a 202 and for `retry_after_seconds` after a 429, the minutes left in its VoiceOver label | The switch: the `daily_digest` push row. The time: this phone's device row (`digest_time`). The wait: in memory only, cleared by every way of leaving (`clearUserData`) |
| Question text | **Hide question text in notifications**. Owners and admins only | `PUT /api/v1/mobile/push-settings {redact_questions}` → workspace settings |
| Approvals and answers | **Face ID before approve or answer**, on by default | The encrypted MMKV store, on this phone |

`PUT /api/notification-preferences` replaces **all** of the caller's rows for each event it names.
So the phone sends every row it read for those events, with only the `push` rows changed
(`A4:src/push/settings/prefs.ts`). With more than one phone, the digest follows the phone used last.

**Settings → Account** gains a **Notifications** row and, on a hosted phone that gets notifications
(it holds a push record for this server and workspace), **Remove this phone**
(`A4:src/push/bind/use-remove-phone.ts`).

## Face ID before approve or answer

`A4:src/step-up/policy.ts`. Phone-only; the server has no matching check.

| Asks first | Never asks |
|---|---|
| Answer a question, approve a ticket, approve a Mission plan, allow a tool, approve a social post | Reject, deny, withdraw, dismiss, send back, request changes, report |

- The passcode is the fallback. A phone with no passcode and no Face ID cannot be asked, so it
  passes, and the Notifications screen says so.
- Turning the switch off asks first. Turning it on asks nothing.
- A notification Reply is not gated: iOS asks for the unlock before the reply field opens.

## Leaving: sign out, forget, remove

`A4:src/push/bind/leave.ts`. Push is cleared before the sign-in provider is.

1. The registrar closes, so nothing registers the phone again.
2. Hosted only: `DELETE /api/v1/mobile/devices/{device_id}` with the still-valid Clerk token,
   waiting at most 4 s. An own server's row is removed by Forget this server instead, with the
   device token, so that path sends one DELETE ([connecting.md](connecting.md)).
3. The push record, the badge and the delivered notifications are cleared, even if the DELETE
   failed.

**Remove this phone** (hosted only): "Remove this phone from your workspace's devices?
Notifications stop here until you turn them on again. You stay signed in." It removes the device row
and nothing else. Registration then waits until the person turns notifications on again.

## Operator side (self-hosted, W2)

- **Consent.** Before the first pairing code, Studio asks "Send notifications to phones through
  Expo's push service?" (Yes / Not now). A switch on Phones & devices changes it later. Stored as
  system settings `notifications.push_via_expo` and `push_via_expo_answered_at`; route
  `GET`/`PUT /api/v1/mobile/push-consent`, owner or admin, local only. Discovery's `push.expo`
  follows it.
- **Until the operator agrees**, the install sends nothing to Expo and asks Expo for no receipts.
  The phone says "{server} doesn't send notifications to phones. Its operator can turn them on in
  Studio → Settings → Phones & devices; they are then sent through Expo's push service."
- **Network.** The install needs outbound HTTPS to `exp.host`.
- **Settings** (`W2:orchestrator/config.py`):

| Name | Default | What it does |
|---|---|---|
| `EXPO_PUSH_ACCESS_TOKEN` | empty | Expo's optional access token; sent as a bearer only when set |
| `EXPO_PUSH_TIMEOUT_SECONDS` | 10 | Each request to Expo |
| `PUSH_RECEIPTS_INTERVAL_SECONDS` | 900 (at least 60) | How often Expo's receipts are read; `DeviceNotRegistered` turns that phone's push off |
| `DIGEST_JOB_INTERVAL_SECONDS` | 900 (at least 60) | How often the digest job checks who is due |
| `DIGEST_DEFAULT_TIME` | 08:00 | Digest time for a phone that names none |

- **Expo's "enhanced push security"** must stay off on the EAS project: push to self-hosted
  installs depends on it ([README.md](../README.md), "Human steps").
- **The daily digest is on by default**, at 08:00 local, for every phone with a time zone. It is
  posted as Auto's message and pushed as `auto_message`.

## Where the PRDs and the code differ

Document the code:

- **PRD-001 §4.8** describes categories `question.{1,2,3}` with option buttons, and a line saying the
  work is resuming. A4 has `automatos.question.0`–`3` with Reply… and Open only, and no resuming
  claim.
- **PRD-266 §4.4** describes a v1 signature over `type|grant_id|question|options`. The code is v2,
  with `iat`.
- **PRD-266 §4.5** says the digest goes only to devices with a `digest_time`. The code defaults to
  08:00.
- **Merge seam, checked.** #1300 merged on 24 Oct (`bd0e60b2b`), after the W2 branch merged `main`
  (`b34876498`). `main`'s discovery lists all five capabilities: `digest`, `mobile_theme`, `push`,
  `spoken_mode` and `voice_live`.
- **Studio's QR copy** (W2, now on `main`, `pair-phone-panel.tsx`) says "Scan the QR code with the
  phone". The iPhone Camera app opens the web page, not the app; it should say to scan from
  Automatos Go.

## Related

- [connecting.md](connecting.md): device rows, revoke, and Forget this server.
- automatos-ai `docs/PRDS/PRD-266-AUTOMATOS-GO-BACKEND.md` §4.4–§4.5, and the QUICKSTART.md and
  SETUP.md "Notifications" paragraphs W2 added (on `main`).
