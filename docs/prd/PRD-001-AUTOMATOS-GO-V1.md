# PRD-001: Automatos Go v1, Auto in your pocket

**Status:** Draft for Gerard, 20 Oct 2026. Every product decision below was taken by Gerard in the 20 Oct mobile Q&A (60 decisions, `<workspace>/reports/mobile-review-2026-10-20/decisions.md`; numbers in brackets, e.g. [D54]). · **Owner:** Gerard · **Written:** 20 Oct 2026.
**Source:** the review `<workspace>/reports/mobile-assistant-rebuild-review-2026-10-20.md` and its evidence folder; three Claude Design specs (§4.6): `DUMPING AREA/design_handoff_automatos_mobile/` (Studio), `DUMPING AREA/automatos-play-ember/` (Play), `DUMPING AREA/automatos-play-command/` (HUD).
**Scope:** the Automatos Go app, iOS first through internal TestFlight, Android testers by EAS internal link [D10]. This repo (`AutomatosAI/automatos-go`, renamed from `automotas-mobile` on 20 Oct, public, Apache-2.0 [D42]).
**Depends on:** automatos-ai **PRD-266** (pairing, discovery, push, store duties; waves W1–W3); automatos-ai **PRD-261** stories P261-M-01..M-07 (the theme `mobile` block and `GET /api/themes/mobile/{install_id}`, PLAY session); the Clerk production cutover on Tue 27 Oct (PR #1198) and the native `azp` marker on PR #1216 (PRD-266 US-020); Retell confirming a LiveKit client may join a web call (A6).
**Ralph config:** launch is human-only, with `RALPH_MODEL` pinned. One branch, one push, one PR and one CI run per wave. Parallelism is sized to the remaining usage budget, not a fixed number (Gerard, 20 Oct); PRD-261 and PRD-266 draw on the same budget in the same window.
**Human-gated:** the App Store Connect record "Automatos Go" (bundle id `com.automatos.app`) and adding Dave as an App Store Connect user [D9, D11]; the first iOS build's credentials (EAS asks interactively; Gerard at a terminal, as for the academy app); EXPO_TOKEN in the `testflight` GitHub environment, restricted to `main` [D50]; the Sentry account (EU region) [D44]; Gerard's VPS demo install [D13]; on-device checks on Gerard's phone.

## 1. Introduction

Studio is where you set things up. Automatos Go is where you talk to Auto when you're away from the desk: ask, answer the questions your agents raise, glance at the board, and look at what was made. It is a native app, not a web view [D3, D32]. It is a lite companion: the workspace, agents, playbooks and themes are set up in Studio.

It ships with three styles you can flip between [D54]:
- **Studio:** the Claude Design mobile handoff, cream paper or Studio Dark.
- **Play:** the Ember design, with Auto the mascot and the "Make it yours" look page.
- **HUD:** the Command design, voice first, square panels, glow and grid.

A style is a layout built into the app plus a look. Looks are data (colours, fonts, glow, mascot), so the app can offer a look page for each style [D55] and read installed marketplace themes that declare a `mobile` block, without ever downloading code (Apple 2.5.2) [D58].

Hosted Studio users sign in with Clerk. Self-hosted users pair their phone with their install by scanning a QR code in Studio [D1].

## 2. Goals

- On the team's phones at WebSummit (10–12 Nov) through internal TestFlight [D51], against Gerard's VPS demo install [D13] and hosted Studio.
- Sign in or pair in under a minute; never show a web page for a core flow.
- Answer an agent question from a notification in two taps on an unlocked phone [D18].
- Flip between Studio, Play and HUD instantly, and change a look's colours and fonts with a live preview [D54, D55].
- Talk to Auto hands-free with the screen on [D33], in every style [D60].
- Pass App Review when it is time for an external build: AI notice, AI-provider consent, report content, privacy policy, 16+ [D12, D14, D15, D23].

## 3. Decisions this PRD implements

| | Decision |
|---|---|
| D1, D4 | One app; SaaS (Clerk) and self-hosted pairing in v1; enterprise later. |
| D5, D6 | Sign-in only; Clerk email code, password, passkey; no social logins (so no Sign in with Apple). |
| D63, D47 | The app deletes nothing: uninstalling is the user's business, deleting a workspace stays in Studio, and a login is removed through support (the privacy policy says how). |
| D8 | Nothing about plans, credits or prices. A paused workspace says "Your workspace is paused; ask your workspace owner". |
| D11, D12, D38 | Name Automatos Go, bundle id `com.automatos.app`, 16+, iPhone only, 11 pt minimum, Dynamic Type. |
| D16, D17 | Owners, admins and editors answer and approve; viewers get a read-only app. |
| D18, D19 | Lock screen: Open and Answer on an unlocked phone; Face ID before approve or answer in the app (a setting, on by default, client-side). |
| D20–D24 | Push types: needs an answer, ready for review, Auto messaged you. Daily digest as Auto's message. One-time AI-provider consent sheet. |
| D25–D31 | Deliverables gallery like Studio; server's needs-you number; Board shows every status; pause for routines and scheduled tasks; Auto thread home with the needs strip; pill composer with attachments; no Plan toggle; "Ask Auto about" sends the ticket as context. |
| D32–D34 | Quick-ask voice everywhere; Auto Live joins Retell's call through LiveKit's React Native SDK, Business-only on SaaS; screen on, app open. |
| D35–D37, D54–D60 | Three styles; look pages; the phone keeps its own style choice; one voice screen dressed per style; Auto the mascot in Play (clips on iOS, stills on Android); fonts bundled as TTF. |
| D42–D50 | Repo, Apache-2.0, fresh from the academy template; runtime version `fingerprint`; Sentry EU; build-loop race fixed; Expo account personal; EAS free tier with batching. |
| D45 | Social-post approvals on the phone (exact version shown, never from a notification). |

## 4. What the app is made of

### 4.1 Scaffold

Start fresh from the academy app's TestFlight tree (`.worktrees/automatos-academy-app/testflight-main`). Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript 5.9, expo-router 6, `@clerk/expo` on the newest 3.2.x that accepts Expo SDK 54 (3.0.x clashes with `expo-doctor`), vitest. Lift verbatim and then rename:

- `eas.json` (profiles development, preview, testflight, production; `appVersionSource: remote`); add an Android preview profile that builds an installable APK for testers.
- `.github/workflows/ci.yml` (typecheck, lint, test:coverage; switch `npm install` to `npm ci`), `malware-scan.yml` (already on this repo's main), `testflight.yml` (the fingerprint loop) with two changes: it waits for or skips when a testflight build is already in progress, so two quick merges never start two native builds [D48]; and the `testflight` environment only serves `main` [D50].
- `scripts/check-release-env.js` as the `eas-build-pre-install` hook, with this app's required variables.
- The Clerk plumbing that must travel with `@clerk/expo`: `metro.config.js` with the `react-dom` shims, `babel.config.js`, and `.npmrc`. The `expo-build-properties` `extraPods` for GoogleUtilities and RecaptchaInterop stay only while Clerk's Google sign-in pod still autolinks. The academy's explicit `expo-modules-core` dependency does not travel: Clerk 3.2.x no longer needs it.
- No `.env.example` file. The README and CLAUDE.md list every `EXPO_PUBLIC_*` variable with a one-line comment, and `scripts/check-release-env.js` enforces them at build time.
- Store lessons: honest `NS…UsageDescription` strings for every framework the binary references (the academy's first upload was bounced for `PHAsset`), `ITSAppUsesNonExemptEncryption: false`.
- `runtimeVersion: { policy: "fingerprint" }` [D46], not `appVersion`.
- Repo files: `CLAUDE.md` (stack, commands, traps, terms), `LICENSE` (Apache-2.0), `README.md`.

### 4.2 Native modules, all in the first build

Every native module goes into the first build (A0), so later waves ship as over-the-air updates and spend no build quota. The EAS free tier gives 15 iOS builds a month, shared with the academy app [D43].

| Need | Module |
|---|---|
| Sign-in, passkeys | `@clerk/expo`, Clerk's Expo passkeys package, `expo-secure-store` |
| Push, actions | `expo-notifications`, `expo-local-authentication` |
| QR scan | `expo-camera` (barcode scanning) |
| Attachments | `expo-image-picker`, `expo-document-picker`, `expo-image-manipulator` (HEIC to JPEG) |
| Files | `expo-file-system`, a system document viewer (QuickLook on iOS) |
| Voice | `expo-speech-recognition`, `expo-speech`, `@livekit/react-native`, `@livekit/react-native-webrtc`, `@livekit/react-native-expo-plugin`, `@config-plugins/react-native-webrtc` |
| Styles | `@shopify/react-native-skia` (HUD rings and grid, mascot tint), `expo-video` (mascot clips), `expo-font`, `expo-haptics` |
| Storage | `react-native-mmkv` with encryption (query cache) |
| Errors | `@sentry/react-native` (EU) |
| Time | `expo-localization` (timezone for the digest) |

LiveKit and webrtc need a development build, not Expo Go; the `development` profile adds `expo-dev-client`.

### 4.3 Code layout

```
app/                 expo-router screens (auth, connect, (app)/home, (app)/cc/*, sheets, settings, voice)
src/core/            pure TypeScript vendored from automatos-ai at a pinned SHA (no React, no DOM)
src/api/             the one API client: bearer + X-Workspace-ID, capabilities, error taxonomy
src/auth/            Clerk provider and token getter; device token for paired installs
src/connect/         discovery, QR pairing, server switching
src/chat/            the chat controller over src/core (turnReducer), streaming
src/cc/              Board, Calendar, Questions, Deliverables data and screens
src/push/            registration, categories, action handler, signature check
src/voice/           quick-ask (STT, TTS), Auto Live (LiveKit), voice screen
src/styles/          tokens, looks, the three layouts, fonts, mascot, the AI label
src/ui/              primitives shared by all three layouts
```

`src/core/` is copied from automatos-ai by `scripts/sync-core.ts` at a pinned commit, and a `core.lock.json` records the SHA:
- chat: `frontend/lib/chat/{receipts,errors,narration,tool-calls,approvals,suggestion,retry,deliverables,message-text}.ts`, the `chat-session.ts` updaters, `lib/ai-label/copy.ts`, Play's `components/play/chat/{labels,reply,caption}.ts`;
- Command Centre: `lib/ticket-number.ts`, `lib/grant-owner.ts`, `lib/ticket-links.ts`, `components/activity/board/{ticket-stage,ticket-kind}.ts`, `components/command-center/{calendar-kinds,calendar-actions}.ts`, `parseSSEFrames` from `hooks/use-board-event-stream.ts`;
- styles: `lib/look-kit/*` (without `applyCssVars`), `lib/looks/{catalogue,presets,engine,tone}.ts`, `lib/mascot/{types,reducer,tools,events,ring,player}.ts`, `lib/theme-host/{look-schema,css-value}.ts`.

New in core: `ai-sdk-stream.ts` (the `0:` / `d:` / `e:` line buffer, from `lib/chat/hooks.ts` without React) and `turnReducer(state, frame)`. A parity corpus of **real** recorded turns and SSE frames (never c1's fake data) is asserted by vitest here and by the web's own tests, so the vendored copy cannot drift silently. A CI step checks every route the app calls against automatos-ai's `orchestrator/reports/route-manifest.json` at the pinned SHA.

### 4.4 Data

- One client. Every call sends `Authorization: Bearer <token>` and `X-Workspace-ID`. The token is a Clerk session token from `getToken({template: "mobile"})` on SaaS, or the paired device token on a self-hosted install. The workspace id is read back from `GET /api/workspaces/current` on every launch, because the server silently replaces a header the user can no longer use.
- TanStack Query with the same key families as the web. The cache persists in encrypted MMKV; chat message bodies and question text are never persisted unencrypted. Writes (answer, approve, pause) are never queued offline: the server's compare-and-swap answer is the truth.
- Streaming through `expo/fetch`. Chat: `POST /api/chat`, parsed by `ai-sdk-stream.ts`. Live updates: `GET /api/v1/tasks/stream` while the app is open (`board_changed` invalidates board, needs-you and questions; `chat_changed` refetches the thread); on resume, refetch, since the stream has no replay.
- A stale chat id silently creates a new chat on the server, so the app checks `GET /api/chat/{id}` before reusing a cached id.
- Capabilities from the discovery document gate features: no `push`, no push settings; no `spoken_mode`, quick-ask reads plain text; no `voice_live`, no Live button; no `mobile_theme`, built-in styles only.

### 4.5 Sign in and connect

- **First run:** "Sign in to Automatos" (hosted) or "Connect to your own server".
- **Hosted:** Clerk email code, password or passkey; sign-in only. "No account? Create one in Studio" links to the web [D5, D6]. Waitlist and unlinked-account (409) errors are shown as written by the server.
- **Own server:** scan the QR code from Studio → Settings → Phones & devices with the in-app scanner (the QR is a universal link `https://<web>/go/pair?api=…&code=…`; if the OS camera opens it, the app catches it). Or type the server address and the code. The app reads `/.well-known/automatos.json`, then `POST /api/v1/mobile/pair`, and keeps the device token in SecureStore. HTTPS is required except on private addresses (`192.168.x`, `10.x`, `.local`), which show a persistent "unencrypted home network" note.
- **After either:** `GET /api/workspaces/current` gives the role, plan exposure and AI providers. The AI-provider consent sheet appears before the first message [D23].
- **Server switch:** Settings shows the server, the edition, the workspace and the role; "Sign out" or "Forget this server".

### 4.6 Styles

A style is one of three layouts built into the app, dressed by a look. The phone keeps its own style choice [D59]; it starts on Studio.

| Style | Layout and design source | Look source | Look page |
|---|---|---|---|
| **Studio** | `design_handoff_automatos_mobile/` (README, `AutomatosApp.dc.html`): brand header with the Command Centre button and avatar, needs strip, thread with the receipts card, sheets | Studio tokens from `_ds/…/tokens/colors.css` (light and Studio Dark), Newsreader, Geist, Geist Mono | Light / Dark / System |
| **Play** | `automatos-play-ember/`: 390 px screens 01 Chat, 02 Deliverable ready, 03 Conversations, 04 Deliverables shelf, 05 Deliverable detail, 06 First open, 07 Not running, 08 Something went wrong, 09 404, and the style sheet. The Companion layout: Chats / title / Shelf header, Auto's row with state captions, tool chips, the report card | Play's catalogue and presets (Ember, Obsidian, Aurora, Workshop, Daylight) through the vendored look engine; saved looks sync with Studio through `GET/PUT /api/themes/looks/automatos/play` (Play must be installed in the workspace once builtin Play leaves core, PRD-261 A-19) | Six knobs as on the web: ground, accent, type, Auto's shell, Auto's light, glow; save, rename, delete looks (`Automatos Play Looks.dc.html`) |
| **HUD** | `automatos-play-command/`: `Automatos Command HUD.dc.html` phone core (390×844): AUTOMATOS // top bar, MIC LIVE, ring core with the state chip, transcript (YOU / AUTO with a block cursor), waveform, TYPE · HOLD TO TALK · STOP. Square panels with corner brackets, status as glyph plus WORD | `looks.json` (`automatos-interface-look/v0`): accent ×6, ground ×4, display font (Rajdhani, Chakra Petch, Geist Mono), grid 0–30, glow 0–40, scanlines, Auto on/off, motion; fixed text, line and error colours; presets ARC, FORGE, GHOST, NOVA, SIGNAL. Converted to the `automatos-look-schema/v1` knob shape so HUD can become a Design Kit theme later without rework. Saved on the phone [D59] | The Looks drawer as drawn |

Rules every layout follows:
- **The Command Centre is one set of screens.** Board, Calendar, Questions, Deliverables, sheets and settings are built once and dressed by each layout's tokens (Studio radii; Play's 6/8/10/14 radii and serif display; HUD's square panels, brackets and glyph plus WORD statuses). The HUD Command pages (Agents, Missions, Vault, Analytics, Knowledge) are desktop designs and are not in v1.
- **One voice screen, three dresses [D60]:** the HUD voice layout is the voice screen in every style. Studio paints ink and orange rings, Play paints Ember rings with Auto in the centre, HUD keeps its accent.
- **Tokens:** the 24 Studio tokens with `--` keys (`--background`, `--foreground`, …), normalised to hex on the device with the vendored `hsl.ts` (PRD-261's endpoint returns values as the theme wrote them). Play also uses its own `--pl-*` variables from the vendored engine; HUD derives `--bg`, `--accent`, `--accent-ink`, `--accent-line`, `--accent-fill`, `--panel-fill`, `--grid` and `--glow` as its README specifies.
- **Fonts** bundled as TTF: Geist, Geist Mono, Newsreader, Instrument Serif, Bricolage Grotesque, Fredoka (licences in automatos-ai `frontend/app/fonts/`), Rajdhani and Chakra Petch (vendor with their licence files) [D57].
- **Auto the mascot:** the 12-state reducer (vendored); clips are HEVC-alpha `.mp4` through `expo-video` on iOS, `.png` stills on Android and under Reduce Motion; the ring is drawn by the app (mint calm, bronze busy, coral needs help, dusk asleep); Play's shell tint is a Skia colour matrix over the clip.
- **The AI label** ("Auto is an AI" / "{agent} is an AI") sits by the composer on every chat screen and on the voice screen, in fixed colours no look can change, and the composer is disabled if it is not on screen (PRD-264 EUAI-11a).
- **Installed marketplace themes** that declare a `mobile` block appear under Studio in the style picker: the Studio layout painted with the theme's tokens, fonts and mascot from `GET /api/themes/mobile/{install_id}` (PRD-261 M-04). Themes never bring code or layouts in v1 [D58].
- **Accessibility:** nothing below 11 pt; Dynamic Type up to the accessibility sizes with layouts that wrap; every colour status also has a word; Reduce Motion stops loops (HUD's `motion: false`, Play's glow crossfades).

### 4.7 Screens

| Area | Screen | Notes |
|---|---|---|
| Home | Auto thread + needs strip | The server's needs-you rows above the thread; the morning digest arrives as Auto's message; older chats behind a list button [D28] |
| Chat | Thread | Streaming, receipts ("What Auto did"), Auto's cards: Mission suggestion (file it), plan approval, tool approval, task card, withdraw offer, limit and attachment notices [D30]; Stop cancels on the server |
| Chat | Composer | Pill input, round send/stop, [+] camera, photos, files (HEIC converted to JPEG on the phone) [D29]; voice button |
| Command Centre | Board | Every status as filters (including Failed and Cancelled) [D26]; card list sorted as the handoff; ticket sheet with Approve / Send back (note required) / Ask Auto about (ticket as context, then "Update ticket and re-queue") [D31] |
| Command Centre | Calendar | Day view, seven-day strip; Pause/Resume for routines and scheduled tasks; other kinds "Manage in Studio" [D27] |
| Command Centre | Questions | Answer with an option or in your own words; Dismiss (a stopped-run question closes its run, said in the copy); viewers read-only [D16, D17] |
| Command Centre | Deliverables | Gallery like Studio: filter by type, open (text and images inline; PDF, DOCX, XLSX in the system viewer) [D25] |
| Needs strip | Social post awaiting approval | Open it, see the post as it will publish, Approve (exact version) or Request changes with a comment; never from a notification [D45] |
| Settings | Account | Server, edition, workspace, role, Sign out, Remove this phone, privacy policy, Terms, version [D63] |
| Settings | Notifications | The three push types, digest time 07:00 / 08:00 / 09:00 in the phone's timezone, Face ID before approve (on by default) [D19, D22, D24] |
| Settings | Style and look | Studio / Play / HUD / installed themes; each style's look page |
| Voice | Voice screen | Hold to talk (quick-ask), Live (where allowed), Type, Stop, MIC LIVE, transcript, AI label |
| Edges | First open, Not running, Something went wrong, Lost | From Ember's 06–09, dressed per style; "Not running" names the server and, for a self-hosted install, how to start it |
| Every surface | Report this | On Auto messages and Deliverables; reason and an optional note [D15] |

### 4.8 Push

- After sign-in or pairing, and after the permission prompt (asked after the first useful moment, never at launch), the app registers with `POST /api/v1/mobile/devices`: `install_id`, platform, app version, locale, timezone, Expo push token. It keeps the returned `push_key` in SecureStore.
- iOS categories: `automatos.question.{1,2,3}` (one action per option plus "Reply…" text input and Open) and `automatos.open` (Open only, for review and Auto messages). Android channels: Questions, Ready for review, Auto, with RemoteInput for replies and a background task for taps while the app is closed.
- Answer and reply actions need an unlocked phone (`authenticationRequired`) [D18]. The handler verifies `sig` with the `push_key` before posting; on a mismatch it posts nothing and opens the app. Then it posts the answer, marks the notification read, and shows the server's honest result ("Answered #0419, the agent is resuming" or "was already answered").
- Inside the app, approving or answering asks for Face ID first when the setting is on [D19].
- On a self-hosted install, push works only if the operator agreed at pairing (`push.expo`); otherwise the settings screen says so.

### 4.9 Voice

- **Quick-ask (everyone, every edition):** HOLD TO TALK, the Command spec's push-to-talk. On-device speech recognition only (audio never goes to Apple or Google), the transcript is sent with `spokenMode: true`, and the reply is spoken with `expo-speech`. The app shows and speaks the AI notice at the start and every ten minutes in a long session (PRD-264 EUAI-04). "Auto, stop" or STOP cancels the turn.
- **Auto Live (Business on SaaS, any armed self-hosted install):** the Live button mints `POST /api/voice/web-call` and joins with LiveKit's React Native SDK using the returned transport, URL and token; full duplex with barge-in; Auto speaks the AI greeting itself; receipts arrive in the thread over `chat_changed`. The first task is Retell's confirmation that this path is supported; until it lands, Live is hidden and quick-ask carries voice.
- **Screen on, app open** [D33]; no background microphone.
- MIC LIVE is visible whenever the microphone is open; the mic never opens without a press.

### 4.10 Release

- Internal TestFlight for the team (Gerard, Dave, Rikki and other App Store Connect users) [D51]; no Beta App Review needed. Android testers get EAS preview APKs by link.
- The fingerprint loop: JavaScript-only merges ship as over-the-air updates on the `testflight` channel; a native change builds. Native changes are batched per PR.
- Sentry (EU) with chat text, question text, push payloads and call ids scrubbed before sending [D44].
- A CI check fails if the EAS project's enhanced push security is switched on, since self-hosted push depends on it staying off (PRD-266 §8).

### 4.11 Code structure and patterns

**Gerard, 20 Oct:** follow existing patterns, keep code in proper modular folders, keep it clean, and leave room for enterprise sign-in (PRD-257's OIDC).

- **One way in per concern.** All HTTP goes through `src/api/` (an ESLint rule forbids `fetch` anywhere else, as the web forbids raw `fetch('/api…')`); streaming goes through `src/api/stream.ts` (`expo/fetch`).
- **Sign-in is pluggable.** `src/auth/providers/` holds one file per provider behind a small `AuthProvider` interface (`kind`, `getToken()`, `signOut()`, `onExpired()`): `clerk.ts` (SaaS) and `device.ts` (paired). The discovery document's `auth.modes` picks the provider. An enterprise `oidc.ts` (PKCE through `expo-auth-session` against the issuer the discovery document will name) is an added file later, not a rewrite (PRD-266 §4.11). An unknown mode shows "this server needs a newer Automatos Go".
- **Feature folders, small files.** One folder per domain (`chat`, `cc`, `push`, `voice`, `styles`, `connect`, `auth`); files 200–400 lines, never over 800; functions under 50 lines, components under 150, nesting under 4. The lint config enforces the limits the web enforces.
- **Pure logic outside React.** Reducers, parsers, token maths and policy (who may answer, what a style paints) live in plain TypeScript with vitest tests; screens and hooks only wire them. `src/core/` is vendored and never edited by hand (`scripts/sync-core.ts` only).
- **Validate at the boundary.** Every API response and every notification payload is parsed with zod before use; unknown frames and fields are ignored, never crash.
- **Immutability.** State updates return new objects; no mutation of props, query data or arguments.
- **No hardcoded values.** URLs, keys and tunables come from the EAS environment or the discovery document; copy lives in one strings module per feature.
- **Errors.** Never swallowed: each failure maps to the error taxonomy (§4.4) and a user-facing message that leaks no internals; Sentry gets the scrubbed detail.
- **Styles are data.** A layout reads tokens only, never literal colours; the three layouts share the Command Centre screens and differ by tokens and layout components, not by copies of screens.
- **Tests.** `__tests__/` beside the module; parity corpus for the stream; route-manifest check against the pinned automatos-ai SHA.

## 5. User stories

Every story: typecheck, lint and vitest pass in CI (nothing runs on a maintainer's machine); logic in `src/core` and the controllers has unit tests; UI stories attach screenshots from an EAS internal build on an iPhone, in every style the story touches, light and dark where the style has both.

### Wave A0: Scaffold

#### US-001: Repository and scaffold
**Description:** As a builder, I need the app skeleton with the academy's proven build and release setup.

**Acceptance Criteria:**
- [ ] App from the academy template per §4.1, app name "Automatos Go", bundle id and package `com.automatos.app`, scheme `automatos`, iPhone only (`supportsTablet: false`), 16+ in the store metadata notes
- [ ] `CLAUDE.md`, `LICENSE` (Apache-2.0), `README.md`; `malware-scan.yml` kept
- [ ] `runtimeVersion` policy `fingerprint`; `check-release-env.js` requires the Clerk `pk_live_` key for production
- [ ] `testflight.yml` with the in-progress-build guard; the `testflight` environment limited to `main`
- [ ] Branch protection on `main` requires the CI and malware-scan checks

#### US-002: Every native module, one build
**Description:** As the team, we want one native build to carry every module v1 needs, so later waves ship over the air.

**Acceptance Criteria:**
- [ ] All modules in §4.2 installed with their config plugins and usage strings; `expo-doctor` clean
- [ ] A development build and a testflight build both succeed (the first iOS build's credentials are created interactively by Gerard)
- [ ] The Studio app icon and splash (Studio brand mark from automatos-ai `frontend/public/brand/`), light and dark
- [ ] The eight TTF fonts bundled with their licence files

### Wave A1: Core, sign in, connect

#### US-003: Vendored core and parity corpus
**Description:** As a builder, I need the web's pure logic in the app, and a test that tells me when it drifts.

**Acceptance Criteria:**
- [ ] `scripts/sync-core.ts` copies the §4.3 modules at a pinned SHA into `src/core/` and writes `core.lock.json`
- [ ] `ai-sdk-stream.ts` and `turnReducer` handle every frame in PRD-266's digest (chat-id, tool-start/end with `waiting`, tool-data keys, narration retraction, usage, finish, `e:` errors) and ignore unknown keys
- [ ] A corpus of real recorded turns and SSE frames passes; the route-manifest check passes against the pinned SHA

#### US-004: API client and capabilities
**Description:** As the app, I need one client that every screen uses.

**Acceptance Criteria:**
- [ ] Bearer + `X-Workspace-ID`; workspace id read back from `/api/workspaces/current` on every launch
- [ ] Error taxonomy: network, auth (401 → sign-in or re-pair), forbidden (403 → role copy), server, stream
- [ ] Capabilities from the discovery document gate features as §4.4
- [ ] No `fetch` outside `src/api/` (ESLint rule); every response parsed with zod; the lint config enforces the §4.11 size limits

#### US-005: Hosted sign-in
**Description:** As a hosted Studio user, I want to sign in with email code, password or passkey.

**Acceptance Criteria:**
- [ ] `AuthProvider` interface in `src/auth/providers/` with `clerk.ts`; the discovery document's `auth.modes` selects the provider, and an unknown mode shows "this server needs a newer Automatos Go"
- [ ] Clerk sign-in with those three methods only; tokens from `getToken({template: "mobile"})`
- [ ] Second-factor steps work (the academy's step machine)
- [ ] Waitlist, unlinked account (409) and pending invitation responses show the server's words
- [ ] "Create an account in Studio" opens the web; no sign-up in the app

#### US-006: Connect to your own server
**Description:** As a self-hoster, I want to scan the code in Studio and be connected.

**Acceptance Criteria:**
- [ ] In-app QR scanner; the `/go/pair` universal link also opens the flow
- [ ] `device.ts` provider behind the same `AuthProvider` interface
- [ ] Discovery, pairing, device token in SecureStore; HTTPS required except private addresses, which show the "unencrypted home network" note
- [ ] A revoked or rotated-out token returns the user to Connect with a clear message
- [ ] Works against the VPS demo install

#### US-007: Bootstrap, roles and consent
**Description:** As a user, I want the app to know my workspace and role, and to ask once before my words go to AI providers.

**Acceptance Criteria:**
- [ ] Role drives what is shown: viewers read-only, editors and up can chat and answer [D16, D17]
- [ ] The AI-provider consent sheet names the providers from `ai_providers` and blocks the first message until agreed; shown again when the list changes
- [ ] The AI label component exists and is used by every chat and voice screen

### Wave A2: Studio layout and chat

#### US-008: Home and thread
**Description:** As a user, I want to open the app and talk to Auto, with what needs me at the top.

**Acceptance Criteria:**
- [ ] Studio home as the handoff: header, needs strip (server rows), Auto thread, older chats list
- [ ] Streaming replies with receipts; Stop cancels on the server; reopening a chat shows "Auto is working…" when a turn is in flight
- [ ] Auto's cards work (file a Mission, approve a plan, grant or deny a tool) and refuse honestly when the role cannot act

#### US-009: Composer and attachments
**Description:** As a user, I want to send a photo or a file to Auto.

**Acceptance Criteria:**
- [ ] Pill composer; Return inserts a newline; the button sends or stops
- [ ] [+] camera, photo library and files; HEIC is converted to JPEG before upload; uploads use `POST /api/attachments`
- [ ] Report this on Auto messages (reason, note)

### Wave A3: Command Centre

#### US-010: Board and ticket sheet
**Description:** As a user, I want to see the board and act on a ticket from my phone.

**Acceptance Criteria:**
- [ ] Filters for every status including Failed and Cancelled; the server's needs-you number on the Command Centre button
- [ ] Ticket sheet: Approve, Send back (note required), Ask Auto about (context + re-queue)
- [ ] Live updates while open; refetch on resume

#### US-011: Calendar
**Description:** As a user, I want today's schedule and to pause a routine.

**Acceptance Criteria:**
- [ ] Day view with the seven-day strip and kind colours; paused items greyed
- [ ] Pause/Resume for routines and scheduled tasks; other kinds "Manage in Studio"

#### US-012: Questions and social approvals
**Description:** As an owner, admin or editor, I want to answer questions and approve social posts.

**Acceptance Criteria:**
- [ ] Answer with an option or free text; Dismiss with the stopped-run copy; viewers see read-only with the reason
- [ ] Social post approval shows the post as it will publish and approves that exact version; Request changes needs a comment

#### US-013: Deliverables
**Description:** As a user, I want to look at what was made.

**Acceptance Criteria:**
- [ ] Gallery with type filters and load more; text and images inline; PDF, DOCX, XLSX open in the system viewer after an authenticated download
- [ ] Report this on a Deliverable

### Wave A4: Push

#### US-014: Registration and settings
**Description:** As a user, I want notifications for what needs me, and control over them.

**Acceptance Criteria:**
- [ ] Permission asked after the first answered question or first reply, not at launch
- [ ] Registration and `push_key` storage; sign-out unregisters
- [ ] Notifications settings: three types, digest time, Face ID before approve (on by default)

#### US-015: Actions from the notification
**Description:** As an owner, admin or editor, I want to answer a question from the notification on my unlocked phone.

**Acceptance Criteria:**
- [ ] Categories and channels as §4.8; option and Reply actions require an unlocked device
- [ ] Signature verified before posting; mismatches post nothing and open the app
- [ ] Works when the app was closed (cold start) on both platforms; the honest result appears as a notification or toast

### Wave A5: Styles

#### US-016: Style system and picker
**Description:** As a user, I want to flip between Studio, Play and HUD.

**Acceptance Criteria:**
- [ ] Tokens, fonts and the three layouts per §4.6; the choice is kept on the phone
- [ ] The Command Centre, sheets and settings render in all three styles
- [ ] Installed marketplace themes with a `mobile` block appear under Studio and paint from `GET /api/themes/mobile/{install_id}`

#### US-017: Play: Companion layout and look page
**Description:** As a user, I want Play on my phone, with Auto and my look.

**Acceptance Criteria:**
- [ ] Ember screens 01–05 as the Companion layout; edge screens 06–09 for every style
- [ ] Look page with the six knobs and the five presets; save, rename, delete; synced through the looks API so Studio in Play shows the same look
- [ ] Auto with the 12 states, the app-drawn ring, shell tint, stills on Android and under Reduce Motion

#### US-018: HUD layout and look page
**Description:** As a user, I want the HUD style with my own accent and glow.

**Acceptance Criteria:**
- [ ] The phone core from the Command spec; Command Centre screens in HUD dress (square panels, brackets, glyph plus WORD)
- [ ] Looks drawer with `looks.json`'s knobs and presets, saved on the phone; scanlines, grid and glow from the look; motion off under Reduce Motion

### Wave A6: Voice

#### US-019: Quick-ask and the voice screen
**Description:** As a user, I want to talk to Auto hands-free with the screen on, in any style.

**Acceptance Criteria:**
- [ ] HOLD TO TALK with on-device recognition only; `spokenMode` replies spoken aloud; STOP and "Auto, stop" cancel
- [ ] The voice screen in all three dresses [D60]; MIC LIVE whenever the mic is open; transcript with YOU / AUTO
- [ ] The app speaks and shows the AI notice at the start and every ten minutes

#### US-020: Auto Live
**Description:** As a Business user, I want a real conversation with Auto, interruptions included.

**Acceptance Criteria:**
- [ ] Retell's confirmation is recorded in this PRD before the story starts
- [ ] Live joins with the LiveKit React Native SDK using the mint's transport fields; barge-in works; the server's AI greeting plays
- [ ] Hidden when the plan or the server does not allow it; the server's refusal reasons are shown as written

### Wave A7: Release

#### US-021: Store duties and release hardening
**Description:** As Automatos, we want the app ready for the team at WebSummit and for review after it.

**Acceptance Criteria:**
- [ ] Privacy policy (including how to have a login removed) and Terms links; 16+ declared; no account or workspace deletion in the app [D63]
- [ ] Sentry (EU) with scrubbing proven by a test on a sample event
- [ ] Accessibility pass at the largest Dynamic Type size in every style (screenshots)
- [ ] Internal TestFlight build with the team added; a WebSummit checklist (sign in, pair with the VPS, answer from a notification, flip styles, change a look, quick-ask) run on Gerard's phone

## 6. Functional requirements

- FR-1: The app must offer hosted sign-in (Clerk email code, password, passkey) and "connect to your own server" by QR pairing, and nothing else.
- FR-2: Every API call must carry the user's bearer and the confirmed workspace id.
- FR-3: Features must be gated on the server's declared capabilities, never on its version.
- FR-4: The home screen must show the Auto thread with the server's needs-you rows above it.
- FR-5: The Command Centre must offer Board, Calendar, Questions and Deliverables with the actions in §4.7, limited by role.
- FR-6: A question notification must be answerable from an unlocked phone, after the payload signature verifies.
- FR-7: The user must be able to flip between Studio, Play and HUD, and change Play's and HUD's looks with a live preview.
- FR-8: No look may change the AI label's colours or hide it.
- FR-9: Quick-ask must use on-device speech recognition and spoken-mode replies; Auto Live must use the native LiveKit client.
- FR-10: The app must never load web content or downloaded code for a core flow.
- FR-11: The app must not show plans, credits, prices or purchase links.
- FR-12: The app must offer no account or workspace deletion; deleting a workspace stays in Studio.

## 7. Non-goals

By Gerard's decisions, not deferred by this PRD:
- Android store listing and a Play Console account [D10]; iPad [D38].
- Sign-up, social logins, Sign in with Apple [D5, D6]; enterprise runtime Clerk discovery [D1].
- Billing surfaces [D8]; the enterprise proof of concept [D2].
- Plan mode toggle [D30]; pause for playbooks and social posts [D27].
- Voice with the screen off or in the background [D33].
- Marketplace themes choosing layouts or contributing code; theme browsing and installing on the phone (installing stays in Studio) [D58].
- The HUD desktop pages (Agents, Missions, Vault, Analytics, Knowledge) and a multi-workspace switcher.

## 8. Technical considerations and risks

- **Usage budget.** PRD-261's remaining waves, PRD-266's three waves and this PRD's eight waves all fall inside 21 Oct to 8 Nov on the same subscriptions. Parallel lanes spend the weekly allowance sooner; if it runs out mid-wave, everything waits for the reset. Lanes are sized to the remaining budget (Opus where judgment matters, Sonnet for mechanical stories and verifiers); more capacity is Gerard's call (§9).
- **Build quota.** All native modules land in A0. Every later change to `app.json`, a config plugin or a native dependency costs an iOS build from the 15 a month the two apps share.
- **Retell and LiveKit.** Joining Retell's call from LiveKit's React Native SDK is not documented by Retell. Live stays hidden until Retell confirms; quick-ask covers voice either way.
- **Clerk.** Build against `pk_live_` after the 27 Oct cutover. A build made earlier can switch keys over the air if the production instance already lists the app; the native `azp` marker must be on #1216 before it merges, or every phone sign-in fails after the flag flips.
- **Headless actions.** Answering from a notification on Android when the app was closed needs a background task; tested on a real device before WebSummit.
- **Fonts and media.** Rajdhani and Chakra Petch must be fetched with their licence files; mascot clips come from automatos-ai `frontend/public/auto/` (rights confirmed 20 Oct).

## 9. Waves and dates (proposed; dates and any cut are Gerard's call)

| Wave | Stories | Needs | Proposed done |
|---|---|---|---|
| A0 Scaffold | US-001, US-002 | App Store Connect record; Gerard for the first iOS credentials | Fri 23 Oct |
| A1 Core and connect | US-003..US-007 | PRD-266 W1 (pairing, discovery); Clerk cutover 27 Oct | Wed 28 Oct |
| A2 Studio chat | US-008, US-009 | PRD-266 W1 (`spokenMode` not needed yet) | Fri 30 Oct |
| A3 Command Centre | US-010..US-013 | PRD-266 W1 (editors answer) | Mon 2 Nov |
| A4 Push | US-014, US-015 | PRD-266 W2 | Wed 4 Nov |
| A5 Styles | US-016..US-018 | PRD-261 M-04 for installed themes; Play installed after A-19 | Thu 5 Nov |
| A6 Voice | US-019, US-020 | PRD-266 W1 (voice); Retell's confirmation for US-020 | Fri 6 Nov |
| A7 Release | US-021 | PRD-266 W3 | Sat 7 Nov; freeze Sun 8 Nov |

## 10. Success metrics

- The WebSummit checklist (US-021) passes on Gerard's phone against hosted Studio and the VPS demo.
- Time from opening the app to the first reply from Auto under 5 seconds on Wi-Fi after sign-in.
- Answering a question from a notification takes two taps on an unlocked phone.
- Zero crash-free-session regressions in Sentry across the last three builds before WebSummit.

## 11. Open questions

1. **WebSummit cut line.** If the usage budget cannot carry all eight waves by 8 Nov, which ships first? A proposal for Gerard to accept or change: A0, A1, A2, A4 and the HUD voice screen with quick-ask (US-019) are the demo's spine; Play and HUD look pages and Auto Live follow.
2. **Studio looks.** Studio offers only Light / Dark / System, as on the web. Should the phone's Studio style also get an accent or font picker?
3. **Older chats.** Is a simple list of recent chats (newest 50, paged) enough, or do you want search on the phone?
