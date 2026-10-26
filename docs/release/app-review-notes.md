# App Review Information: Automatos Go (OT-R12)

This is the text for App Store Connect → the version → **App Review Information**, before the first
App Review (after WebSummit). Apple 2.1 asks for a working demo account when an app has a login.
Apple 2.3.1 asks that no feature is hidden, so the own-server lane is described here as well as
shown on the first screen. Requirement R21 and owner step OT-R12 are in [README.md](README.md). The
same access for Google Play is in [play-app-access.md](play-app-access.md).

Every value in angle brackets is typed into App Store Connect only: the demo account, its password,
the review server's address, the review pairing code and the contact's phone and email never go in
this repository.

Proof: [src/release/\_\_tests\_\_/release-docs.test.ts](../../src/release/__tests__/release-docs.test.ts)
reads this file. The Notes block is under App Store Connect's 4,000-character limit. It names the
app's real labels (each one is imported from its strings module, so renaming a button fails the
test until this text follows). It uses no sign-up, billing or 'nothing leaves' phrase (US-021k's
lists) and has no secret-shaped string.

**Checked on the merged app, 26 Oct:**

- **The review pairing code exists.** The kit (21 Oct) expected a long-lived code to need backend
  work. automatos-ai `main` now has it, from PRD-266 W1 and W2 (`c0b317f8b`, `bd0e60b2b`):
  `orchestrator/scripts/mint_pairing_code.py --review --ttl-hours N` mints one code that lasts N
  hours (1 to 336, two weeks). It works once, like every pairing code, and writes an audit row.
  Every other code lasts ten minutes (`PAIRING_CODE_TTL_SECONDS = 600`).
- **Auto Live is not in this build.** A6's US-020a–e (the Retell call over LiveKit) are not built.
  The Notes below describe quick-ask voice only. "Auto Live" below says what to add once a build
  under review has it.

## Before you fill it in (owner setup)

1. **The demo account**, on the production Clerk instance (after the 27 Oct cutover):
   - a password set, and no second factor;
   - no email code on a new device: sign in once from a phone that has never used the account, and
     check that nothing but the password is asked;
   - the **owner** of the demo workspace. Owners see everything: Report this (owners, admins and
     editors), answering questions, approvals and the consent sheet (viewers see none of these).
2. **The demo workspace**, a Business demo workspace with made-up data only (no real person, company
   or customer):
   - at least two questions waiting, one of them with answer options;
   - a ticket in Review;
   - a social post awaiting approval;
   - Deliverables: a document, an image and a PDF;
   - a few earlier conversations with Auto;
   - its AI providers listed by the server (PRD-266 W3 `ai_providers`), so the consent sheet names
     them;
   - its theme left on Studio's default, so the app opens in the Studio style that the Notes
     describe;
   - Auto Live armed, which matters only once a build under review has Auto Live (Business only on
     hosted Studio [D34]).
3. **Notifications during review (optional).** A routine in the demo workspace that asks a question
   every few hours. Then a reviewer who turns notifications on receives one.
4. **The review server** (Gerard's VPS [D13]):
   - HTTPS on a real domain;
   - `LOCAL_REMOTE_ACCESS=paired`, with `PUBLIC_API_HOST` set to that domain;
   - the same kind of made-up data as the hosted demo;
   - push through Expo agreed by the operator;
   - check that `https://<review server>/.well-known/automatos.json` answers in a browser.
5. **The review code.** Within a day of submitting, on the VPS:

   ```bash
   docker compose exec backend python -m scripts.mint_pairing_code --review --ttl-hours 336 --name "App Review"
   ```

   The console prints the code, its expiry and a pair link. Put the code, the server's address and
   the expiry date in the Notes in App Store Connect only. The code pairs one phone, once. Mint a
   new one for every resubmission, and whenever a reviewer says the code was used or has expired.
   Never pair a phone with it yourself.
6. **Before each submission:** sign in with the demo account on a phone and check that home, the
   Command Centre and a Deliverable open. Do not use the review code for this check.

## Sign-in information

| Field | Value |
|---|---|
| Sign-in required | Yes |
| User name | `<demo account email — in App Store Connect only>` |
| Password | `<demo account password — in App Store Connect only>` |

## Contact information

| Field | Value |
|---|---|
| First name | Gerard |
| Last name | Kavanagh |
| Phone number | `<contact phone — in App Store Connect only>` |
| Email | `<contact email — in App Store Connect only>` |

## Notes

Paste the block as it is, then replace the three angle-bracket values in App Store Connect.

```text
Automatos Go is the phone app for Automatos, a workspace in which Auto, an AI assistant, and AI agents do work for a team: tickets on a board, scheduled routines, questions for the team, and documents and other Deliverables. The app signs in to a workspace that already exists, or connects to an Automatos server its owner runs. Both ways in are on the first screen.

HOSTED SIGN-IN (the demo account above)
1. Tap "Sign in to Automatos". Enter the email above, tap "Use my password", enter the password and tap "Sign in". No second step is asked.
2. "Before you talk to Auto" lists the AI providers that receive what you send (5.1.2(i)). Tap "Agree and continue".
3. Home is the conversation with Auto. Work waiting for you is above it: questions, a ticket in Review and a social post to approve. The workspace and its data are made up.

YOUR OWN SERVER (2.3.1)
1. On the first screen, tap "Connect to your own server". If you are signed in, first open Menu, then Settings, and tap "Sign out".
2. Server address: <review server address — in App Store Connect only>
   Pairing code: <code — in App Store Connect only>
3. Tap "Continue", check the server's name under "Pair with this server?" and tap "Pair".
The code works once and expires on <expiry date — in App Store Connect only>. If it was used or has expired, write to us and we will send a new one. Customers get a code in Studio, under Settings, Phones & devices, and scan its QR code with "Scan the code in Studio"; typing it does the same.

WHERE THINGS ARE
- The Menu button in the header opens New chat, Chats, Command Centre and Settings.
- Command Centre: Board, Calendar, Questions and Deliverables.
- "Auto is an AI" is the first line of every conversation and of the voice screen.
- Report this (1.2): long-press a finished reply from Auto, or use the VoiceOver action "Report this". On a Deliverable, tap "Report this" on its page. Choose a reason and send. On our hosted service a report goes to the workspace owner and to our moderation inbox; on a customer's own server, to its operator.
- Settings, "Privacy & legal": the privacy policy, the Terms, support, "Send crash reports" and the app version. The first screen links the policy and the Terms too.
- Settings, "Style and look": three styles, Studio, Play and HUD.

ACCOUNTS (5.1.1(v), 4.8)
The app only signs in. Automatos accounts are made in Studio on the web, where a workspace owner invites people. The app has no account creation and no link to it, so it deletes no account: a workspace is deleted in Studio by its owner or an admin, and a login is removed through support (https://automatos.app/contact), as our privacy policy says. Sign-in uses Automatos's own email code, password or passkey; there is no third-party or social sign-in.

NOTHING IS SOLD (3.1.1)
Automatos Go sells nothing, asks for no money and shows nothing about what a workspace costs.

NOTIFICATIONS
The app offers notifications once something is waiting for you, or from the second time you open it; Settings, Notifications, "Turn on notifications" does it at any time. There are three kinds: a question needs your answer (answer it from the notification with "Reply…" on an unlocked phone), a ticket is ready for review, and Auto messaged you (including a daily digest you can switch off). Approving work always opens the app first.

VOICE
"Talk to Auto", the microphone button beside the message box, opens the voice screen. Hold "HOLD TO TALK" and speak: the phone turns your speech into text on the device, sends it to Auto as a chat message and reads the reply aloud. The first reply starts "Hi, this is Auto, your AI assistant." The microphone and speech recognition are asked for at the first hold, never at launch.

OTHER PERMISSIONS
Camera: scanning a pairing QR code, and taking a photo to attach. Photos: the system photo picker, to attach a picture. Face ID: asked before you approve or answer in the app, a setting that is on by default; the passcode works too.
```

## Auto Live (add only when the build under review has it)

When a build with Auto Live (US-020) goes to review, add this paragraph after VOICE. First check
each label against the shipped Live screen.

```text
AUTO LIVE
On the demo workspace, the Live button on the voice screen starts a voice call with Auto. The call's audio goes to Retell AI, which the consent sheet names. Auto says it is an AI when the call starts. MUTE and END are on the call screen.
```

## Attachment (optional)

A short screen recording from Gerard's phone of both lanes: hosted sign-in, then Connect to your own
server with a spent code. It helps a reviewer if the VPS cannot be reached. Record it in the demo
workspace only, and blur the server's address and the code.

## Where each store duty is

For Gerard's check before submitting. Every row is on the merged base of 26 Oct.

| Duty | Guideline | Where in the app | Proven by |
|---|---|---|---|
| The AI label | Apple 1.2; Google generative-AI policy [D73] | First line of every thread (Studio, Play), of HUD's and the voice screen's transcript, and atop the consent sheet | `src/release/__tests__/surfaces.test.ts` (a) |
| The AI-provider consent | Apple 5.1.2(i) [D23, D70] | "Before you talk to Auto", before the first message, naming each provider the server lists, Retell AI included when listed | `surfaces.test.ts` (c) |
| Report this | Apple 1.2 [D15] | Long-press or the VoiceOver action on a saved Auto reply (Studio, Play, HUD, voice screen); the Report this button on every Deliverable | `surfaces.test.ts` (b) |
| Privacy policy and Terms | Apple 5.1.1(i) | Settings → Privacy & legal; the Privacy · Terms line on Welcome | `privacy-section.test.ts`, `privacy-surfaces.test.ts`, `legal-links.test.ts` |
| No account creation | Apple 5.1.1(v) [D64] | Welcome and the sign-in screen sign in only | `store-copy.test.ts` (SIGNUP) |
| No deletion | Apple 5.1.1(v) [D63] | Sign out, Forget this server and Remove this phone delete no account or workspace | `store-copy.test.ts` (DELETION) |
| Nothing sold | Apple 3.1.1, 3.1.3 [D8] | No plan, credit or price anywhere | `store-copy.test.ts` (BILLING) |
| The own-server lane is visible | Apple 2.3.1 | Welcome → Connect to your own server | `src/connect/screens/WelcomeScreen.tsx` |
| No social sign-in, so no Sign in with Apple | Apple 4.8 [D6] | Clerk's email code, password and passkey only | `src/auth/strings.ts` (the sign-in screen's words) |

## Owner steps (OT-R12)

1. Set up the demo account, the demo workspace and the review server as listed in "Before you fill
   it in".
2. Mint the review code within a day of submitting.
3. In App Store Connect → the version → App Review Information: tick Sign-in required, then enter
   the user name, the password and the contact. Paste the Notes block and replace its three values.
4. Fill in Play Console's App access from [play-app-access.md](play-app-access.md) once a Play
   Console exists [D10].
