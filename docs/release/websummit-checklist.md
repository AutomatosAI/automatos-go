# WebSummit checklist: Automatos Go (OT-R14)

Gerard runs this on his iPhone, on the TestFlight build the team takes to WebSummit (10–12 Nov),
against hosted Studio and the VPS demo. It is PRD-001 US-021's last acceptance criterion (sign in,
pair with the VPS, answer from a notification, flip styles, change a look, quick-ask) and PRD-001
§10's first success metric, plus the store duties a test in this repository cannot see on a phone.
Requirement R23 and owner step OT-R14 are in [README.md](README.md).

Run it once the WebSummit build is installed, and again on the build that will be on the phones if
a native build lands after the first run. Fill in the results table at the end. A row that fails
names what was seen, and a screenshot goes with it in the A7 pull request.

## Before you start

1. **The build.** Install the newest build from TestFlight. Delete the app first, then install it,
   so the first-run rows are real: the app opens at Welcome, signed out (OT-R7 checks the same
   thing).
2. **Hosted Studio.** Gerard's account on Clerk's production instance, after the 27 Oct cutover and
   the Clerk key choice in [testflight.md](testflight.md) (OT-R11). In its workspace, at least one
   question waiting, and a way to make a new one during the run (an agent or a routine that asks).
3. **The VPS demo.** It answers at `https://<VPS domain>/.well-known/automatos.json` in Safari. In
   the VPS's Studio, Settings → Phones & devices is ready to show a pairing QR code (it lasts ten
   minutes). The operator agreed to push through Expo, so notifications work on the VPS too.
4. **Sentry.** OT-R1 is done: the EU project exists and its DSN is in the EAS `preview`
   environment. Without it, rows S5 and P4 are "not run".
5. **App Privacy Report.** On the iPhone: Settings → Privacy & Security → App Privacy Report →
   Turn On App Privacy Report. It records from that moment only, so turn it on before step 1's
   first launch.
6. **The phone.** Wi-Fi on, notifications not yet asked (a fresh install), the phone's language
   English.

## Part D: the demo (PRD-001 US-021)

| Id | Do | Expect |
|---|---|---|
| D1 | Open the app. | Welcome, with "Sign in to Automatos", "Connect to your own server" and the "Privacy · Terms" line. No iOS question about notifications or the microphone. |
| D2 | Tap "Sign in to Automatos" and sign in (email code, password or passkey). | "Before you talk to Auto" opens before anything else (row S2). Tap "Agree and continue": home shows the conversation with Auto, with the waiting work above it. Still no iOS notification question (the app's own "Turn on" sheet may come: D4). |
| D3 | Send "Hello" in the message box. | Auto's reply starts within 5 seconds on Wi-Fi (PRD-001 §10). Write the seconds in the results. |
| D4 | Wait for the "Turn on" sheet (it comes once something waits for you). Tap "Turn on", then Allow in iOS's question. | iOS asks only after that tap. If the sheet does not come, Menu → Settings → Notifications → "Turn on notifications" does the same; note which one you used. |
| D5 | Lock the phone. In Studio on the web, make an agent ask a question. | The notification arrives. Its preview follows iPhone Settings → Notifications → Show Previews. |
| D6 | Unlock the phone. Long-press the notification, tap "Reply…", type an answer and tap "Send". | The app opens, and Studio shows the question answered. Write the taps it took (PRD-001 §10: two taps on an unlocked phone). On a locked phone, "Reply…" asks for Face ID or the phone's code first. |
| D7 | Menu → Settings → "Style and look". Choose Studio, then Play, then HUD. | Each paints the whole app at once. The "Auto is an AI" caption is the first line of the conversation in Studio and Play, and of HUD's transcript. |
| D8 | In Play (then in HUD), open its looks ("Make it yours →"), pick another look, then "Reset". | Home repaints in the new look, and Reset brings back the look you picked. The AI caption stays and keeps its words. |
| D9 | Back in Studio, tap "Talk to Auto" (the microphone beside the message box). Hold "HOLD TO TALK", ask a short question, release. | The first hold asks for the microphone and speech recognition, never earlier. Your words show as YOU, then Auto's reply is spoken, starting "Hi, this is Auto, your AI assistant." A second question gets no greeting. |
| D10 | Menu → Settings → "Sign out". On Welcome, tap "Connect to your own server", then "Scan the code in Studio", and scan the VPS's pairing QR code. | "Pair with this server?" shows the VPS's name. Tap "Pair". The consent sheet lists the VPS's providers. No local network question (the VPS is on the internet). |
| D11 | On the VPS: repeat D3 (a reply), D9 (quick-ask) and, if the VPS pushes, D5–D6 (a notification answered). | The same results, from the VPS. |

## Part S: the store-duty spot checks

| Id | Do | Expect |
|---|---|---|
| S1 | Menu → Settings → "Privacy & legal". Tap "Privacy policy", "Terms of use" and "Contact support". Then tap Privacy and Terms on Welcome's line. | Each opens Safari, never a page inside the app: https://automatos.app/privacy, https://automatos.app/terms and https://automatos.app/contact. Each page loads its real text, not a placeholder or an error (it needs OT-R3's publication). |
| S2 | On the consent sheet at D2 and D10, read the list under "AI providers". | It names each provider the workspace lists, Anthropic among them on hosted Studio, and Retell AI when the workspace can use Auto Live. There is no "Not now": the only other way is "Sign out" (hosted) or "Forget this server" (VPS). |
| S3 | Look at the top of a conversation in each style, at HUD's transcript and at the voice screen. | One small caption, "Auto is an AI" (or "{agent} is an AI" while another agent answers, on HUD and the voice screen), on every one (D73). It is also atop the consent sheet. |
| S4 | Long-press a finished reply from Auto (Studio, Play, HUD's transcript, the voice screen). Open a Deliverable and tap "Report this". | "Report this message" (or the Deliverable's sheet) opens. Choose a reason and send: "Thanks. Your report was sent." Nothing is offered on your own words or on a reply still being written. OT-R16 has the full HUD and voice-screen steps. |
| S5 | Settings → "Privacy & legal" → "Send a test error report". Then, in Sentry (de.sentry.io), open the "Automatos Go test report" event. | The toast says "Test report sent." The event shows no user and no IP address. The planted fields `question_text`, `chat_text` and `call_id` are gone or `[redacted]`. Its release is `com.automatos.app@<version>+<build>`. |
| S6 | Turn "Send crash reports" off, look under it, then turn it back on. | Off: "Nothing is sent." shows under it, and the test-report row is gone. On: the row comes back. |
| S7 | Read the Version row in "Privacy & legal". | "<version> (<build>) · built-in", or "· update <id>" after an over-the-air update. Write it in the results. |

## Part P: the App Privacy Report domain check (iOS)

iOS lists every domain the app contacted. Open it from Settings → Privacy & Security → App Privacy
Report, then Automatos Go, and read its network activity. Two passes keep the paired phone's list
clean.

| Id | Do | Expect |
|---|---|---|
| P1 | After Part D's hosted rows (D1–D9) and S1–S7, read Automatos Go's domains. | Only hosts from the table below for hosted Studio. |
| P2 | After pairing (D10), clear the report: Turn Off App Privacy Report, then Turn On again. Force-quit Automatos Go and open it again (it opens on the VPS). Run D11 and S5 on the VPS. | The report starts again from this launch. |
| P3 | Read Automatos Go's domains again. | Only the VPS's domain, Sentry's EU ingest host and Expo's hosts (below). No Clerk host, no hosted API host. |
| P4 | Look for any host on the "never" list, in either pass. | None. |

**Expected hosts:**

| Host | When | Why |
|---|---|---|
| The hosted API's host (`EXPO_PUBLIC_API_URL` of the build) | Hosted Studio only | The app's API |
| The VPS's domain | Paired only | The own server's API |
| Clerk's Frontend API host (the production instance's host for a `pk_live_` key; a `….clerk.accounts.dev` host for a `pk_test_` key) | Hosted sign-in, and Welcome before pairing (privacy-facts.md, "Clerk on a phone paired with its own server") | Sign-in |
| `o<org>.ingest.de.sentry.io` | When a report is sent (S5) | Crash reports, Sentry EU [D44] |
| `u.expo.dev`, and Expo's asset host when an update downloads | Each launch | Over-the-air updates (EAS Update) |
| `exp.host` | When notifications are turned on, and when the push token is refreshed | Expo's push token |
| The host of a Deliverable image stored outside the API (its own address) | Opening such a Deliverable | The image itself |

**Never** (a failed row: write the host down):

- Any analytics, advertising or attribution host (for example Firebase or app-measurement.com,
  Google Analytics, Segment, Amplitude, Mixpanel, PostHog, Datadog, Bugsnag, AppsFlyer, Adjust,
  Branch, Facebook).
- `clerk-telemetry.com` (Clerk's SDK telemetry is off: privacy-facts.md, "Analytics and tracking").
- A Sentry host outside the EU (one without `.de.` before `sentry.io`).
- A Retell or LiveKit host (Auto Live is not in this build).
- In P3, Clerk's host or the hosted API's host.

Links opened in Safari (S1) and the universal-link association files that iOS fetches itself are
not the app's own activity.

## Results

Build: `<version (build) · built-in or update id>` · Phone: `<model, iOS version>` · Date:
`<date>`

| Id | Pass / Fail / Not run | Notes (seconds, taps, a host, what was seen) |
|---|---|---|
| D1 | | |
| D2 | | |
| D3 | | seconds: |
| D4 | | sheet or Settings: |
| D5 | | |
| D6 | | taps: |
| D7 | | |
| D8 | | |
| D9 | | |
| D10 | | |
| D11 | | |
| S1 | | |
| S2 | | providers listed: |
| S3 | | |
| S4 | | |
| S5 | | |
| S6 | | |
| S7 | | version: |
| P1 | | hosts: |
| P2 | | |
| P3 | | hosts: |
| P4 | | |

**PRD-001 §10, the Sentry metric.** "Zero crash-free-session regressions in Sentry" cannot be read
from this build: session tracking is off (KR7: a session records every launch, which the labels
call Product Interaction). Read it instead as no new crash issue in Sentry across the last three
builds before WebSummit, and say so in the pull request.

**Sign-off:** run by `<name>` on `<date>`, build `<version (build)>`: every row Pass, or each Fail
listed in the A7 pull request with its screenshot and what happens next. Signed: `<name>`.
