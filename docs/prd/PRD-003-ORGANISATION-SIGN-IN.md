# PRD-003: Sign in with my organisation

**Status:** Draft for the owner, 21 Nov 2026. Nothing here is built in the app. · **Owner:** Gerard · **Written:** 21 Nov 2026.
**Scope:** Automatos Go signs a person in to an Automatos install that uses its organisation's own identity provider (OpenID Connect), and keeps them signed in, signs them out and handles the install ending the sign-in. iOS first; Android kept compiling (rule 15.1).
**Depends on:** automatos-ai **PRD-277** (enterprise OIDC sign-in), Wave 6 "Phones": US-601 (a device token's maximum age), US-602 (the phone's start and the confirmation page), US-603 (the exchange). This PRD is that PRD's US-604. The server side is built on core's PRD-277 branch and is **not yet on core's `main` or in a release**: everything below about the server is "as specified in core PRD-277", never "live". The hosted service (SaaS) is not touched.
**Human-gated:** a review install with a test identity provider for App Review (D-9); on-device checks on the owner's phone (US-308).

## 1. Introduction

A company that runs its own Automatos install signs its people in with the organisation's identity provider: the same account they use for everything else at work. Studio on the web already does this under core PRD-277. The phone app today has two ways in, and neither fits that company: the hosted Clerk sign-in (hosted service only) and pairing with a code from Studio (any own install). Pairing works, but it makes every person first sign in to Studio on a computer, open Settings, Phones & devices, and scan a code.

This PRD adds a third way in, for an own install only: **Sign in with my organisation**. The person types or scans the install's address as today, the app reads the install's discovery document, and where the install says it signs phones in through its identity provider the app offers the button. The sign-in itself happens in the phone's system sign-in browser, on the install's pages and the identity provider's pages. The app never sees the identity provider, its tokens or the person's password. What comes back is a one-time code that the app exchanges, with a secret only it holds, for the same kind of device token a paired phone holds. From there the phone is a paired phone in every way the app already handles: the same record in the keychain, the same token rotation, the same removal from Studio.

That shape is core's decision D-8 (core PRD-277 §8): the phone talks to Automatos, and Automatos talks to the identity provider. It supersedes PRD-001 §4.11's plan for an `oidc.ts` provider that would talk to the identity provider through `expo-auth-session`.

Server references below are core repository paths (automatos-ai) with lines read on core's PRD-277 Wave 6 branch at commit `0a0a0f5ea`. Lines may move before that branch merges; the core PRD-277 section named beside each is the reference that holds.

## 2. What exists today in the app

| Area | What it does today | Where |
| --- | --- | --- |
| Welcome | Two ways in: "Sign in to Automatos" (hosted) and "Connect to your own server". | `app/welcome.tsx:2`, `src/connect/strings.ts:108` |
| Discovery | Reads `GET /.well-known/automatos` (schema, edition, `api_url`, `web_url`, `auth.modes`, `auth.clerk`, `pairing.enabled`, `push.expo`, capabilities). Unknown modes are kept; there is no `auth.oidc` field, so the block core adds is ignored. | `src/api/discovery.ts:85-102`; hosted defaults `:111-122` |
| Auth modes | The app knows the mode names `clerk`, `device`, `oidc`; only Clerk and device providers exist. | `src/auth/providers/types.ts:6`, `:11-23`; `src/auth/providers/registry.ts:10-13`; `src/auth/select.ts:19` |
| What Connect offers | `pair` when `device` is in `auth.modes` and pairing is on; `pairing_off`; `hosted` for the build's own server; anything else (an install listing only `oidc`) is `unsupported`, which says to update the app. | `src/connect/next-step.ts:15-23`, `:52-62`; `src/connect/server-support.ts:23-28`; copy `src/connect/strings.ts:64` |
| The gate | An own server is accepted at launch only while `ownDiscoveryRefusal` is null, that is while `device` is listed and pairing is on. | `src/app-state/gate.ts:190-207` |
| Pairing | `POST /api/v1/mobile/pair` with the code; the answer becomes the paired record; `switch.connectTo` runs the one clearing, then saves it. | `src/connect/flow.ts`, `src/connect/switch.ts:190-194` |
| The paired record | ONE keychain item `automatos.paired-server.v1` through the key registry, class `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: origin, Studio address, name, edition, home-network flag, push flag, device id, workspace id, `amd_` token, `rotate_after`, `pairedAt` (this phone's clock). | `src/connect/device-store.ts:33-48`, `:157-160`; `src/storage/secure-registry.ts:21`; `src/lib/secure-store.ts:12-13`; prefix `src/connect/config.ts:44` |
| Install id | A random id kept in the keychain that survives a reinstall; sent with `POST /pair`. | `src/connect/install-id.ts:9`, `:17`, `:52` (its `base64url`) |
| Token rotation | `POST /api/v1/mobile/devices/{id}/rotate` when `rotate_after` passes; `409 token_superseded` handled. | `src/connect/rotation.ts:69`, `:123`, `:157`; `src/connect/config.ts:99` |
| A 401 on the device lane | `device_revoked` → "removed"; `device_pairing_required`; anything else, including core's new `device_token_expired`, → "ended". The record is cleared and Connect shows why, naming the server. | `src/connect/expiry.ts:12-38`; `src/auth/providers/device.ts:109-126`, `:140-151`; copy `src/connect/strings.ts:80-82` |
| Leaving | Sign out (hosted), Forget this server, Remove this phone (`DELETE /api/v1/mobile/devices/{id}` with a 10 s limit, then forget), a new pairing and a session the server ended all run ONE `clearUserData`. | `src/connect/switch.ts:155-197`; `src/connect/remove-device.ts:1-11`; `src/connect/config.ts:105` |
| App scheme and links | Scheme `automatos`; universal links on the hosted Studio domain only (`applinks:ui.automatos.app`); Android App Links on the same host for `/go`, `/command-center`, `/chat`. Every link goes through one table; a path it does not list opens Lost. There is no entry for `/go/signed-in`. | `app.json:9`, `:19`, `:186-208`; `src/connect/config.ts:29`, `:33`; `src/navigation/web-links.ts:198-213`, `:305-323`; `app/+native-intent.tsx` |
| Browser | Links to Studio open the system browser with `Linking.openURL`. `expo-web-browser` (~15.0.11) and `expo-auth-session` (~7.0.11) are dependencies, installed for Clerk's optional peers and not used by the app's own code. `expo-crypto` is used. | `src/cc/open-studio.ts:13`; `package.json:39`, `:43`, `:67`; `docs/native-modules.md` |
| SHA-256 | A native SHA-256 port already exists for push signatures. | `src/push/signature/sha256-native.ts` |
| Store record | The review notes say sign-in is Automatos's own and there is "no third-party or social sign-in". | `docs/release/app-review-notes.md:118-119` |

## 3. Goals

- A person whose organisation runs Automatos signs in on the phone with their work account, without a computer and without a pairing code.
- The phone never holds the identity provider's tokens or the person's password; it holds only the install's own device token, stored and rotated as a paired phone's is.
- Every answer the install can give has one meaning in the app and one sentence on screen.
- Hosted sign-in and pairing behave exactly as they do today.
- The app standard's rules are checked one by one, and Apple's sign-in rule is read and answered in the review notes.

## 4. Non-goals

- Talking to the identity provider from the app (`expo-auth-session` against the provider, PRD-001 §4.11): superseded by core D-8.
- Sign-up, account creation, Sign in with Apple, social sign-in.
- Organisation sign-in on the hosted service. The hosted service never lists `oidc` (core `orchestrator/tests/test_prd266_discovery.py:288-289`).
- Choosing a workspace on the phone. A person in several workspaces is refused by the install and pairs with a code from Studio instead (core PRD-277 §5.7 item 7).
- Step-up (Face ID before approving stays as it is; the install's own step-up is the browser's).
- Universal links for installs' own domains (core PRD-277 §5.7 item 9: a store app can claim only domains fixed in its build).
- An Android release (rule 15.1).

## 5. Design

### 5.1 When the button is offered

The server says so; the app never guesses from the address. "Sign in with my organisation" is offered only when the install's discovery document carries both:

1. `oidc` in `auth.modes`, and
2. an `auth.oidc` block the app can use: `start_url` and `exchange_url` both `https` on **the same origin that answered discovery** (D-2), `app_link` exactly `go`, and `code_challenge_method` exactly `S256`.

Core builds that block in `orchestrator/services/mobile/discovery.py:185-197` (`_oidc_auth_and_pairing`) from `OIDC_START_PATH = "/api/v1/auth/oidc/start"` (`:69`), `OIDC_EXCHANGE_PATH = "/api/v1/mobile/sign-in/exchange"` (`:71`) and `GO_APP_LINK = "go"` (`:73`), on the install's public address (`:218-239`). In the enterprise edition it lists `auth.modes` as `["oidc", "device"]` when pairing is on and `["oidc"]` when it is off, with `clerk: null` and `pairing.enabled` as set (core PRD-277 §5.7 item 1; core `orchestrator/tests/test_prd266_discovery.py:221-222`, `:232`, `:243`).

A block that is missing, malformed or points elsewhere is read as "this install does not offer organisation sign-in to this app": the mode is not offered, and Connect falls back to what remains (pairing, or the existing words for an install this version cannot use). The parse follows rule 13.2: zod, unknown fields ignored.

| `auth.modes` | `auth.oidc` usable | `pairing.enabled` | Connect offers |
| --- | --- | --- | --- |
| `oidc`, `device` | yes | true | **Sign in with my organisation** (first) and **Pair with a code** (D-3) |
| `oidc` | yes | false | **Sign in with my organisation** only |
| `oidc`, `device` | no | true | **Pair with a code** only (today's behaviour) |
| `oidc` | no | false | Today's `unsupported` words ("Update the app, then try again") |
| `device` | n/a | true / false | Today's `pair` / `pairing_off` |
| hosted (`clerk`) | n/a | n/a | Unchanged: Sign in to Automatos |

### 5.2 The flow, step by step

| # | The phone | The person sees |
| --- | --- | --- |
| 1 | Welcome → Connect: the person types or scans the address. The app reads discovery from that origin with no bearer (today's step). | Today's Connect screen, then "Checking {address}…". |
| 2 | Discovery lists organisation sign-in (§5.1). | The confirm card: the server's name and address, **Sign in with my organisation**, and **Pair with a code** when pairing is on. |
| 3 | The person taps the button. The app makes a PKCE verifier and its challenge (§5.3), reads its install id, and builds the start address (§5.4). | The button shows it is working; nothing else changes. |
| 4 | The app opens the system sign-in session at the start address (§5.4). | iOS: the system's sign-in sheet over the app (and, unless the session is ephemeral, the system's alert asking to allow "Automatos Go" to use the install's address to sign in; D-1). |
| 5 | Nothing: the install redirects to the organisation's identity provider, which asks for a fresh sign-in (`max_age=0`, `prompt=login`: core `orchestrator/core/auth/oidc_sign_in.py:299-322`; core PRD-277 §5.7 item 3). | The organisation's own sign-in page. |
| 6 | Nothing: the install's callback checks the sign-in and, when it is accepted, answers `303` to its own page `/sign-in/phone` (core `orchestrator/core/auth/phone_sign_in.py:61-64`). | The install's page: who is signing in, to "Automatos Go", on which phone, and to continue only if they started this from the app; **Continue** or **Cancel** (core PRD-277 §5.7 item 4). |
| 7 | The page's Continue answers `{"app_link": "automatos://go/signed-in?code=<code>"}` and opens it (core `orchestrator/api/phone_sign_in.py:111-121`; `frontend/components/enterprise/phone-sign-in-confirm.tsx:93`). The system session ends and hands the link to the app (§5.5). | The sheet closes; the app shows "Finishing sign-in…". |
| 8 | The app checks the link (§5.5) and at once sends `POST exchange_url` with the code and its verifier (§5.6). | "Finishing sign-in…" |
| 9 | On `200`, the app runs today's `connectTo`: the one clearing of whatever was on the phone, then the record saved (§5.6). | Today's next steps after pairing: the AI-provider consent step, then Home. |

Each failure has its words in §5.7. A failure before step 9 changes nothing on the phone: the person's current session, hosted or own, stays as it was, as a failed pairing does today.

### 5.3 PKCE: who makes the verifier, where it is held, for how long

- **Made by the app**, per attempt: 32 random bytes from `expo-crypto` (`getRandomBytesAsync`, as `src/connect/install-id.ts:9` uses), written as base64url without padding, which gives 43 characters of RFC 7636's unreserved set (core accepts 43 to 128: core PRD-277 §5.7 item 2; length cap `orchestrator/services/mobile/sign_in_codes.py:62`).
- **The challenge** is BASE64URL(SHA-256(verifier)) without padding, 43 characters (core `orchestrator/core/models/mobile_devices.py:96` `CODE_CHALLENGE_LENGTH = 43`; `orchestrator/core/auth/phone_sign_in.py:52` S256 only).
- **Held in memory only**, inside the one pending sign-in. Never in the keychain, the encrypted store, the query cache, a log, Sentry or a link. There is at most one pending sign-in; a second tap while one is open is ignored.
- **Dropped** when the system session resolves (any result), when the exchange answers (any answer), when the person leaves Connect, and in any case 15 minutes after it was made: the install keeps a started sign-in for 10 minutes (`orchestrator/core/auth/oidc_pending.py:73` `SIGN_IN_TTL_SECONDS = 600`) and the confirmation page for 5 (`orchestrator/core/auth/phone_sign_in.py:64`, 300 s), so nothing older can still finish. An app the system ends in between loses it; the install's code then expires unspent (§5.5, §5.11).

### 5.4 The system sign-in session (not a web view)

The app opens `start_url` with exactly these five parameters, each once (core `orchestrator/core/auth/phone_sign_in.py:54` `START_PARAMS`; core PRD-277 §5.7 item 2):

| Parameter | Value |
| --- | --- |
| `app_link` | `go` (the key, never an address; core `phone_sign_in.py:49` maps it) |
| `code_challenge` | the 43-character challenge (§5.3) |
| `code_challenge_method` | `S256` |
| `install_id` | the install id the app sends `POST /pair` (8 to 128 of `A-Z a-z 0-9 _ -`; core `orchestrator/core/models/mobile_devices.py:85`, `:98-99`; app `src/connect/install-id.ts:17`) |
| `platform` | `ios` or `android` (core `phone_sign_in.py:53`) |

A `start_url` that already carries any of the five is refused by the app, so each is sent once.

**The API:** `WebBrowser.openAuthSessionAsync(startAddress, 'automatos://go/signed-in', { preferEphemeralSession })` from `expo-web-browser`. On iOS it runs `ASWebAuthenticationSession`, the system's own sign-in sheet; on Android it opens a Custom Tab and waits for the app link. It resolves `{type: 'success', url}` when the session sees the app link, or `cancel` / `dismiss` when the person closes it.

**Why this and not anything else:** the app has no web view and never will (CLAUDE.md "Never"; rule 13.8), so a page inside the app is ruled out. `Linking.openURL` (how Studio links open today) hands the page to Safari, which cannot hand the answer back to a waiting call and leaves the sign-in open in the person's browser. The system sign-in session is the platform's sanctioned way to sign in through a website: the app cannot read or change the page, the person sees the real address bar, and the answer comes back only to the session that asked for it. Core PRD-277 §5.7 item 2 names the same two mechanisms.

**Ephemeral (D-1):** recommended on. iOS then starts the session without the browser's stored cookies and keeps none afterwards, so a work sign-in does not linger in Safari's shared state on the phone, and the install's fresh-sign-in rule is met by the provider asking anyway. The effect on the system's consent alert is to be confirmed on a phone (US-308). Android has no ephemeral option.

### 5.5 The return through the app link

**The exact set.** Core has one app link: `APP_LINKS = {"go": "automatos://go/signed-in"}` (core `orchestrator/core/auth/phone_sign_in.py:49`). It carries exactly one of:

- `code=<code>`: 256 random bits, base64url, at most 64 characters (core `orchestrator/services/mobile/sign_in_codes.py:56`, `:60`), alive 60 seconds (`:58`), spent by the first exchange that finds it (`:175-202`); or
- `error=<code>`: one of `sign_in_refused`, `sign_in_not_allowed`, `identity_provider_unavailable`, `sign_in_failed` (core `orchestrator/core/auth/sign_in_flow.py:123-130`; core `orchestrator/api/auth_oidc.py:155-162`; core PRD-277 §5.7 item 5).

Core answers the app with nothing else (`orchestrator/core/auth/phone_sign_in.py:115-118` `app_answer`). There is **no `state` parameter** in the contract: the start's own state and nonce are between the install and the identity provider (core PRD-277 §5.7 item 3), and what ties the code to this app's attempt is the PKCE verifier, which only this app holds.

**What the app checks** before it acts on a return:

1. A sign-in is pending in this app (§5.3). On iOS the system session delivers its link only to the call that opened it; on Android, or a link that arrives through the router, the app acts only while one is pending.
2. The scheme is `automatos`, the host `go` and the path `/signed-in` exactly. The same path on the https host (`ui.automatos.app`) is never read as a sign-in: it opens Lost.
3. The query holds exactly one of `code` and `error`, each once (rule 5.2's duplicate rule), nothing over the table's limits; any other name is ignored.
4. `code` is base64url, 1 to 64 characters, taken exactly as it came. `error` is compared against the four codes; an unknown one reads as `sign_in_failed`.

A return that fails any check, or arrives with nothing pending, shows "That sign-in didn't finish here. Start it again from Connect." and sends nothing anywhere.

**The link table gains one entry** (rule 5.2; the form the record asks for at `docs/app-standard-record.md:227-229`): path `/go/signed-in`, on the app's own scheme only, reading `code` and `error`, handing them to the waiting sign-in and to nothing else, never logged. With nothing waiting it opens the "didn't finish" words. The table today sends that path to Lost (`src/navigation/web-links.ts:198-213`, `:305-323`).

### 5.6 The exchange and storing the token

**Exchange** (core PRD-277 §5.7 item 6; `orchestrator/api/mobile_devices.py:214-229`, `:507-540`):

```
POST {exchange_url}
{"code": "<code>", "code_verifier": "<verifier>", "name": "<phone name>", "app_version": "<version>"}
```

`name` and `app_version` are optional and are the values `POST /pair` already sends (`src/connect/device-info.ts`). The call goes through the one client (rule 13.2) to `exchange_url`, with no bearer, no `X-Workspace-ID` and no cookie, once, at once (the code lives 60 seconds), and is never retried: a code is spent by the first exchange that finds it, whatever the answer. The route is added to the app's server table with `pendingUpstream: 'PRD-277 US-603'` until core's pin carries it (`check:routes`, K4).

`200` (with `Cache-Control: no-store`) is `{"device_id", "workspace_id", "token", "rotate_after"}`, the token an `amd_` device token of kind `oidc`, shown once. The app parses it with today's pairing schemas (`src/connect/schemas.ts`).

**Storing** (rule 13.6): the answer plus what discovery said (origin, Studio address, name, edition, home-network flag, push flag) becomes a `PairedRecord`, saved through `switch.connectTo` after the one clearing, in the same keychain item, class and registry as a pairing (`src/connect/device-store.ts:141-148`). `pairedAt` is the phone's clock when the exchange answered. One field is added: **how the phone signed in** (`signedInWith: 'pairing' | 'organisation'`), optional in the schema and read as `'pairing'` when absent, so every record already on a phone still parses. It drives the words in Settings and on a refusal; nothing else.

From then on the device provider serves the token, rotation and revocation exactly as for a paired phone (core: "rotated and revoked as a paired device's", PRD-277 §5.7 item 6; `orchestrator/api/mobile_devices.py:583-624`). One row per phone: signing in turns the phone's `paired` row into `oidc` and pairing turns it back (core PRD-277 §5.7 item 8).

**The gate** changes in one place: an own server's record is accepted at launch while the way it was made is still offered. A `'pairing'` record needs `device` listed and pairing on (today's rule, `src/connect/server-support.ts:23-28`); an `'organisation'` record needs `oidc` listed. Core takes an `oidc`-kind token in the enterprise edition whether or not pairing is on (`orchestrator/core/auth/device.py:104-110`), so turning pairing off on the install does not end phones that signed in with the organisation.

### 5.7 Every answer and what the app does

"Sign in again" means Connect on the same server with **Sign in with my organisation** ready (and **Pair with a code** beside it when offered). "Pair again" means today's Connect words.

**At start and in the browser** (the app sees only how the session ended):

| What happens | Where the person sees it | App action and words |
| --- | --- | --- |
| `error=identity_provider_unavailable` | app link | "Your organisation's sign-in isn't answering. Try again in a few minutes." Stay on the confirm card. |
| `error=sign_in_failed` (or an unknown error) | app link | "Sign-in didn't finish on {server}. Try again." |
| `error=sign_in_refused`: the provider refused or the person cancelled there (core `oidc_sign_in.py:237-246`), the ID token was not accepted, the sign-in was not fresh (no, early or future `auth_time`; core `sign_in_flow.py:441-451`, `orchestrator/tests/test_prd277_w6b_phone_fresh_sign_in_realdb.py:53-91`), a deactivated person (`sign_in_flow.py:463-465`), the address already belongs to another person | app link | "Your organisation's sign-in didn't let you in to {server}. Try again, or ask your administrator." |
| `error=sign_in_not_allowed`: the install's access rule does not admit this account (`sign_in_flow.py:186-194`) | app link | "{server} doesn't let this account in. Ask your administrator." |
| `no_workspace`, `several_workspaces`, `device_limit_reached` (core `phone_sign_in.py:69-72`; `auth_oidc.py:155-162`): the page says why | the install's page; the app is told nothing | The person closes the sheet → `cancel`/`dismiss` → "Sign-in didn't finish. If the page said why, follow it. You can also pair with a code from Studio." (pairing offered when on). |
| The person presses **Cancel** on the page, or closes the sheet anywhere | the sheet ends | Same "didn't finish" words; nothing else. |
| The person waits past 5 minutes on the page; the page has nothing waiting (`404 nothing_waiting`, core `orchestrator/api/phone_sign_in.py:79-86`) | the install's page | The person closes it → "didn't finish". |
| A start the install cannot read: `400 {"detail":{"code":"invalid_phone_start"}}` (`auth_oidc.py:218-232`); OIDC not on (`404`, `:114-117`); too many starts (`429`, `orchestrator/core/security/rate_limiter.py:70`); an unknown, used or expired sign-in (`/sign-in?error=…`, the web app's page) | shown in the browser, never reaches the app | The person closes it → "didn't finish". A `400` is a bug in the app: US-302's tests pin the five parameters. |

**At the exchange:**

| Answer | Meaning | App action and words |
| --- | --- | --- |
| `200` | the device token | §5.6; the one clearing, then the record; consent step; Home. |
| `401 {"detail":{"code":"invalid_sign_in_code"}}` (`mobile_devices.py:136`, `:507-540`) | the code was used, expired (over 60 s), the verifier did not match, or the person reached the device cap since Continue (`sign_in_codes.py:122-131`) | Sign in again: "That sign-in expired before it reached the app. Sign in again." |
| `404` | the install no longer signs phones in this way (`mobile_devices.py:286-291`) | Read discovery again and show what Connect now offers. |
| `429` | too many exchanges from this address (`rate_limiter.py:80`) | "Too many sign-ins from this network just now. Try again in a few minutes." |
| `409`, `503`, other `5xx` (`mobile_devices.py:384-408`) | the install could not finish | "{server} couldn't finish signing you in. Try again." |
| no answer | network | Today's "can't reach {server}" words; sign in again once it answers (the code will have expired). |
| an answer that does not parse | `invalid_response` | "Sign-in didn't finish on {server}. Try again." |

**After sign-in, on the device lane** (every request, either kind of record):

| Answer | Meaning | App action |
| --- | --- | --- |
| `401 {"detail":{"code":"device_token_expired"}}` (core `orchestrator/core/auth/device.py:136-152`; `orchestrator/services/mobile/token_age.py`) | the token reached the install's maximum age, counted from the phone's last pairing or sign-in, whatever its rotations (core PRD-277 US-601; `ENTERPRISE_DEVICE_TOKEN_MAX_AGE_DAYS`, default 90) | New reason `expired` in `src/connect/expiry.ts` (today it reads as `ended`). The one clearing, then Connect: an `'organisation'` record → "Your sign-in on this phone has ended. Sign in again." with Sign in again; a `'pairing'` record → "This phone's pairing with {server} has ended. Pair again." (and Sign in again if the install offers it). |
| `401 {"detail":{"code":"device_revoked"}}` | the phone was removed in Studio, by this phone's Sign out, or after an expiry (core `device.py:73-74`) | Today's `revoked`; the words name the way back by record kind. |
| `401` with no code | an unknown or rotated-out token, or a deactivated person (`device.py:240-265`) | Today's `ended`, worded by record kind. |
| `409 token_superseded` on rotate | another rotation won | Today's handling (`src/connect/rotation.ts:123`). |
| `403` paused workspace | as today | Today's handling. |

Rule: an `'organisation'` record is always sent to **sign in again** first, a `'pairing'` record to **pair again** first, and each sees the other way when the install offers it (D-11).

### 5.8 Showing when the sign-in ends (US-604's note)

Core's note on US-604 says the app "may show when a phone's token ends". What the install exposes today, as specified in core PRD-277:

- The exchange and the rotation answer `rotate_after`, not an end time (`mobile_devices.py:507-540`, `:607-624`).
- Discovery does not carry the maximum age (core `discovery.py:185-210`).
- `GET /api/v1/mobile/devices` gives each device's `paired_at` (`orchestrator/core/models/mobile_devices.py:201-229`, `:223`) and, past the maximum age, the status `expired` (`token_age.py:87-91`), but not the maximum age or an end date.

So the app **cannot show an end date** from what the server sends. It can show when this phone signed in, from its own `pairedAt` (which the existing record keeps across rotations, as the server's count does). Decision D-5: show "Signed in on this phone on {date}" in Settings now, and ask core to add an end time (for example `token_expires_at` on the exchange and rotate answers) before showing anything more.

### 5.9 Signing out, losing access, a deleted account

- **Sign out** (D-6). A phone whose record says `'organisation'` shows **Sign out** in Settings, with one sentence beside it (rule 8.4): "Signs this phone out of {server}: {server} stops accepting this phone, and everything of {server} on this phone is deleted. Your account stays with your organisation." It runs today's Remove this phone: `DELETE /api/v1/mobile/devices/{id}` with the phone's own token (10 s, best effort, `src/connect/remove-device.ts`), then `switch.forgetServer()`, the one clearing. When the install could not be told, today's toast says Studio may still list the phone. Forget this server stays as it is. The identity provider's own sign-in is not touched: with an ephemeral session (D-1) the phone keeps none of it.
- **Losing access.** The install ends the phone when an admin deactivates the person, ends all their sessions (core PRD-277 §5.6: that also revokes their phones), or removes the phone in Studio, and when the token reaches its maximum age. Each arrives as a `401` on the next request (§5.7) and runs `endSession`, the one clearing, at once.
- **A deleted account** (rule 8.4). The account belongs to the organisation's identity provider and the person's record to the organisation's install; the app neither creates nor deletes either (§6, rule 8.5). On the device lane, a person the install has deactivated or removed gets a `401` on the very next request, so the phone clears at once. The account receipt rule 8.4 asks of a Clerk app is therefore not needed for this lane; the template holds no work not yet sent.

### 5.10 Installs offering both, one, or neither; hosted unchanged

The table in §5.1 is the whole rule. Two points:

- An install offering both: the confirm card shows both, organisation sign-in first (D-3). A person in several workspaces is refused by the install's page and is told to pair (§5.7); the app's "didn't finish" words point at pairing for that reason.
- **Hosted is unchanged.** The hosted service never lists `oidc` (core `orchestrator/tests/test_prd266_discovery.py:288-289`), the hosted path reads `hostedDefaults` when it has no discovery (`src/api/discovery.ts:111-122`), and none of this PRD's code runs on it. US-301 pins it.

### 5.11 Android

Android is not released (rule 15.1); this PRD keeps it compiling and writes down what differs, for the release that comes:

- `openAuthSessionAsync` opens a Custom Tab; the return comes through Android's intent for the `automatos` scheme, so it passes the router and `app/+native-intent.tsx` before reaching the waiting call. §5.5's link entry is what keeps that safe.
- There is no ephemeral option: the Custom Tab shares the default browser's cookies.
- Android may end the app's process while the browser is in front. The verifier is then gone; the returning link finds nothing pending and shows "didn't finish"; the code expires unspent.
- `docs/android-spike.md` lists sign-in as untested on Android (lines 145-159, 163-169); this flow joins that list. Its local-network note (target SDK 37, `ACCESS_LOCAL_NETWORK`) applies to installs on a home or office network as it does to pairing.

### 5.12 Shipping

`expo-web-browser` is already a dependency and autolinked, and JavaScript imports do not move the fingerprint, so the build is expected to ship as an over-the-air update. `pr-check.yml`'s comment on the build PR decides; that the module is in the current TestFlight binary is a device check (US-308).

## 6. The app standard, rule by rule

Each rule quoted from `docs/app-standard.md`. A deviation goes to §10 for the owner.

**7.6 Sign-in. (Own)** "How people sign in is the product's. Two things follow from the stores' rules: an account made in the app can be deleted in the app, and an app that offers another company's sign-in offers Sign in with Apple beside it."
- *An account made in the app:* **follows.** The app makes no account. The person's account is the organisation's; the install may make the person's record at their first sign-in, by the install's own rules (core PRD-277 US-404), in the install's browser pages, not in the app.
- *Another company's sign-in offers Sign in with Apple beside it:* **DEVIATES from the rule's words, follows the store rule they summarise.** The organisation's identity provider is another company's sign-in, and this PRD adds no Sign in with Apple. Apple's guideline 4.8, read today (§7), says a login service is not required for "an education, enterprise, or business app that requires the user to sign in with an existing education or enterprise account", and the alternative it asks for elsewhere is "another login service with the following features", not Sign in with Apple by name. → D-7 (amend the standard's wording).

**8.4 Leaving is plain. (Must)** "Whatever the app or its server holds about the person or the phone is named in one sentence, next to the one action that removes it. A session the server ends is not the person leaving. … Every way the person chooses to leave (sign-out, switching or forgetting a server, deleting the account) still runs the one clearing. … A deleted account wipes the phone at once … The template holds no work not yet sent, so its behaviour is unchanged: every way of leaving, and a session the server ends, runs one clearing"
- **Follows.** Sign out has its one sentence and runs the one clearing (§5.9); a new sign-in replacing a session runs it before saving (§5.6); every end the install sends runs `endSession`. The account receipt is owed for Clerk and not needed here, because the device lane tells the phone at once (§5.9).

**13.2c A redirect is never followed, and no cookie is kept. (Must)** "Every request is sent so that an answer asking to be followed elsewhere comes back as it is, and the client treats it as an error. What the app holds to prove who is asking goes only to the address it was given. No request carries a cookie or stores one."
- **Follows**, on D-2's reading. The exchange goes through the one client, which follows no redirect and carries no cookie. The code and verifier go only to `exchange_url`, which the app accepts only on the origin the person gave (D-2); the token goes only to that origin, as today. The install's redirects (start → provider → callback → page) and its cookies (`__Host-automatos_phone_sign_in`, core `phone_sign_in.py:61-64`) live in the system sign-in session, which is the platform's browser, not an app request; with an ephemeral session it keeps none afterwards. The owner confirms that reading (D-2).

**13.6 Storage. (Must)** "What the phone keeps about the person goes in the encrypted store, and secrets in the keychain through the one registry. A reinstall starts clean, except for the install id …"
- **Follows.** The token goes in the existing paired-record item through the registry, this-device-only (§5.6); the verifier and code are held in memory only and never stored (§5.3); the install id sent at start is the one already kept. A reinstall starts clean; the server finds the same phone's row by install id (core PRD-277 §5.7 item 8).

Other rules this touches:

| Rule | Verdict |
| --- | --- |
| 5.2 One way in from outside (Must) | **Follows** once the `/go/signed-in` entry is added (§5.5), in the form the record asks for (`docs/app-standard-record.md:227-229`). |
| 8.5 A person's data is theirs (Must, where the app has accounts) | **Follows**: the app has no account of its own here; the organisation's install holds the data and its deletion. Open question Q2. |
| 11.5 The words say no more than the code does (Must) | **Follows** when US-305 and US-306's sentences are read against the code: the Sign out sentence says the install "stops accepting this phone" only because `DELETE` is sent, and the toast says when it was not. |
| 13.2 One way out (Must) | **Follows**: the exchange is one client call, parsed with zod. Opening the system sign-in session is not a request the app makes, as opening Studio is not. |
| 13.8 No web view (Must) | **Follows**: `ASWebAuthenticationSession` / Custom Tabs are system browsers the app cannot read or script. The record's open question on in-app browsers (`docs/app-standard-record.md:219-220`) → D-12. |
| 15.1 iOS first, Android kept compiling (Shaped) | **Follows**: §5.11. |
| CLAUDE.md "Never": "No sign-up, social sign-in or Sign in with Apple." | **Follows**: organisation sign-in is not sign-up or social sign-in. D-8 adds a line saying so. |
| CLAUDE.md Release: a change to what the app says updates `docs/release/` in the same PR | US-307 rewrites the review notes' ACCOUNTS paragraph (`docs/release/app-review-notes.md:118-119`). |

## 7. Apple's sign-in rule

Read on **21 November 2026** at https://developer.apple.com/app-store/review/guidelines/#login-services (guideline 4.8, Login Services).

What it says: "Apps that use a third-party or social login service (such as Facebook Login, Google Sign-In, Sign in with Twitter, Sign In with LinkedIn, Login with Amazon, or WeChat Login) to set up or authenticate the user's primary account with the app must also offer as an equivalent option another login service with the following features:" a service that limits data collection to the user's name and email address, lets users keep their email address private, and does not collect interactions with the app for advertising without consent. "A login service is not required if:" — among the cases listed:

- "Your app exclusively uses your company's own account setup and sign-in systems."
- "Your app is an education, enterprise, or business app that requires the user to sign in with an existing education or enterprise account."

The text differs from the app standard's summary in rule 7.6: it no longer names Sign in with Apple as the required alternative, and it carries the enterprise case as an exception.

What it means here: organisation sign-in is the enterprise case. The person signs in with an existing account their organisation gave them, to their organisation's install; the app offers no consumer login. No second login service is required. Hosted sign-in stays Automatos's own (the first case).

Two other passages bear on review:

- 2.1 asks to "include demo account info (and turn on your back-end service!) if your app includes a login". A reviewer can reach organisation sign-in only through an install with an identity provider and an account on it → D-9.
- Account deletion (https://developer.apple.com/support/offering-account-deletion-in-your-app/, read the same day): "Apps submitted to the App Store that support account creation must also let people initiate deletion of their account within the app." The app creates no account (§6, 7.6) → Q2.

Review notes (US-307): the "ACCOUNTS (5.1.1(v), 4.8)" paragraph today ends "there is no third-party or social sign-in" (`docs/release/app-review-notes.md:118-119`). It becomes: the app signs in with Automatos's own sign-in on the hosted service; on an organisation's own install it can also sign in with that organisation's existing work account, through the install, in the system sign-in sheet (guideline 4.8's enterprise case); the app makes and deletes no account in either case. A third block, "YOUR ORGANISATION'S SIGN-IN", gives the review install's address and test account, in App Store Connect only.

## 8. User stories

Sizes: S under a day, M one to two days, L more. Order is the order of the list; US-305's `device_token_expired` handling for paired phones does not depend on the others and may go first.

### US-301: Read organisation sign-in from discovery and decide what Connect offers (S)

**Description:** As a person connecting to my organisation's install, I want the app to offer my organisation's sign-in only when the install says it does.

**Acceptance Criteria:**
- [ ] `DiscoverySchema` reads an optional `auth.oidc` block (`start_url`, `exchange_url`, `app_link`, `code_challenge_method`); unknown fields ignored; a malformed block reads as absent, never as a failed discovery
- [ ] The block is usable only with both addresses `https` on the origin that answered discovery, `app_link` `go` and method `S256` (D-2)
- [ ] `nextStepFor` answers every row of §5.1's table; an install listing only `oidc` with a usable block is no longer `unsupported`
- [ ] Hosted: a hosted discovery and `hostedDefaults` never offer organisation sign-in (a test pins it)
- [ ] Typecheck, lint and tests pass

### US-302: The verifier, the challenge and the start address (S)

**Description:** As a person signing in, I want the app to start the sign-in so only this app can finish it.

**Acceptance Criteria:**
- [ ] A verifier of 32 random bytes as 43 base64url characters; its challenge BASE64URL(SHA-256) without padding, 43 characters; RFC 7636 Appendix B's example gives its published challenge
- [ ] The start address carries the five parameters of §5.4, each exactly once, URL-encoded; a `start_url` that already carries one is refused
- [ ] The verifier exists only in memory in the one pending sign-in; a test proves no store, keychain, log or Sentry call receives it
- [ ] Typecheck, lint and tests pass

### US-303: The system sign-in session and the return link (M)

**Description:** As a person signing in, I want the sign-in to happen in the phone's own sign-in sheet and come back to the app safely.

**Acceptance Criteria:**
- [ ] `WebBrowser.openAuthSessionAsync(start, 'automatos://go/signed-in', { preferEphemeralSession })` per D-1; no web view, no `Linking.openURL` for sign-in
- [ ] At most one pending sign-in; a second tap while pending does nothing; the pending sign-in is dropped on every result, on leaving Connect and after 15 minutes
- [ ] The return is checked per §5.5 (scheme, host, exact path, exactly one of `code`/`error`, lengths, duplicates refused, unknown error → `sign_in_failed`)
- [ ] The link table gains `/go/signed-in` on the app scheme only; the same path on the https host opens Lost; with nothing pending it shows the "didn't finish" words; `link-rules.test.ts` and `system-links.test.ts` cover it
- [ ] `cancel` and `dismiss` show the "didn't finish" words of §5.7 and change nothing
- [ ] Typecheck, lint and tests pass

### US-304: Exchange, the record and the gate (M)

**Description:** As a person who just signed in, I want the app to finish at once and keep me signed in like a paired phone.

**Acceptance Criteria:**
- [ ] `POST exchange_url` through the one client with `{code, code_verifier, name?, app_version?}`, once, never retried; the route is in the server table with `pendingUpstream: 'PRD-277 US-603'` and `check:routes` passes
- [ ] `200` parses with the pairing schemas; the record is saved through `switch.connectTo` after the one clearing, with `signedInWith: 'organisation'`
- [ ] A record without `signedInWith` still parses and reads as `'pairing'` (a stored record from today's build in the test)
- [ ] The gate accepts an `'organisation'` record while `oidc` is listed, with pairing on or off; a `'pairing'` record keeps today's rule
- [ ] Every exchange answer in §5.7 shows its words; a failure leaves the phone's current session as it was
- [ ] Rotation and Remove this phone work unchanged on an `'organisation'` record
- [ ] Typecheck, lint and tests pass

### US-305: Every refusal in words, and the token's end (S)

**Description:** As a person whose sign-in did not work or has ended, I want to be told why in one sentence and shown the way back.

**Acceptance Criteria:**
- [ ] Every row of §5.7 maps to one string in `src/connect/strings.ts`; the store-copy audit reads them
- [ ] `device_token_expired` is its own reason `expired` (no longer `ended`) for both kinds of record; the one clearing runs at once
- [ ] Connect after a refusal offers "Sign in again" first for an `'organisation'` record and "Pair again" first for a `'pairing'` record, each with the other when the install offers it (D-11)
- [ ] Typecheck, lint and tests pass

### US-306: Settings for an organisation-signed phone (S)

**Description:** As a person signed in with my organisation, I want to see how and since when this phone is signed in, and sign out in one step.

**Acceptance Criteria:**
- [ ] Settings shows "Signed in with your organisation on {date}" from `pairedAt` (D-5)
- [ ] **Sign out** with its one sentence (§5.9) runs `DELETE` then the one clearing; when the install could not be told, today's toast
- [ ] A paired phone's Settings is unchanged
- [ ] Typecheck, lint and tests pass

### US-307: The store record and the standard's record (S)

**Description:** As the owner, I want App Review and the standard's record to say what the app now does.

**Acceptance Criteria:**
- [ ] `docs/release/app-review-notes.md` ACCOUNTS paragraph rewritten per §7, plus a "YOUR ORGANISATION'S SIGN-IN" block with placeholders filled only in App Store Connect; release-doc audits pass
- [ ] `docs/app-standard-record.md`: the link-table entry of lines 227-229 recorded as taken; rule 7.6's wording per D-7; D-12's reading
- [ ] `CLAUDE.md` per D-8; `docs/connecting.md` gains the organisation sign-in path
- [ ] Typecheck, lint and tests pass

### US-308: Device checks (the owner's)

**Description:** As the owner, I want the flow tried on a real phone against a test install before it ships.

**Acceptance Criteria:**
- [ ] The checks in §11.2 pass on an iPhone against a test install with a test identity provider
- [ ] The result is written in the build PR

## 9. Functional requirements

- FR-1: Offer organisation sign-in only when discovery lists `oidc` and a usable `auth.oidc` block on the discovered origin.
- FR-2: The app makes a fresh PKCE verifier (43 base64url characters) and S256 challenge for every attempt and holds the verifier in memory only.
- FR-3: The app opens `start_url` with exactly the five parameters of §5.4 in the system sign-in session, never a web view.
- FR-4: The app acts on `automatos://go/signed-in` only while a sign-in is pending, with exactly one of `code` or `error`, and hands it to nothing else.
- FR-5: The app exchanges a code once, at once, through the one client, and never retries.
- FR-6: The token is stored as a paired record, marked `'organisation'`, after the one clearing.
- FR-7: Each answer in §5.7 has one action and one sentence; a failure before the exchange answers `200` changes nothing on the phone.
- FR-8: `device_token_expired` ends the session and sends the person to sign in again or pair again by how the phone signed in.
- FR-9: Sign out removes the phone at the install, then runs the one clearing, with its one sentence.
- FR-10: The hosted path does not change.
- FR-11: The code, the verifier and the token never reach a log, Sentry, the encrypted store or a link the app opens.

## 10. Decisions for the owner

| # | Decision | Recommendation |
| --- | --- | --- |
| D-1 | Ephemeral system sign-in session on iOS (`preferEphemeralSession: true`). | **Yes.** The phone keeps no work sign-in in Safari's shared state, and the install asks for a fresh sign-in anyway. Confirm the consent alert's behaviour on a phone. |
| D-2 | `start_url` and `exchange_url` must be on the origin that answered discovery; otherwise organisation sign-in is not offered. This is also the reading of 13.2c in §6. | **Yes.** It keeps "goes only to the address it was given" literal. Core builds both on the install's public address, which is what the person types. |
| D-3 | When an install offers both, which button leads. | **Sign in with my organisation** first, **Pair with a code** second. |
| D-4 | Welcome's wording for the own-server way in. | Keep "Connect to your own server" and add a second line: "Your organisation's Automatos, or one you run." No new entry on Welcome. |
| D-5 | Showing when the sign-in ends (US-604's note). | Show "Signed in … on {date}" from the phone's own record now; ask core for an end time on the exchange and rotate answers before showing an end date (§5.8). |
| D-6 | One **Sign out** for an organisation-signed phone, doing what Remove this phone does. | **Yes.** It is what a person expects after signing in, and it revokes the token at the install. |
| D-7 | Rule 7.6's words say "offers Sign in with Apple beside it"; Apple 4.8 now asks for "another login service with the following features" and exempts enterprise accounts. | Amend 7.6 to follow 4.8's words (record entry in US-307). No Sign in with Apple. |
| D-8 | CLAUDE.md "Never" lists sign-up, social sign-in and Sign in with Apple. | Add: "Organisation sign-in through the install (PRD-003) is not social sign-in." |
| D-9 | A review install for App Review with a test identity provider and a test account. | **Yes**, offering both ways in; its address and account only in App Store Connect. Without it the reviewer cannot reach the feature. |
| D-10 | Android. | iOS only for release; Android kept compiling with §5.11 written down. |
| D-11 | After `device_token_expired`, where the person lands. | Connect on the same server, the way the phone was signed in first, the other way beside it when offered. |
| D-12 | The record's open question: does an in-app browser count as a web view (13.8)? | Record that the system sign-in session is not a web view: the app cannot read, script or style it. 13.8 untouched. |

## 11. Technical considerations

- **Where the code goes.** A small `src/connect/org-sign-in/` (the verifier and challenge, the start address, the return check, the exchange, the flow) beside today's pairing; copy in `src/connect/strings.ts`; the link entry in `src/navigation/web-links.ts`. No new `AuthProvider`: the device provider serves the token (core D-8). The `oidc` mode name already in `src/auth/providers/types.ts:6` stays a discovery mode, not a provider.
- **Pure logic, ports at the edges.** `expo-web-browser`, `expo-crypto` and the clock as ports, as `src/connect/install-id.ts` does, so vitest runs every branch in node.
- **Core is not merged.** The routes go in with `pendingUpstream`; the build PR re-reads core PRD-277 §5.7 and the lines in this PRD against core's `main` once Wave 6 lands.
- **Sizes.** Every file under 400 lines, functions under 50, as §4.11.

### 11.1 Unit tests the build needs (not written here)

- Discovery: valid block; each field missing or wrong; cross-origin `start_url` or `exchange_url`; `http`; method other than `S256`; `app_link` other than `go`; hosted never offers it.
- `nextStepFor`: every row of §5.1.
- PKCE: verifier length and alphabet over many runs; RFC 7636 Appendix B (verifier `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFrFOOjXk` → challenge `E9Melhoa2OwvFrYMSwbqYP4z_ABb1Z1Fcp_Dhn4y6Ws`).
- Start address: five parameters once each, encoded; refused when `start_url` carries one.
- Return check: exact path; https host refused; neither or both of `code`/`error`; duplicates; over-long values; unknown error; nothing pending.
- Flow: one pending; second tap; each session result; 15-minute drop; verifier dropped on every path; leaving Connect.
- Exchange: `200`; `401 invalid_sign_in_code`; `404`; `429`; `409`; `503`; network; invalid answer; never retried; no bearer, no workspace header.
- Record: old record without `signedInWith` parses; `'organisation'` round-trips; the keychain class refusal still holds.
- Gate: `'organisation'` with pairing off accepted; `oidc` no longer listed refused; `'pairing'` unchanged.
- Expiry: `device_token_expired` → `expired` for both kinds; words by kind.
- Sign out: `DELETE` then one clearing; the toast when `DELETE` fails.
- Secrets: a spy on the logger, Sentry's scrubber input and the store proves the code, verifier and token never reach them.
- Audits: store copy, release docs, link rules, `check:routes`.

### 11.2 Device checks (US-308)

On an iPhone with the TestFlight build, against a test install with a test identity provider: the happy path to Home; the consent alert with ephemeral on and off; cancel at the alert, at the provider, and on the install's page; closing the sheet on the page; a person in several workspaces; a person at the device cap; the network cut between Continue and the exchange (the code expires: "sign in again"); a second sign-in on the same phone (same device kept); removal in Studio; deactivation by an admin; Sign out; switching from a hosted session; pairing off on the install with an organisation-signed phone still working; a test install with a one-day maximum age checked the next day (`device_token_expired`); push arriving on an organisation-signed phone; VoiceOver and the largest text size on every new screen; the module present in the binary (no "native module not found").

## 12. Risks

| Risk | What reduces it |
| --- | --- |
| App Review reads organisation sign-in as a third-party login needing an alternative. | The review notes name 4.8's enterprise case; the review install (D-9). |
| The consent alert ("wants to use … to sign in") confuses people. | D-1; checked on a phone. |
| A person closes the sheet on the install's page and does not know why it stopped. | The "didn't finish" words point at the page and at pairing. |
| Core's contract moves before Wave 6 merges. | `pendingUpstream` routes; the build PR re-reads core PRD-277 §5.7 at merge. |
| Android ends the app while the browser is in front. | The return with nothing pending says "didn't finish"; Android is not released (§5.11). |
| The words promise more than the code does (11.5). | US-305/US-306 sentences read against the code in review. |

## 13. Open questions

1. **The identity provider's name on the button.** Discovery carries no display name for the provider, so the button says "Sign in with my organisation". Should core add one to `auth.oidc`? Recommendation: not for this PRD; ask when an organisation asks.
2. **Account deletion (5.1.1(v), rule 8.5).** The install may make the person's record at their first sign-in, in its browser pages. Recommendation: that is the organisation's account, not one the app creates; the review notes say who deletes it. The owner confirms.
3. **Push on an organisation-signed phone.** The device row is the same kind of row (core PRD-277 §5.7 items 6 and 8), so push registration should not change; to be confirmed on a phone (§11.2).
4. **An end time from core** (D-5): which answer carries it, if core agrees.
5. **Core's open question 4** (core PRD-277 §12: which Apple rule applies) is answered by §7 of this PRD.
