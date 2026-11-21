# PRD-003: Sign in with my organisation

**Status:** Draft for the owner, 21 Nov 2026. Nothing here is built in the app. · **Owner:** Gerard · **Written:** 21 Nov 2026.
**Scope:** Automatos Go signs a person in to an Automatos install that uses its organisation's own identity provider (OpenID Connect), keeps them signed in, signs them out, and handles the install ending the sign-in. iOS first; Android kept compiling (rule 15.1).
**Depends on:** automatos-ai **PRD-277** (enterprise OIDC sign-in), Wave 6 "Phones": US-601 (a device token's maximum age), US-602 (the phone's start and the confirmation page), US-603 (the exchange). This PRD is that PRD's US-604. The server side is built on core's PRD-277 branch and is **not yet on core's `main` or in a release**: everything below about the server is "as specified in core PRD-277", never "live". The hosted service (SaaS) is not touched.
**Human-gated:** decisions G-1 to G-12 (§10); a review install with a test identity provider for App Review (G-8); on-device checks on the owner's phone (US-311).

## 1. Introduction

A company that runs its own Automatos install signs its people in with the organisation's identity provider: the same account they use for everything else at work. Core PRD-277 adds that to Studio on the web; it is built on core's PRD-277 branch and not yet released. The phone app today has two ways in, and neither fits that company: the hosted Clerk sign-in (hosted service only) and pairing with a code from Studio (any own install). Pairing works, but it makes every person first sign in to Studio on a computer, open Settings, Phones & devices, and scan a code.

This PRD adds a third way in, for an own install only: **Sign in with my organisation**. The person types or scans the install's address as today, the app reads the install's discovery document, and where the install says it signs phones in through its identity provider the app offers the button. The sign-in itself happens in the phone's system sign-in browser, on the install's pages and the identity provider's pages. The app never sees the identity provider, its tokens or the person's password. What comes back is a one-time code that the app exchanges, with a secret only it holds, for the same kind of device token a paired phone holds. From there the phone is a paired phone in every way the app already handles: the same record in the keychain, the same token rotation, the same removal from Studio.

That shape is core's decision D-8 (core PRD-277 §8): the phone talks to Automatos, and Automatos talks to the identity provider. It supersedes PRD-001 §4.11's plan for an `oidc.ts` provider that would talk to the identity provider through `expo-auth-session`.

Server references below are core repository paths (automatos-ai) with lines read on core's PRD-277 Wave 6 branch at commit `0a0a0f5ea`. Lines may move before that branch merges; the core PRD-277 section named beside each is the reference that holds. App references are this repository at `d32ca3e`.

The decisions this PRD asks for are numbered **G-1 to G-12** (§10), so they are never confused with core PRD-277's D-numbers.

## 2. What exists today in the app

| Area | What it does today | Where |
| --- | --- | --- |
| Welcome | Two ways in: "Sign in to Automatos" (hosted) and "Connect to your own server". | `app/welcome.tsx:2`, `src/connect/strings.ts:108` |
| Discovery | Reads `GET /.well-known/automatos.json` (schema, edition, `api_url`, `web_url`, `auth.modes`, `auth.clerk`, `pairing.enabled`, `push.expo`, capabilities). Unknown modes are kept; there is no `auth.oidc` field, so the block core adds is ignored. | route `src/api/routes.ts:20`; schema `src/api/discovery.ts:85-102`; hosted defaults `:111-122` |
| Auth modes | The app knows the mode names `clerk`, `device`, `oidc`; only Clerk and device providers exist. | `src/auth/providers/types.ts:6`, `:11-23`; `src/auth/providers/registry.ts:10-13`; `src/auth/select.ts:19` |
| Connect's form | Continue refuses unless **both** the address and the pairing code are valid: `submit` parses both and returns to the fields with each field's refusal otherwise. The `checking` state and the confirm card's details both carry the code. | `src/connect/flow.ts:123-143` (`submit`), `:45-51` (`checking`), `:65-66` (the `submit` action); `src/connect/confirm.ts:34-36`, `:72-85` |
| What Connect offers | `NextStep` has four values: `pair`, `pairing_off`, `hosted`, `unsupported`. Only `pair` reaches the confirm card; every other value is a failure (`flow.ts:154-158`). There is no value for an organisation sign-in, nor for "organisation first, pairing beside it". An install listing only `oidc` is `unsupported`, which says to update the app. | `src/connect/next-step.ts:15-23`, `:52-62`; `src/connect/server-support.ts:23-28`; copy `src/connect/strings.ts:64` |
| The confirm card | One primary button (Pair, or Try again) and Back; the view model has one `primaryAction` (`'confirm' \| 'back'`). It shows the document's `api_url` when it names another address than the one typed (`apiUrlDiffers`, `documentApiUrl`). | `src/connect/screens/ConfirmCard.tsx:106-130`; `src/connect/screens/connect-view.ts:145-195`; `src/connect/confirm.ts:79-81` |
| The gate | Three call sites decide whether an own server is usable, all through `ownDiscoveryRefusal(discovery)`, which accepts only `device` listed with pairing on: the launch view (`src/app-state/gate.ts:190-197`), `serverSupported` (`gate.ts:200-207`, consumed by `src/app-state/use-launch.ts:72` to start the workspace read) and Connect's `nextStepFor` (`src/connect/next-step.ts:57`). Both gate functions take `(server, discovery)` or `(discovery, source)` only; none sees how the phone signed in. | as listed; `src/connect/server-support.ts:23-28` |
| Pairing | `POST /api/v1/mobile/pair` with the code; the answer becomes the paired record; `switch.connectTo` runs the one clearing, then saves it. | `src/connect/routes.ts:8-15`; `src/connect/switch.ts:190-194` |
| The paired record | ONE keychain item `automatos.paired-server.v1` through the key registry, class `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: `origin`, `webUrl`, `serverName`, `edition`, `insecure`, `pushExpo`, `deviceId`, `workspaceId`, `token` (`amd_`), `rotateAfter`, `pairedAt` (this phone's clock). | `src/connect/device-store.ts:33-48`, `:157-160`; `src/storage/secure-registry.ts:21`; `src/lib/secure-store.ts:12-13`; prefix `src/connect/config.ts:44` |
| Install id | 16 random bytes as base64url, kept in the keychain as the one item deliberately **outside** the key registry, so it survives sign-out and a reinstall; sent with `POST /pair`. | `src/connect/install-id.ts:1-7`, `:17`; `src/storage/secure-registry.ts:24-25` |
| Token rotation | `POST /api/v1/mobile/devices/{id}/rotate` when `rotate_after` passes; `409 token_superseded` handled. | `src/connect/rotation.ts:69`, `:123`, `:157`; `src/connect/config.ts:99` |
| A 401 on the device lane | `device_revoked` → "removed"; `device_pairing_required`; anything else, including core's new `device_token_expired`, → "ended". The record is cleared and Connect shows why, naming the server. | `src/connect/expiry.ts:12-38`; `src/auth/providers/device.ts:109-126`, `:140-151`; copy `src/connect/strings.ts:80-82` |
| Error kinds | 401 `auth`, 403 `forbidden`, 404 `not_found`, 409 `conflict`, 429 `limit`, anything else `server`. | `src/api/errors.ts:101-111` |
| Leaving | Sign out (hosted), Forget this server, Remove this phone (`DELETE /api/v1/mobile/devices/{id}` with a 10 s limit, then forget), a new pairing and a session the server ended all run ONE `clearUserData`. | `src/connect/switch.ts:155-197`; `src/connect/remove-device.ts:1-11`; `src/connect/config.ts:105` |
| App scheme and links | Scheme `automatos`; universal links on the hosted Studio domain only (`applinks:ui.automatos.app`); the Android intent filter sends https `ui.automatos.app` paths starting `/go`, `/command-center` and `/chat` to the app. Every link goes through one table. `systemLinkPath` reduces both `automatos://go/signed-in` and `https://ui.automatos.app/go/signed-in` to the same path `/go/signed-in`, and an entry's `from` is only `'app' \| 'system'`, so the table cannot tell the app's own scheme from the https form. There is no entry for `/go/signed-in`: it opens Lost. | `app.json:9`, `:19`, `:186-208`; `src/navigation/web-links.ts:46-52`, `:198-210`, `:276-283`, `:313-325`; `app/+native-intent.tsx` |
| Browser | Links to Studio open the system browser with `Linking.openURL`. `expo-web-browser` (~15.0.11) and `expo-auth-session` (~7.0.11) are dependencies, installed for Clerk's optional peers and not used by the app's own code. `expo-crypto` is used (random bytes; the push wave's own SHA-256 file, which says it is the only push file that imports it). | `src/cc/open-studio.ts:13`; `package.json:39`, `:43`, `:67`; `docs/native-modules.md`; `src/connect/install-id.ts:9`; `src/push/signature/sha256-native.ts:1-10` |
| Store record | The review notes say sign-in is Automatos's own and there is "no third-party or social sign-in". | `docs/release/app-review-notes.md:118-119` |

## 3. Goals

- A person whose organisation runs Automatos signs in on the phone with their work account, without a computer and without a pairing code.
- The phone never holds the identity provider's tokens or the person's password; it holds only the install's own device token, stored and rotated as a paired phone's is.
- Every answer the install can give has one meaning in the app and one sentence on screen.
- Hosted sign-in and pairing behave exactly as they do today.
- No merge shows a half-built flow (§5.13).
- The app standard's rules are checked one by one, and Apple's sign-in rule is read and its readings put to the owner.

## 4. Non-goals

- Talking to the identity provider from the app (`expo-auth-session` against the provider, PRD-001 §4.11): superseded by core D-8.
- Sign-up, account creation, Sign in with Apple, social sign-in.
- Organisation sign-in on the hosted service. The hosted service never lists `oidc` (core `orchestrator/tests/test_prd266_discovery.py:288-289`).
- Choosing a workspace on the phone. A person in several workspaces is refused by the install and pairs with a code from Studio instead (core PRD-277 §5.7 item 7).
- A change to Welcome: the organisation's install is reached through "Connect to your own server", as any own install is.
- Step-up (Face ID before approving stays as it is; the install's own step-up is the browser's).
- Universal links for installs' own domains (core PRD-277 §5.7 item 9: a store app can claim only domains fixed in its build).
- An Android release (rule 15.1).

## 5. Design

### 5.1 When the button is offered

The server says so; the app never guesses from the address. "Sign in with my organisation" is offered only when the install's discovery document carries both:

1. `oidc` in `auth.modes`, and
2. an `auth.oidc` block the app can use: `start_url` exactly `<origin>/api/v1/auth/oidc/start` and `exchange_url` exactly `<origin>/api/v1/mobile/sign-in/exchange`, where `<origin>` is the `https` origin that answered discovery (G-2); `app_link` exactly `go`; `code_challenge_method` exactly `S256`.

Core builds that block in `orchestrator/services/mobile/discovery.py:185-197` (`_oidc_auth_and_pairing`) from `OIDC_START_PATH = "/api/v1/auth/oidc/start"` (`:69`), `OIDC_EXCHANGE_PATH = "/api/v1/mobile/sign-in/exchange"` (`:71`) and `GO_APP_LINK = "go"` (`:73`). In the enterprise edition it lists `auth.modes` as `["oidc", "device"]` when pairing is on and `["oidc"]` when it is off, with `clerk: null` and `pairing.enabled` as set (core PRD-277 §5.7 item 1; `orchestrator/tests/test_prd266_discovery.py:221-222`, `:232`, `:243`).

**The addresses are the install's configured one, whatever was typed.** In the enterprise edition core builds `api_url`, `web_url`, `oidc.start_url` and `oidc.exchange_url` from the install's configured public address (`FRONTEND_URL`), "whatever the request's host or scheme" (core `orchestrator/services/mobile/discovery.py` module docstring; `orchestrator/services/mobile/urls.py:45-54`, `api_url` returns `web_url()` where `api_on_public_address`). A person who typed another name for the same install (an internal name, an IP address) therefore gets a block on a different origin. The app does not follow it (G-2, rule 13.2c); it tells the person the address to enter instead, from the address the confirm card already computes (`apiUrlDiffers`, `documentApiUrl`: `src/connect/confirm.ts:79-81`).

The parse follows rule 13.2: zod, unknown fields ignored, a malformed block read as absent (never as a failed discovery).

| `auth.modes` | `auth.oidc` | `pairing.enabled` | `NextStep` (new values in bold) | Connect shows |
| --- | --- | --- | --- | --- |
| `oidc`, `device` | usable | true | **`sign_in_or_pair`** | the card with **Sign in with my organisation** first and **Pair with a code** beside it (G-3) |
| `oidc` | usable | false | **`sign_in`** | the card with **Sign in with my organisation** only |
| `oidc`, `device` | on another origin | true | `pair` | today's card; its existing row shows the document's address, and a line under it: "To sign in with your organisation, enter {documentApiUrl}." |
| `oidc` | on another origin | false | **`sign_in_elsewhere`** | "{server} signs phones in at {documentApiUrl}. Enter that address to sign in with your organisation." with the address field prefilled with it |
| `oidc`, `device` | missing or malformed | true | `pair` | today's card |
| `oidc` | missing or malformed | false | `unsupported` | today's words ("Update the app, then try again") |
| `device` | n/a | true / false | `pair` / `pairing_off` | unchanged |
| hosted (`clerk`) | n/a | n/a | `hosted` | unchanged: Sign in to Automatos |

### 5.2 Connect accepts an address alone

Today Continue needs a valid code before discovery is read (`src/connect/flow.ts:123-143`). An organisation sign-in has no code, so:

- `submit` takes the code as optional. A valid address with an **empty** code goes to `checking` with no code; an address with a code that does not parse is still refused with the code's reason, as today.
- `checking` and `ConfirmDetails` carry `code` as optional (`flow.ts:45-51`, `confirm.ts:34-36`).
- When discovery answers `pair` and there is no code, Connect goes back to the fields with today's `empty` refusal on the code (`src/connect/pair-code.ts:13-18`): a pairing server asks for the code with today's words, one discovery read later than today.
- `sign_in_or_pair` with no code: the card's **Pair with a code** goes back to the fields with the code field focused; with a code, it pairs as today.
- A scan or a pairing link always carries a code, so it behaves as today (`startConnect`, `flow.ts:269-273`).
- The confirm view model gains a second action: `primaryAction` becomes one of `'sign_in' | 'confirm' | 'back'` with an optional `secondaryAction: 'confirm'` (`connect-view.ts:145-195`), and `ConfirmCard` draws the second button (`ConfirmCard.tsx:106-130`). KC8 holds: nothing signs in or pairs by itself; only a press on the card starts either.

### 5.3 The flow, step by step

| # | The phone | The person sees |
| --- | --- | --- |
| 1 | Welcome → Connect: the person types or scans the address. The app reads discovery from that origin with no bearer (§5.2). | Today's Connect screen, then "Checking {address}…". |
| 2 | Discovery lists organisation sign-in (§5.1). | The confirm card: the server's name and address, **Sign in with my organisation**, and **Pair with a code** when pairing is on. |
| 3 | The person taps the button. The app makes a PKCE verifier and its challenge (§5.4), reads its install id, and builds the start address (§5.5). | The button shows it is working; nothing else changes. |
| 4 | The app opens the system sign-in session at the start address (§5.5). | iOS: the system's sign-in sheet over the app (and, unless the session is ephemeral, the system's alert asking to allow "Automatos Go" to use the install's address to sign in; G-1). |
| 5 | Nothing: the install redirects to the organisation's identity provider and asks it for a fresh sign-in: `max_age=0` always, and `prompt=login` where the provider takes it (core `orchestrator/core/auth/oidc_sign_in.py:299-322`, docstring `:305`; core PRD-277 §5.7 item 3). | The organisation's own sign-in page. |
| 6 | Nothing: the install's callback checks the sign-in and, when it is accepted, answers `303` to its own page `/sign-in/phone` (core `orchestrator/core/auth/phone_sign_in.py:61-64`). | The install's page: who is signing in, to "Automatos Go", on which phone, and to continue only if they started this from the app; **Continue** or **Cancel** (core PRD-277 §5.7 item 4). |
| 7 | The page's Continue answers `{"app_link": "automatos://go/signed-in?code=<code>"}` and opens it (core `orchestrator/api/phone_sign_in.py:111-121`; `frontend/components/enterprise/phone-sign-in-confirm.tsx:93`). The system session hands the link to the app (§5.6). | The page says it is opening the app; the sheet closes; the app shows "Finishing sign-in…". |
| 8 | The app checks the link (§5.6) and at once sends the exchange with the code and its verifier (§5.7). | "Finishing sign-in…" |
| 9 | On `200`, the app runs today's `connectTo`: the one clearing of whatever was on the phone, then the record saved (§5.7). | Today's next steps after pairing: the AI-provider consent step, then Home. |

Each failure has its words in §5.8. A failure before step 9 changes nothing on the phone: the person's current session, hosted or own, stays as it was, as a failed pairing does today.

### 5.4 PKCE: who makes the verifier, where it is held, for how long

- **Made by the app**, per attempt: 32 random bytes from `expo-crypto` (`getRandomBytesAsync`, as `src/connect/install-id.ts:9` uses), written as base64url without padding, which gives 43 characters of RFC 7636's unreserved set (core accepts 43 to 128: core PRD-277 §5.7 item 2; cap `orchestrator/services/mobile/sign_in_codes.py:62`).
- **The challenge** is BASE64URL(SHA-256(verifier)) without padding, 43 characters (core `orchestrator/core/models/mobile_devices.py:96` `CODE_CHALLENGE_LENGTH = 43`; `orchestrator/core/auth/phone_sign_in.py:52`, S256 only). The SHA-256 is `expo-crypto`'s `digest` behind a small port of the sign-in's own (one native file, as the push wave keeps its own in `src/push/signature/sha256-native.ts`), so vitest checks the challenge in node with `node:crypto`. The push wave's file is not shared.
- **Held in memory only**, inside the one attempt (§5.6). Never in the keychain, the encrypted store, the query cache, a log, Sentry or a link.
- **Dropped** when the attempt ends (§5.6), when the person leaves Connect, and in any case 16 minutes after it was made: the install keeps a started sign-in for 10 minutes (`orchestrator/core/auth/oidc_pending.py:73` `SIGN_IN_TTL_SECONDS = 600`), the confirmation page for 5 (`phone_sign_in.py:64`, 300 s) and the code for 1 (`sign_in_codes.py:58`), so no answer can be usable after that. An app the system ends in between loses it; the install's code then expires unspent (§5.12).

### 5.5 The system sign-in session (not a web view)

The app opens the start address: `<origin>/api/v1/auth/oidc/start` (the path checked against `start_url` in §5.1) with exactly these five parameters, each once (core `orchestrator/core/auth/phone_sign_in.py:54` `START_PARAMS`; core PRD-277 §5.7 item 2):

| Parameter | Value |
| --- | --- |
| `app_link` | `go` (the key, never an address; core `phone_sign_in.py:49` maps it) |
| `code_challenge` | the 43-character challenge (§5.4) |
| `code_challenge_method` | `S256` |
| `install_id` | the install id the app sends `POST /pair` (8 to 128 of `A-Z a-z 0-9 _ -`; core `orchestrator/core/models/mobile_devices.py:85`, `:98-99`; app `src/connect/install-id.ts:17`) |
| `platform` | `ios` or `android` (core `phone_sign_in.py:53`) |

**The API:** `WebBrowser.openAuthSessionAsync(startAddress, 'automatos://go/signed-in', { preferEphemeralSession })` from `expo-web-browser`. On iOS it runs `ASWebAuthenticationSession`, the system's own sign-in sheet; on Android it opens a Custom Tab and waits for the app link. It resolves `{type: 'success', url}` when the session receives the app link, or `cancel` / `dismiss` when the person closes it.

**Why this and not anything else:** the app has no web view and never will (CLAUDE.md "Never"; rule 13.8), so a page inside the app is ruled out. `Linking.openURL` (how Studio links open today) hands the page to Safari, which cannot hand the answer back to a waiting call and leaves the sign-in open in the person's browser. The system sign-in session is the platform's sanctioned way to sign in through a website: the app cannot read or change the page, the person sees the real address bar, and the answer comes back to the session that asked for it. Core PRD-277 §5.7 item 2 names the same two mechanisms.

**Ephemeral (G-1):** recommended on. iOS then starts the session without the browser's stored cookies and keeps none afterwards, so a work sign-in does not linger in Safari's shared state on the phone. The effect on the system's consent alert is to be confirmed on a phone (US-311). Android has no ephemeral option.

### 5.6 The return through the app link

**The exact set.** Core has one app link: `APP_LINKS = {"go": "automatos://go/signed-in"}` (core `orchestrator/core/auth/phone_sign_in.py:49`). It carries exactly one of:

- `code=<code>`: 256 random bits, base64url, at most 64 characters (core `orchestrator/services/mobile/sign_in_codes.py:56`, `:60`), alive 60 seconds (`:58`), spent by the first exchange that finds it (`:175-202`); or
- `error=<code>`: one of `sign_in_refused`, `sign_in_not_allowed`, `identity_provider_unavailable`, `sign_in_failed` (core PRD-277 §5.7 item 5; `orchestrator/api/auth_oidc.py:155-162`). Core's list of sign-in codes has seven (`orchestrator/core/auth/sign_in_flow.py:123-130`); the other three are never sent to a phone: `sign_in_expired` goes to the web app's `/sign-in` page (core PRD-277 §5.7 item 5), and `step_up_refused` and `step_up_no_auth_time` belong to the browser's step-up, which a phone's start never is (§5.7 item 2).

Core answers the app with nothing else (`phone_sign_in.py:115-118` `app_answer`). There is **no `state` parameter** in the contract: the start's state and nonce are between the install and the identity provider (core PRD-277 §5.7 item 3), and the PKCE verifier, which only this app holds, ties a code to this app's attempt.

**One attempt, one consumer, one exchange.** These are the app's rules:

1. **At most one attempt** at a time. An attempt moves `open` (the session is showing) → `exchanging` → `done`; a second tap while one is `open` or `exchanging` does nothing.
2. **The session's result is the only consumer.** On iOS the app link reaches the app only as the session's `success` result. On Android the session receives it from the system's link events while it is open, and resolves `success` with it; the app takes that result, and only that, as the attempt's answer.
3. **The router ignores the link while an attempt is open or exchanging.** The table's entry (below) hands the link to nothing, opens nothing new and leaves the attempt, its verifier and the session as they were. So on Android, where both the session and the router see the same link, it is acted on once.
4. **One exchange per attempt.** The first `success` that passes the checks moves the attempt to `exchanging`; anything delivered after that is ignored. The verifier is dropped when the exchange answers, whatever the answer.
5. **A result that fails the checks ends the attempt**: the verifier is dropped, nothing is sent, and the person sees "didn't finish".
6. **With no attempt open** (none started, or the app was ended and started again), the router's entry shows "That sign-in didn't finish here. Start it again from Connect." and sends nothing anywhere.

**What the app checks** on the session's result:

1. The scheme is `automatos`, the host `go` and the path `/signed-in` exactly.
2. The query holds exactly one of `code` and `error`, each once (rule 5.2's duplicate rule), nothing over the table's limits; any other name is ignored.
3. `code` is base64url, 1 to 64 characters, taken exactly as it came. `error` is compared against the four codes; an unknown one reads as `sign_in_failed`.

**The link table must know the scheme.** Today `systemLinkPath` reduces both `automatos://go/signed-in` and `https://ui.automatos.app/go/signed-in` to `/go/signed-in` (`src/navigation/web-links.ts:276-283`), an entry's `from` is only `'app' | 'system'` (`:46-52`), and the Android intent filter already sends https `/go*` paths to the app (`app.json:186-208`). So:

- `systemLinkPath` returns the path **and its source**: `'scheme'` for `automatos://`, `'https'` for the claimed host, `'path'` for a bare path the router hands over.
- `Entry.from` gains that source, so an entry can be the app scheme's alone. Existing entries keep what they take today.
- The new entry: path `/go/signed-in`, from the app scheme only, reading `code` and `error`, opening a small screen that follows rules 3 and 6 above, never logged (the form the record asks for at `docs/app-standard-record.md:227-229`).
- `src/navigation/__tests__/system-links.test.ts` pins that the https form, `https://ui.automatos.app/go/signed-in?code=…`, opens Lost, and that the scheme form with nothing pending opens the "didn't finish" screen.

### 5.7 The exchange and storing the token

**Exchange** (core PRD-277 §5.7 item 6; `orchestrator/api/mobile_devices.py:214-229`, `:510-540`):

```
POST <origin>/api/v1/mobile/sign-in/exchange
{"code": "<code>", "code_verifier": "<verifier>", "name": "<phone name>", "app_version": "<version>"}
```

- The client calls a **fixed path** (`Route.path` is fixed in the route table, `src/api/routes.ts:8-14`) on the origin that answered discovery. `exchange_url` from discovery is used only to check that it names that origin and that path (§5.1); it is never called as given.
- The route goes in the connect feature's table (`src/connect/routes.ts:8-15`) as `{ method: 'POST', path: '/api/v1/mobile/sign-in/exchange', pendingUpstream: 'PRD-277 US-603' }`, the mark `npm run check:routes` allows while the pinned manifest lacks the route (`scripts/check-routes/match.ts:27`, `:109-119`), and reports for removal once it lands.
- The start path is not a client route (the client never calls it; the system browser opens it), so it is a constant in `src/connect/config.ts`, not a route-table entry.
- `name` and `app_version` are the values `POST /pair` already sends, already clipped to the server's limits (`src/connect/device-info.ts:27`, `:35`; `src/connect/config.ts:54-55`, 120 and 32, as core's `NAME_LENGTH` and `APP_VERSION_LENGTH`, `orchestrator/core/models/mobile_devices.py:86-87`).
- No bearer, no `X-Workspace-ID`, no cookie; sent once, at once (the code lives 60 seconds), never retried: a code is spent by the first exchange that finds it, whatever the answer.

`200` (with `Cache-Control: no-store`) is `{"device_id", "workspace_id", "token", "rotate_after"}`, the token an `amd_` device token of kind `oidc`, shown once. The app parses it with today's pairing schemas (`src/connect/schemas.ts`), under the client's body cap (rule 13.2a).

**Storing** (rule 13.6): the answer plus what discovery said (`origin`, `webUrl`, `serverName`, `edition`, `insecure`, `pushExpo`) becomes a `PairedRecord`, saved through `switch.connectTo` after the one clearing, in the same keychain item, class and registry as a pairing (`src/connect/device-store.ts:141-148`). `pairedAt` is the phone's clock when the exchange answered. One field is added: **how the phone signed in** (`signedInWith: 'pairing' | 'organisation'`), optional in the schema and read as `'pairing'` when absent, so every record already on a phone still parses.

From then on the device provider serves the token, rotation and revocation exactly as for a paired phone (core: "rotated and revoked as a paired device's", PRD-277 §5.7 item 6; `orchestrator/api/mobile_devices.py:583-624`). One row per phone: signing in turns the phone's `paired` row into `oidc` and pairing turns it back (core PRD-277 §5.7 item 8).

**The gate: three call sites, one new rule.** An own server's record is accepted while the way it was made is still offered: a `'pairing'` record needs `device` listed and pairing on (today's rule); an `'organisation'` record needs `oidc` listed, pairing on or off. Core takes an `oidc`-kind token in the enterprise edition whether or not pairing is on (`orchestrator/core/auth/device.py:104-110`); today's rule would refuse that phone at launch on an install that offers only organisation sign-in (`src/connect/server-support.ts:23-28`). How the record's kind reaches each site:

| Site | Today | Change |
| --- | --- | --- |
| `unsupportedView` (`src/app-state/gate.ts:190-197`), via `launchView` (`:232-236`) | `ownDiscoveryRefusal(discovery)` | `ownServerRefusal(discovery, signedInWith)`; `LaunchInput` gains `signedInWith` |
| `serverSupported` (`gate.ts:200-207`), consumed at `src/app-state/use-launch.ts:72` | `ownDiscoveryRefusal(discovery.data)` | the same function, with a third parameter `signedInWith` |
| `nextStepFor` (`src/connect/next-step.ts:57`) | `ownDiscoveryRefusal(discovery)` | not a record check: Connect has no record yet, so it reads what the install offers (§5.1's table) through a new pure `offeredWays(discovery, origin)` |

`signedInWith` reaches the gate through the current-server snapshot: `OwnServer` gains it from the record (`src/connect/current-server.ts:17-29`, `:63-74`), and `use-launch.ts` passes `ownServer(snapshot)?.signedInWith ?? null` to both gate functions. The snapshot still never holds the token.

### 5.8 Every answer and what the app does

"Sign in again" means Connect on the same server with **Sign in with my organisation** ready (and **Pair with a code** beside it when offered). "Pair again" means today's Connect words. The words are listed once, in §5.9.

**At start and in the browser** (the app sees only how the session ended):

| What happens | Where the person sees it | App action and words |
| --- | --- | --- |
| `error=identity_provider_unavailable` | app link | W1. Stay on the confirm card. |
| `error=sign_in_failed`, or an unknown error | app link | W2. |
| `error=sign_in_refused`: the provider refused, or the person cancelled there (core `oidc_sign_in.py:237-246`); the ID token was not accepted; the provider did not prove a fresh sign-in (`sign_in_flow.py:441-451`); a deactivated person (`:463-465`); the address belongs to another person | app link | W3. |
| `error=sign_in_not_allowed`: the install's access rule does not admit this account (`sign_in_flow.py:186-194`) | app link | W4. |
| `no_workspace`, `several_workspaces`, `device_limit_reached` at the callback (core `phone_sign_in.py:69-72`; `auth_oidc.py:155-162`) | the install's page says why in a sentence and offers no button (core `frontend/lib/enterprise/phone-sign-in.ts:64-73`); the app is told nothing | When the person closes the sheet: `cancel`/`dismiss` → W5. |
| The person presses **Cancel** on the page | the page says "Signing in on your phone was cancelled. You can close this window." (`phone-sign-in.ts:46`; `phone-sign-in-confirm.tsx:83-90`); the app learns nothing until the sheet is closed | When the sheet is closed: W5. |
| Continue answers `409 device_limit_reached` (a cap reached since the callback) or a failure (`orchestrator/api/phone_sign_in.py:11-17`) | the page says why, or "Something went wrong. Try again in a moment." (`phone-sign-in.ts:47`, `:71-73`) | When the sheet is closed: W5. |
| The person closes the sheet anywhere | the sheet ends | W5; nothing else. |
| Nothing waits any more (`404 nothing_waiting`, `orchestrator/api/phone_sign_in.py:79-86`) | the page says "There is no phone sign-in waiting here…" (`phone-sign-in.ts:44-45`) | When the sheet is closed: W5. |
| Never reaches the app: a start the install cannot read, `400 {"detail":{"code":"invalid_phone_start"}}` (`auth_oidc.py:218-232`); OIDC not on, `404` (`:114-117`); too many starts, callbacks or page requests from one address, `429` (`orchestrator/core/security/rate_limiter.py:70`, `:71`, `:75`); a page request from another site, `403 cross_site_request_refused` (`orchestrator/api/phone_sign_in.py:20-25`); an unknown, used or expired sign-in, sent to the web app's `/sign-in?error=…` | the browser | When the sheet is closed: W5. A `400` is a bug in the app: US-304's tests pin the five parameters. |

**At the exchange:**

| Answer | Meaning | App action |
| --- | --- | --- |
| `200` | the device token | §5.7: the one clearing, then the record; consent step; Home. |
| `401 {"detail":{"code":"invalid_sign_in_code"}}` (`mobile_devices.py:533`) | an unknown code; a used one; an expired one (over 60 s); a wrong verifier; the person reaching the device cap since Continue (`sign_in_codes.py:18-25`); or a code replaced because a person has at most one pending phone sign-in per workspace and a newer one was recorded (`orchestrator/services/mobile/sign_in_confirmation.py:14`) | W6, then sign in again. |
| `404` | the install no longer signs phones in this way (`mobile_devices.py:286-291`) | Read discovery again and show what Connect now offers. |
| `422` | the body broke a field limit (`name` over 120, `app_version` over 32: `mobile_devices.py:214-229`) | W2. Not expected: the app clips both (§5.7); a test pins the clipping. |
| `429` with `Retry-After` (`mobile_devices.py:342-346`; bucket `rate_limiter.py:80`) | too many exchanges from this address | `limit` (rule 6.2): W7, with the wait when it is known. |
| `503` while the install's edition change is not confirmed (`mobile_devices.py:286-291`, `orchestrator/services/mobile/edition_change.py:174-177`), or a write that failed (`:408`); `409` (`:400-404`); any other `5xx` | the install could not finish | W8. |
| no answer | `network` | Today's "can't reach {server}" words; then sign in again (the code will have expired). |
| an answer that does not parse | `invalid_response` | W2. |

**After sign-in, on the device lane** (every request, either kind of record):

| Answer | Meaning | App action |
| --- | --- | --- |
| `401 {"detail":{"code":"device_token_expired"}}` (core `orchestrator/core/auth/device.py:136-152`; `orchestrator/services/mobile/token_age.py`) | the token reached the install's maximum age, counted from the phone's last pairing or sign-in, whatever its rotations (core PRD-277 US-601; `ENTERPRISE_DEVICE_TOKEN_MAX_AGE_DAYS`, default 90, `orchestrator/config.py:632`) | New reason `expired` in `src/connect/expiry.ts` (today it reads as `ended`). The one clearing, then Connect with W9 (`'organisation'`) or W10 (`'pairing'`). |
| `401 {"detail":{"code":"device_revoked"}}` | the phone was removed in Studio, by this phone's Sign out, or after an expiry (`device.py:73-74`, `:131`) | Today's `revoked`; the way back worded by record kind (W11). |
| `401` with no code | an unknown or rotated-out token, or a deactivated person (`device.py:101`, `:240-265`) | Today's `ended`, worded by record kind (W11). |
| `400 Invalid workspace_id` | the phone's workspace no longer exists (`device.py:170-173`) | Today's handling of a `server` error (`src/api/errors.ts:109-111`). Unchanged by this PRD. |
| `403` "This device is paired to another workspace." | the request named a workspace other than the device's (`device.py:162-167`) | Today's `forbidden` handling. Not expected: the app sends the workspace the device lane resolves. |
| `403` paused workspace | as today (`device.py:170-174`) | Today's handling. |
| `503` while the install's edition change is not confirmed (`device.py:13`, `:276-279`) | the install is not answering devices yet | Today's `server` handling; nothing is cleared. |
| `409 token_superseded` on rotate | another rotation won | Today's handling (`src/connect/rotation.ts:123`). |

Rule: an `'organisation'` record is always sent to **sign in again** first, a `'pairing'` record to **pair again** first, and each sees the other way when the install offers it (G-10).

### 5.9 The words

The sentences this PRD adds, in `src/connect/strings.ts` (final wording in the build PR; the store-copy audit reads them):

| Key | Words |
| --- | --- |
| W1 | "Your organisation's sign-in isn't answering. Try again in a few minutes." |
| W2 | "Sign-in didn't finish on {server}. Try again." |
| W3 | "Your organisation's sign-in didn't let you in to {server}. Try again, or ask your administrator." |
| W4 | "{server} doesn't let this account in. Ask your administrator." |
| W5 | "Sign-in didn't finish. If the page said why, follow it. You can also pair with a code from Studio." (the last sentence only when pairing is on) |
| W6 | "That sign-in expired before it reached the app. Sign in again." |
| W7 | "Too many sign-ins from this network just now. Try again {in N minutes \| in a few minutes}." |
| W8 | "{server} couldn't finish signing you in. Try again." |
| W9 | "Your sign-in on this phone has ended. Sign in again." |
| W10 | "This phone's pairing with {server} has ended. Pair again." |
| W11 | Today's `revoked` and `ended` sentences (`strings.ts:80-82`) with "Sign in again" in place of "Pair again" for an `'organisation'` record |
| W12 | "That sign-in didn't finish here. Start it again from Connect." (the link screen, §5.6) |
| W13 | "To sign in with your organisation, enter {documentApiUrl}." (§5.1) |
| W14 | "{server} signs phones in at {documentApiUrl}. Enter that address to sign in with your organisation." (§5.1) |
| W15 | The Sign out sentence (§5.11) |
| W16 | "Signed in with your organisation on {date}" (Settings, §5.10) |

### 5.10 Showing when the sign-in ends (US-604's note)

Core's note on US-604 says the app "may show when a phone's token ends". What the install exposes, as specified in core PRD-277:

- The exchange and the rotation answer `rotate_after`, not an end time (`mobile_devices.py:510-540`, `:607-624`).
- Discovery does not carry the maximum age (core `discovery.py:185-210`).
- `GET /api/v1/mobile/devices` gives each device's `paired_at` (`orchestrator/core/models/mobile_devices.py:201-229`, `:223`) and, past the maximum age, the status `expired` (`token_age.py:87-91`), but not the maximum age or an end date.
- Push stops at the maximum age before the app sees anything: push fan-out leaves a device past its maximum age out, by the same rule the device lane uses (core `token_age.py:13-19`). The person learns that the sign-in ended at the app's next request (§5.8), not from a notification.

So the app **cannot show an end date** from what the server sends. It can show when this phone signed in, from its own `pairedAt` (which the record keeps across rotations, as the server's count does). G-4: show W16 in Settings now, and ask core to add an end time (for example on the exchange and rotate answers) before showing anything more.

### 5.11 Signing out, losing access, a deleted account

- **Sign out** (G-5). A phone whose record says `'organisation'` shows **Sign out** in Settings, with one sentence beside it (rule 8.4), W15: "Signs this phone out of {server}: {server} stops accepting this phone, and everything of {server} on this phone is deleted. Your account stays with your organisation." It runs today's Remove this phone: `DELETE /api/v1/mobile/devices/{id}` with the phone's own token (10 s, best effort, `src/connect/remove-device.ts`), then `switch.forgetServer()`, the one clearing. When the install could not be told, today's toast says Studio may still list the phone. Forget this server stays as it is. The identity provider's own sign-in is not touched: with an ephemeral session (G-1) the phone keeps none of it.
- **Losing access.** The install ends the phone when an admin deactivates the person, ends all their sessions (core PRD-277 §5.6: that also revokes their phones), or removes the phone in Studio, and when the token reaches its maximum age. Each arrives as a `401` on the next request (§5.8) and runs `endSession`, the one clearing, at once.
- **A deleted account** (rule 8.4). The account belongs to the organisation's identity provider and the person's record to the organisation's install; the app neither creates nor deletes either (§6, rule 8.5). On the device lane, a person the install has deactivated or removed gets a `401` on the very next request, so the phone clears at once.

### 5.12 Android

Android is not released (rule 15.1); this PRD keeps it compiling and writes down what differs, for the release that comes:

- `openAuthSessionAsync` opens a Custom Tab; the app link comes back through Android's intent for the `automatos` scheme, which both the session (through the system's link events) and the router see. §5.6's rules 2 to 4 make the session's result the one consumer and the router's entry a no-op while an attempt is open.
- There is no ephemeral option: the Custom Tab shares the default browser's cookies.
- Android may end the app's process while the browser is in front. The verifier is then gone; the returning link finds no attempt and shows W12; the code expires unspent.
- `docs/android-spike.md` lists sign-in as untested on Android (lines 145-159, 163-169); this flow joins that list. Its local-network note (target SDK 37, `ACCESS_LOCAL_NETWORK`) applies to installs on a home or office network as it does to pairing.

### 5.13 What each merge shows

Every merge to `main` ships (CLAUDE.md, Release; rule 14.3), so a story that lands alone must not show a half-flow. This PRD orders the stories rather than adding a build flag: the app has no build-flag mechanism today, and a flag would be one more thing to remove.

- US-301 to US-306 are pure logic, schemas and plumbing that nothing on screen reaches: the discovery parse, the reducer's new states, PKCE, the link table's source, the exchange call, the record field, the gate. `nextStepFor` keeps returning today's four values until US-308, so no new card, button or state can appear.
- US-307 (`device_token_expired` as its own reason) is visible and complete on its own: it changes the words a paired phone sees on an enterprise install. It may land first.
- US-308 turns the offer on and lands the whole flow with it in one pull request: `nextStepFor`'s new values, the address-only Continue, the card's two actions, the session, the exchange's use, every word of §5.9 but W15 and W16, and the review notes (rule 14.5).
- US-309 (Settings) and US-310 (docs) follow.

### 5.14 Shipping

`expo-web-browser` is already a dependency and autolinked, and JavaScript imports do not move the fingerprint, so each merge is expected to ship as an over-the-air update. `pr-check.yml`'s comment on each pull request decides; that the module is in the current TestFlight binary is a device check (US-311).

## 6. The app standard, rule by rule

Each rule quoted from `docs/app-standard.md`. A deviation goes to §10 for the owner.

**7.6 Sign-in. (Own)** "How people sign in is the product's. Two things follow from the stores' rules: an account made in the app can be deleted in the app, and an app that offers another company's sign-in offers Sign in with Apple beside it."
- *An account made in the app:* **follows.** The app makes no account. The person's account is the organisation's; the install may make the person's record at their first sign-in, by the install's own rules (core PRD-277 US-404), in the install's browser pages, not in the app.
- *Another company's sign-in offers Sign in with Apple beside it:* **DEVIATES.** The organisation's identity provider is another company's sign-in, and this PRD adds no Sign in with Apple. Whether that is right depends on how Apple's guideline 4.8 is read for this app (§7, G-12). If G-6 and G-12 are accepted as recommended, the rule's words are amended to follow 4.8's, and the deviation closes.

**8.4 Leaving is plain. (Must)** "Whatever the app or its server holds about the person or the phone is named in one sentence, next to the one action that removes it. A session the server ends is not the person leaving. … Every way the person chooses to leave (sign-out, switching or forgetting a server, deleting the account) still runs the one clearing. … A deleted account wipes the phone at once (the owner, 16 Nov 2026): at sign-in the app's server gives the install a random account receipt … Owed in the template: the receipt and the route (core's, for this app). The template holds no work not yet sent, so its behaviour is unchanged: every way of leaving, and a session the server ends, runs one clearing, …"
- **Follows.** Sign out has its one sentence and runs the one clearing (§5.11); a new sign-in replacing a session runs it before saving (§5.7); every end the install sends runs `endSession`.
- *Why 8.4 follows without the receipt while 7.6 deviates:* 8.4's receipt is the means for a Clerk session, which cannot tell a deleted account from an ended one, and is recorded as owed by the template; the rule's requirement, that a deleted account wipes the phone at once, is met here by the device lane's `401` on the next request. 7.6's sentence is a flat requirement this design does not meet as written.

**8.5 A person's data is theirs to take and to remove. (Must, where the app has accounts)** "Export my data, delete my data and delete my account are each one action. Each runs on the server first and then on the phone, is safe to repeat, and names on screen what was left undone if it stops half way. A second person who signs in on the same phone finds nothing of the first."
- **Follows**, as the app has no account of its own on an organisation's install: the organisation holds the account and the install holds the data. A second person finds nothing of the first, by the one clearing (§5.7). Open question Q2.

**13.2c A redirect is never followed, and no cookie is kept. (Must)** "Every request is sent so that an answer asking to be followed elsewhere comes back as it is, and the client treats it as an error. What the app holds to prove who is asking goes only to the address it was given. No request carries a cookie or stores one."
- **Follows**, on G-2's reading. The exchange goes through the one client, which follows no redirect and carries no cookie. The code and verifier go only to the origin the person gave, at a fixed path (§5.7); the token goes only to that origin, as today. A block on another origin is not followed; the person is told the address (§5.1). The install's redirects (start → provider → callback → page) and its cookie (`__Host-automatos_phone_sign_in`, core `phone_sign_in.py:61-64`) live in the system sign-in session, which is the platform's browser, not an app request; with an ephemeral session it keeps none afterwards. The owner confirms that reading (G-2).

**13.6 Storage. (Must)** "What the phone keeps about the person goes in the encrypted store, and secrets in the keychain through the one registry. A reinstall starts clean, except for the install id, which is kept in the keychain on purpose and survives a reinstall …"
- **Follows.** The token goes in the existing paired-record item through the registry, this-device-only (§5.7); the verifier and code are held in memory only and never stored (§5.4); the install id sent at start is the one already kept outside the registry on purpose (`src/connect/install-id.ts:1-7`). A reinstall starts clean; the server finds the same phone's row by install id (core PRD-277 §5.7 item 8).

**5.2 One way in from outside. (Must)** "A notification, a link or a scan becomes an app route through one table, and what it carries is checked before anything opens. … A link with a scheme is read only when it is https on the one host the app claims for its links, or the app's own scheme … The table reads only the names its entry reads and ignores any other, but a name it reads given twice refuses the link …"
- **Follows** once the table knows a link's source and the scheme-only `/go/signed-in` entry is added (§5.6), in the form the record asks for (`docs/app-standard-record.md:227-229`).

**5.3 A gate before the screens. (Must)** "One pure, tested table decides what a person sees before the app proper: each first-run stage, sign-in, consent, then the app. The screens behind it never check for themselves."
- **Follows.** The record's kind enters the gate's one table as an input (§5.7); no screen checks it for itself.

**6.2 An error is a kind, and each kind has its words. (Must)** "… it turns every failure into one of its kinds: `network`, `auth`, `forbidden`, `not_found`, `conflict`, `server`, `stream`, `invalid_response`, `limit`. The words for a kind come from one table. A person never sees a status code, an address or a server's own message. … Every 429 is `limit` … It carries when the limit lifts, from Retry-After …"
- **Follows.** No new kind: every answer in §5.8 falls in an existing kind (`src/api/errors.ts:101-111`), and the new codes (`invalid_sign_in_code`, `device_token_expired`) are read inside `auth`, as `device_revoked` is. The exchange's `429` carries `Retry-After` (core `mobile_devices.py:342-346`), which the client already reads; W7 shows the wait. The one address a person sees (W13, W14) is the install's own documented address, which they must type: not a server's message.

**13.2a Every body is read under a cap. (Must)** "The client cannot read an answer whole without a size limit …"
- **Follows**: the exchange is a client call, read under the client's cap like `POST /pair`.

**13.7 Logs. (Must)** "Only the logger writes to the console, and it never writes a person's content."
- **Follows**: the code, the verifier, the start address (it carries the challenge) and the token are never passed to the logger or Sentry; a test proves it (§11.1).

**14.3 Updates over the air go only to the build they were made for. (Must)** "The runtime version is the fingerprint, so an update never reaches a binary with different native code. …"
- **Follows**: no native change is planned (§5.14); if one is needed, the fingerprint makes that merge a native build.

**14.5 The store record lives with the code. (Must)** "What the app collects, asks for and says is written under `docs/release/`, and a change that alters it updates the record in the same pull request."
- **Follows**: the review notes change in US-308, the pull request that turns the offer on (§5.13).

**11.5 The words say no more than the code does. (Must)** "A sentence about what the app sends, keeps or deletes, or where it does something, is read against the code that does it, and says no more than that code does."
- **Follows** when W15 and W16 are read against the code: W15 says the install "stops accepting this phone" only because `DELETE` is sent, and the toast says when it was not.

**13.2 One way out. (Must)** "Every request goes through `src/api/` … Every answer is parsed with zod and unknown fields are ignored."
- **Follows**: the exchange is one client call, parsed with zod. Opening the system sign-in session is not a request the app makes, as opening Studio is not.

**13.8 No web view. (Must)** "Not as a dependency and not through another package."
- **Follows**: `ASWebAuthenticationSession` and Custom Tabs are system browsers the app cannot read or script. The record's open question on in-app browsers (`docs/app-standard-record.md:219-220`) → G-11.

**15.1 iOS first, Android kept compiling. (Shaped)** "What differs by platform is a `*.android.ts` twin beside its file, and CI bundles both. An app with no Android release yet says so in its record."
- **Follows**: §5.12.

| Also checked | Verdict |
| --- | --- |
| CLAUDE.md "Never": "No sign-up, social sign-in or Sign in with Apple." | **Follows**: organisation sign-in is not sign-up or social sign-in. G-7 adds a line saying so. |

## 7. Apple's sign-in rule

Every sentence in quotation marks below is Apple's, read on **21 November 2026** at the link beside it. Everything else is this PRD's reading.

**Guideline 4.8, Login Services** (https://developer.apple.com/app-store/review/guidelines/#login-services, read 21 Nov 2026). Apple says an app that uses a third-party or social login service to set up or authenticate the user's primary account must also offer "another login service with the following features", and that "A login service is not required if:", among other cases:

- "Your app exclusively uses your company's own account setup and sign-in systems."
- "Your app is an education, enterprise, or business app that requires the user to sign in with an existing education or enterprise account."

*Reading:* the features Apple lists concern limiting the data collected to name and email, letting people keep their email address private, and not collecting interactions for advertising without consent. The guideline no longer names Sign in with Apple as the required alternative, which is where rule 7.6's words differ from it.

*Two readings for this app:*

1. **The enterprise case applies.** A person reaching organisation sign-in has an existing account their organisation gave them, on their organisation's install, and the organisation sign-in is the only way that install offers besides a pairing code made from that same account. Hosted sign-in is Automatos's own (the first case). On this reading no second login service is needed.
2. **The enterprise case does not apply.** The case is for an app that "requires" an existing enterprise account. Automatos Go as a whole does not: it also offers hosted sign-in and pairing. On this reading Apple may ask for a login service with the listed features beside organisation sign-in, which in practice means Sign in with Apple, which the app does not have and CLAUDE.md rules out.

The choice is the owner's: G-12. The risk is in §12.

**Guideline 2.1** (https://developer.apple.com/app-store/review/guidelines/, section 2.1, read 21 Nov 2026): "include demo account info (and turn on your back-end service!) if your app includes a login". *Reading:* a reviewer can reach organisation sign-in only through an install with an identity provider and an account on it → G-8.

**Account deletion** (https://developer.apple.com/support/offering-account-deletion-in-your-app/, read 21 Nov 2026): "Apps submitted to the App Store that support account creation must also let people initiate deletion of their account within the app." *Reading:* the app creates no account; the install may make the person's record at first sign-in, in its own pages → Q2.

**Review notes** (US-308): the "ACCOUNTS (5.1.1(v), 4.8)" paragraph today ends "there is no third-party or social sign-in" (`docs/release/app-review-notes.md:118-119`). That sentence stops being true with US-308, so the paragraph is rewritten in that pull request to say: sign-in on the hosted service is Automatos's own; on an organisation's own install the app can also sign in with that organisation's existing work account, through the install, in the system sign-in sheet; the app makes and deletes no account in either case. A third block, "YOUR ORGANISATION'S SIGN-IN", gives the review install's address and test account, in App Store Connect only. How the paragraph names guideline 4.8 follows G-12.

## 8. User stories

Sizes: S under a day, M one to two days. Each story is one pull request. Order is the merge order (§5.13); US-307 may go first.

### US-301: Read organisation sign-in from discovery (S)

**Description:** As a person connecting to my organisation's install, I want the app to know whether the install offers my organisation's sign-in, and at which address.

**Acceptance Criteria:**
- [ ] `DiscoverySchema` reads an optional `auth.oidc` block (`start_url`, `exchange_url`, `app_link`, `code_challenge_method`); unknown fields ignored; a malformed block reads as absent, and discovery still succeeds
- [ ] A pure `offeredWays(discovery, origin)` answers each row of §5.1's table (sign in, pair, both, sign in at another address, neither), with tests for every row, including a block on another origin and one with method `plain`
- [ ] Hosted: a hosted discovery and `hostedDefaults` never offer organisation sign-in (a test pins it)
- [ ] Nothing calls `offeredWays` outside its tests yet; `nextStepFor`'s answers are unchanged (its existing tests pass untouched)
- [ ] Typecheck, lint and tests pass

### US-302: Connect's reducer and card learn organisation sign-in (M)

**Description:** As a person signing in with my organisation, I want Connect to go on with only an address, and the card to offer both ways when the install has both.

**Acceptance Criteria:**
- [ ] `submit` with a valid address and an empty code goes to `checking` with no code; a code that does not parse is refused with its reason, as today
- [ ] `NextStep` gains `sign_in`, `sign_in_or_pair` and `sign_in_elsewhere`; `discovered` takes `sign_in` and `sign_in_or_pair` to `confirm` and `sign_in_elsewhere` to the fields with the documented address prefilled
- [ ] `pair` with no code goes back to the fields with the code's `empty` refusal (a test: a pairing server still asks for the code in today's words)
- [ ] The confirm view model has `primaryAction` `'sign_in' | 'confirm' | 'back'` and an optional `secondaryAction`; `ConfirmCard` draws both; a press on the card is the only way to start either (KC8 tests extended)
- [ ] A scan and a pairing link with a code behave as today (the existing `startConnect` tests pass untouched)
- [ ] `nextStepFor` still returns only today's four values, so no new state is reachable in the app yet
- [ ] Typecheck, lint and tests pass

### US-303: The verifier, the challenge and the start address (S)

**Description:** As a person signing in, I want the app to start the sign-in so only this app can finish it.

**Acceptance Criteria:**
- [ ] A verifier of 32 random bytes as 43 base64url characters; its challenge BASE64URL(SHA-256) without padding, 43 characters, through a SHA-256 port of the sign-in's own over `expo-crypto`'s `digest`
- [ ] RFC 7636 Appendix B's verifier gives its published challenge
- [ ] The start address is `<origin>/api/v1/auth/oidc/start` with the five parameters of §5.5, each exactly once, URL-encoded
- [ ] A test proves no store, keychain, logger or Sentry call receives the verifier or the start address
- [ ] Typecheck, lint and tests pass

### US-304: The link table's source and the return entry (M)

**Description:** As a person signing in, I want the answer to come back only to the sign-in I started, and to be used once.

**Depends on:** §5.6: "The link table must know the scheme" and "One attempt, one consumer, one exchange".

**Acceptance Criteria:**
- [ ] `systemLinkPath` returns the path and its source (`'scheme'`, `'https'`, `'path'`); `Entry.from` takes the source; every existing entry maps exactly as today (`system-links.test.ts` and `link-rules.test.ts` pass untouched)
- [ ] `/go/signed-in` is an entry for the app scheme only; `https://ui.automatos.app/go/signed-in?code=…` opens Lost (a new test in `system-links.test.ts`)
- [ ] The attempt is a pure state machine `open` → `exchanging` → `done` with tests for: a second tap; each session result; a second `success`; a router link while `open` (ignored, verifier kept); a result that fails the checks (verifier dropped, nothing sent); the 16-minute drop; leaving Connect
- [ ] The return check (§5.6) has a test per refusal: wrong host or path, neither or both of `code`/`error`, a name twice, a code over 64 characters or outside base64url, an unknown error (read as `sign_in_failed`)
- [ ] With no attempt, the entry's screen shows W12 and sends nothing
- [ ] Typecheck, lint and tests pass

### US-305: The exchange and the record (M)

**Description:** As a person who just signed in, I want the app to finish at once and keep me signed in like a paired phone.

**Acceptance Criteria:**
- [ ] `POST /api/v1/mobile/sign-in/exchange` in `src/connect/routes.ts` with `pendingUpstream: 'PRD-277 US-603'`; `npm run check:routes` passes and lists it as pending
- [ ] The call goes through the one client to the checked origin, with `{code, code_verifier, name?, app_version?}`, no bearer and no workspace header; a test proves it is sent once and never retried, for each answer in §5.8's exchange table
- [ ] `200` parses with the pairing schemas; each non-`200` answer in §5.8's exchange table maps to its kind
- [ ] `PairedRecord` gains optional `signedInWith`; a record stored by today's build (the fixture without the field) parses and reads as `'pairing'`; `'organisation'` round-trips through the device store
- [ ] Rotation and Remove this phone work unchanged on an `'organisation'` record (the existing tests run on both kinds)
- [ ] Typecheck, lint and tests pass

### US-306: The gate reads how the phone signed in (S)

**Description:** As a person signed in with my organisation, I want the app to keep me signed in when my install turns pairing off.

**Acceptance Criteria:**
- [ ] `OwnServer` carries `signedInWith` from the record; the snapshot still holds no token
- [ ] `unsupportedView` and `serverSupported` take `signedInWith` (the three sites of §5.7), and `use-launch.ts` passes it
- [ ] Tests: an `'organisation'` record with `["oidc"]` and pairing off is accepted; an `'organisation'` record on an install no longer listing `oidc` is refused; a `'pairing'` record keeps today's answers for every existing case
- [ ] Typecheck, lint and tests pass

### US-307: `device_token_expired` is its own reason (S)

**Description:** As a person whose phone's sign-in or pairing reached its maximum age, I want to be told so and shown the way back.

**Acceptance Criteria:**
- [ ] `classifyDeviceRefusal` reads `device_token_expired` as `expired` (no longer `ended`); the one clearing runs at once, as for every refusal
- [ ] Connect shows W10 for a `'pairing'` record (and W9 for an `'organisation'` record, which can exist only after US-305)
- [ ] The store-copy audit reads the new strings
- [ ] Typecheck, lint and tests pass

### US-308: Turn on organisation sign-in (M)

**Description:** As a person whose organisation runs Automatos, I want to sign in on my phone with my work account.

**Acceptance Criteria:**
- [ ] `nextStepFor` returns `offeredWays`' answer (§5.1's table), and Connect's form sends an address alone
- [ ] **Sign in with my organisation** runs US-303's start, `openAuthSessionAsync` with `preferEphemeralSession` as G-1 says, US-304's attempt and US-305's exchange, then `connectTo`; no web view and no `Linking.openURL` for sign-in
- [ ] W1 to W8 and W11 to W14 are in `src/connect/strings.ts`, each shown for its rows of §5.8 (one test per row of the start and exchange tables)
- [ ] A failure before the exchange's `200` leaves the phone's current session as it was (a test with a hosted session and one with a paired server)
- [ ] `docs/release/app-review-notes.md`: the ACCOUNTS paragraph no longer says there is no third-party sign-in, says where organisation sign-in happens and that the app makes and deletes no account; a "YOUR ORGANISATION'S SIGN-IN" block with placeholders filled only in App Store Connect; the release-doc audits pass
- [ ] Typecheck, lint and tests pass

### US-309: Settings for an organisation-signed phone (S)

**Description:** As a person signed in with my organisation, I want to see since when this phone is signed in, and sign out in one step.

**Acceptance Criteria:**
- [ ] Settings shows W16 from `pairedAt` for an `'organisation'` record
- [ ] **Sign out** with W15 runs `DELETE` then the one clearing; when the install could not be told, today's toast (tests for both)
- [ ] A paired phone's Settings is unchanged (the existing Settings tests pass untouched)
- [ ] Typecheck, lint and tests pass

### US-310: The standard's record and the repo's notes (S)

**Description:** As the owner, I want the app standard's record and this repo's notes to say what the app now does.

**Acceptance Criteria:**
- [ ] `docs/app-standard-record.md`: the link-table entry of lines 227-229 marked as taken, with the entry's file and test
- [ ] Rule 7.6 in `docs/app-standard.md` reads as the owner answered G-6, or the record lists this app's deviation from it with G-12's reason (whichever was answered; `node scripts/generate-standard-rules.mjs` run if a rule's number or section changed)
- [ ] The record answers its in-app browser question as the owner answered G-11
- [ ] `CLAUDE.md` "Never" gains G-7's line; `docs/connecting.md` gains the organisation sign-in path
- [ ] Typecheck, lint and tests pass

### US-311: Device checks (the owner's)

**Description:** As the owner, I want the flow tried on a real phone against a test install before the store submission.

**Acceptance Criteria:**
- [ ] The checks in §11.2 pass on an iPhone against a test install with a test identity provider
- [ ] The result is written in the pull request of US-308 or after it

## 9. Functional requirements

- FR-1: Offer organisation sign-in only when discovery lists `oidc` and a usable `auth.oidc` block on the discovered origin; for a block on another origin, give the documented address to enter.
- FR-2: Connect goes on with an address alone; a pairing server still asks for the code.
- FR-3: The app makes a fresh PKCE verifier (43 base64url characters) and S256 challenge for every attempt and holds the verifier in memory only.
- FR-4: The app opens the start address with exactly the five parameters of §5.5 in the system sign-in session, never a web view.
- FR-5: The session's result is the only consumer of the app link; the router ignores it while an attempt is open; at most one exchange per attempt.
- FR-6: The app exchanges a code once, at once, through the one client on the fixed path, and never retries.
- FR-7: The token is stored as a paired record, marked `'organisation'`, after the one clearing.
- FR-8: The gate accepts an `'organisation'` record while the install lists `oidc`, with pairing on or off.
- FR-9: Each answer in §5.8 has one action and one sentence; a failure before the exchange answers `200` changes nothing on the phone.
- FR-10: `device_token_expired` ends the session and sends the person to sign in again or pair again by how the phone signed in.
- FR-11: Sign out removes the phone at the install, then runs the one clearing, with its one sentence.
- FR-12: The hosted path does not change.
- FR-13: The code, the verifier, the start address and the token never reach a log, Sentry, the encrypted store or a link the app opens.

## 10. Decisions for the owner

| # | Decision | Recommendation |
| --- | --- | --- |
| G-1 | Ephemeral system sign-in session on iOS (`preferEphemeralSession: true`). | **Yes.** The phone keeps no work sign-in in Safari's shared state. Confirm the consent alert's behaviour on a phone. |
| G-2 | `start_url` and `exchange_url` must name the origin that answered discovery, at the fixed paths; otherwise organisation sign-in is not offered at that address and the person is given the documented one (§5.1). This is also the reading of 13.2c in §6. | **Yes.** It keeps "goes only to the address it was given" literal; the person types the address the install documents. |
| G-3 | When an install offers both, which button leads. | **Sign in with my organisation** first, **Pair with a code** second. |
| G-4 | Showing when the sign-in ends (US-604's note). | Show W16 from the phone's own record now; ask core for an end time on the exchange and rotate answers before showing an end date (§5.10). |
| G-5 | One **Sign out** for an organisation-signed phone, doing what Remove this phone does. | **Yes.** It is what a person expects after signing in, and it revokes the token at the install. |
| G-6 | Rule 7.6's words say "offers Sign in with Apple beside it"; Apple 4.8 now asks for "another login service with the following features" and lists an enterprise case. | Amend 7.6 to follow 4.8's words (US-310), if G-12 is answered with reading 1. |
| G-7 | CLAUDE.md "Never" lists sign-up, social sign-in and Sign in with Apple. | Add: "Organisation sign-in through the install (PRD-003) is not social sign-in." |
| G-8 | A review install for App Review with a test identity provider and a test account. | **Yes**, offering both ways in; its address and account only in App Store Connect. Without it the reviewer cannot reach the feature. |
| G-9 | Android. | iOS only for release; Android kept compiling with §5.12 written down. |
| G-10 | After any end of the sign-in, where the person lands. | Connect on the same server, the way the phone was signed in first, the other way beside it when offered. |
| G-11 | The record's open question: does an in-app browser count as a web view (13.8)? | Record that the system sign-in session is not a web view: the app cannot read, script or style it. 13.8 untouched. |
| G-12 | How guideline 4.8 is read for this app (§7): reading 1, the enterprise case applies and no second login service is needed; reading 2, it does not apply because the app also offers hosted sign-in and pairing, and Apple may ask for a login service with the listed features. | **Reading 1, with the review notes making the case** (an existing organisation account, on that organisation's own install, through its own sign-in) and the review install of G-8. If App Review takes reading 2, the fallback is the owner's call: hold organisation sign-in out of the store build, or add a login service with the listed features (which CLAUDE.md today rules out). |


## 11. Technical considerations

- **Where the code goes.** A small `src/connect/org-sign-in/` (the verifier and challenge with its SHA-256 port, the start address, the attempt and its return check, the exchange) beside today's pairing; copy in `src/connect/strings.ts`; the link source and entry in `src/navigation/web-links.ts`. No new `AuthProvider`: the device provider serves the token (core D-8). The `oidc` mode name already in `src/auth/providers/types.ts:6` stays a discovery mode, not a provider.
- **Pure logic, ports at the edges.** `expo-web-browser`, `expo-crypto` and the clock as ports, as `src/connect/install-id.ts` does, so vitest runs every branch in node.
- **Core is not merged.** The exchange route goes in with `pendingUpstream`; US-308's pull request re-reads core PRD-277 §5.7 and the lines in this PRD against core's `main` once Wave 6 lands.
- **Sizes.** Every file under 400 lines, functions under 50, as PRD-001 §4.11.

### 11.1 Unit tests the build needs (not written here)

- Discovery and `offeredWays`: valid block; each field missing or wrong; a block on another origin; `http`; a method other than `S256`; an `app_link` other than `go`; hosted never offers it.
- Reducer and view: address-only submit; a code that does not parse; `pair` with no code; each new `NextStep`; both card actions; KC8 (nothing starts by itself); scans and pairing links unchanged.
- PKCE: verifier length and alphabet over many runs; RFC 7636 Appendix B (verifier `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFrFOOjXk` → challenge `E9Melhoa2OwvFrYMSwbqYP4z_ABb1Z1Fcp_Dhn4y6Ws`).
- Start address: fixed path on the origin; five parameters once each, encoded.
- Link table: each source; the https form opens Lost; the scheme form with nothing pending shows W12; existing entries unchanged.
- Attempt: every transition of §5.6's rules, including a router link while open and a second `success`.
- Exchange: every row of §5.8's exchange table; sent once; no bearer, no workspace header; `name` and `app_version` clipped.
- Record: a record without `signedInWith` parses; `'organisation'` round-trips; the keychain class refusal still holds.
- Gate: the three sites with both kinds of record, pairing on and off, `oidc` listed and not.
- Expiry: `device_token_expired` → `expired` for both kinds; words by kind.
- Sign out: `DELETE` then one clearing; the toast when `DELETE` fails.
- Secrets: a spy on the logger, Sentry's scrubber input and the store proves the code, verifier, start address and token never reach them.
- Audits: store copy, release docs, link rules, `check:routes`.

### 11.2 Device checks (US-311)

On an iPhone with the TestFlight build, against a test install with a test identity provider: the happy path to Home; the consent alert with ephemeral on and off; cancel at the alert, at the provider, and on the install's page; closing the sheet on the page; a person in several workspaces; a person at the device cap; the network cut between Continue and the exchange (the code expires: W6); a second sign-in on the same phone (same device kept); removal in Studio; deactivation by an admin; Sign out; switching from a hosted session; pairing off on the install with an organisation-signed phone still working; an address other than the documented one (W14); a test install with a one-day maximum age checked the next day (`device_token_expired`, and no push after it); push arriving on an organisation-signed phone; VoiceOver and the largest text size on every new screen; the module present in the binary (no "native module not found").

## 12. Risks

| Risk | What reduces it |
| --- | --- |
| App Review takes reading 2 of guideline 4.8 (§7) and asks for a login service with the listed features beside organisation sign-in. | G-12: the review notes make the enterprise case; the review install (G-8); the fallback decided before submission, not after a rejection. |
| The consent alert ("wants to use … to sign in") confuses people. | G-1; checked on a phone. |
| A person types an internal name for the install and finds no organisation sign-in there. | §5.1: W13 or W14 gives the documented address, prefilled where pairing is off. |
| A person closes the sheet on the install's page and does not know why it stopped. | W5 points at the page's sentence and at pairing. |
| Core's contract moves before Wave 6 merges. | The `pendingUpstream` route; US-308 re-reads core PRD-277 §5.7 at merge. |
| A merge shows part of the flow. | §5.13's order: the offer lands with the whole flow in US-308. |
| Android ends the app while the browser is in front. | The return with no attempt shows W12; Android is not released (§5.12). |
| The words promise more than the code does (11.5). | W15 and W16 read against the code in review. |

## 13. Open questions

1. **The identity provider's name on the button.** Discovery carries no display name for the provider, so the button says "Sign in with my organisation". Should core add one to `auth.oidc`? Recommendation: not for this PRD; ask when an organisation asks.
2. **Account deletion (Apple's account-deletion page, rule 8.5).** The install may make the person's record at their first sign-in, in its browser pages. Is that "account creation" in the app's sense? Recommendation: no, it is the organisation's account and the organisation deletes it; the review notes say so. The owner confirms.

Core PRD-277's open question 4 (which Apple rule applies) is answered by §7 and G-12.
