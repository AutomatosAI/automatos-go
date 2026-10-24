# Connecting a phone to a server

How Automatos Go finds its server and proves who it is: hosted sign-in with an Automatos account,
or pairing with a server you run. State on 24 Oct 2026. Everything here is **on `main`**, except
the QR image in Studio, which comes with the automatos-ai W2 branch (`feat/prd-266-w2-push`).

Code: [src/connect/](../src/connect/), [src/auth/](../src/auth/),
[src/api/discovery.ts](../src/api/discovery.ts). Server: automatos-ai
`orchestrator/api/mobile_devices.py`, `orchestrator/services/mobile/`,
`orchestrator/core/auth/pairing.py` and `core/auth/device.py`.

## Which server the phone uses

The phone uses an **own server** exactly when it holds a paired record in the keychain. Otherwise
it uses the build's **hosted server**, from `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL`
([src/connect/current-server.ts](../src/connect/current-server.ts),
[src/api/server.ts](../src/api/server.ts)). There is no other saved choice, and the phone talks to
one server at a time.

| | Hosted (Automatos cloud) | Own server (self-hosted) |
|---|---|---|
| Discovery `edition` | `saas` | `local` |
| Sign-in | Clerk, with the Automatos account | A paired device token |
| Bearer | Clerk JWT from the `mobile` template | `amd_…` device token |
| Where it is kept | Clerk's token cache in the keychain | One keychain item, `automatos.paired-server.v1` |
| Way out in Settings | **Sign out** | **Remove this phone and forget this server** |

## Hosted sign-in

1. Welcome → **Sign in to Automatos**.
2. The person signs in with an email code, a password or a passkey, plus a second factor if the
   account needs one ([src/auth/sign-in-machine.ts](../src/auth/sign-in-machine.ts)). There is no
   sign-up, no social sign-in and no Sign in with Apple.
3. Every call carries a Clerk JWT minted from the template named `mobile`, and only that one
   ([src/auth/config.ts](../src/auth/config.ts)). If the server's Clerk instance has no such
   template, the app shows "Sign-in is not set up for Automatos Go on this server yet."

A build made without `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` or `EXPO_PUBLIC_API_URL` shows "Sign-in is
not configured in this build" on the hosted sign-in only. Welcome and Connect still work
([src/session/auth-branch.ts](../src/session/auth-branch.ts)).

The Clerk instance needs: Native API on, the iOS and Android apps registered, passkeys on, the
`mobile` JWT template and 30-day sessions ([README.md](../README.md), "Human steps").

If the hosted server has no discovery document yet (404), the app uses built-in defaults: edition
`saas`, Clerk sign-in, no capabilities ([src/api/discovery.ts](../src/api/discovery.ts),
`hostedDefaults`).

## Own server: what the operator sets

On the automatos-ai install (local edition):

| Setting | Where | What it does |
|---|---|---|
| `LOCAL_REMOTE_ACCESS` | `.env` | `off` (default), `paired` or `open`. **Only `paired` lets a phone pair.** With `off` or `open`, discovery says `pairing.enabled: false`, `POST /api/v1/mobile/pair` is 404 and the mint script exits 2. `paired` also makes every browser pair, the one on the server machine included. |
| `API_PUBLISH_ADDRESS`, `WEB_PUBLISH_ADDRESS` | `.env` | Publish only the API and the web app beyond `127.0.0.1`. With `off`, the backend refuses to start when either reaches beyond loopback. |
| `PUBLIC_API_HOST` | `envs/api.local` | The API host the discovery document hands the phone, always as `https://`. Set it behind a TLS proxy. Leave it unset for a plain home-network http install. |
| `FRONTEND_URL` | `envs/api.local` | Studio's address: `web_url` in discovery, so the phone's Studio links (Open in Studio, Manage in Studio) open there; also the host of the pairing link, used only when the iPhone Camera app opens it. Left at `http://localhost:3000`, the phone's Studio links open a page the phone cannot load. |
| `MOBILE_TOKEN_ROTATE_DAYS`, `MOBILE_TOKEN_ROTATION_OVERLAP_SECONDS` | `envs/api.local` | 30 days and 600 s by default. See "Token rotation". |
| `RATE_LIMIT_MOBILE_PAIR_IP_MAX`, `RATE_LIMIT_MOBILE_PAIR_IP_WINDOW_SECONDS` | `envs/api.local` | Override the pairing limit (10 attempts per 600 s). |

`PUBLIC_API_HOST` and `FRONTEND_URL` go in `envs/api.local` because docker compose does not pass
them from `.env`.

The steps, with Caddy and Tailscale examples, are in automatos-ai
[QUICKSTART.md, "Reach your install from your phone"](https://github.com/AutomatosAI/automatos-ai/blob/main/QUICKSTART.md#reach-your-install-from-your-phone-optional)
and SETUP.md. The settings reference is
[docs/getting-started/self-hosting.md, "Connect a phone (Automatos Go)"](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/getting-started/self-hosting.md#connect-a-phone-automatos-go)
(added by the automatos-ai `docs/self-hosting-phone` change).

To check a server from a laptop:

```bash
curl -s https://<api address>/.well-known/automatos.json
```

A server ready for phones answers `"edition":"local"`, `"auth":{"modes":["device"],"clerk":null}`,
`"pairing":{"enabled":true}`, and an `api_url` and `web_url` the phone can reach.

## Discovery

`GET /.well-known/automatos.json` is public. The phone reads it with no bearer and no workspace
header, before any sign-in ([src/api/discovery.ts](../src/api/discovery.ts)). The server builds it
fresh on each call (automatos-ai `orchestrator/services/mobile/discovery.py`).

```json
{
  "schema": "automatos-discovery/v1",
  "name": "Automatos",
  "edition": "local",
  "api_url": "https://api.example.com",
  "web_url": "https://studio.example.com",
  "auth": { "modes": ["device"], "clerk": null },
  "pairing": { "enabled": true },
  "push": { "expo": false },
  "capabilities": ["mobile_theme", "spoken_mode", "voice_live"]
}
```

What the phone does with it:

- `schema` must be `automatos-discovery/v1`, or Connect says the address did not answer like an
  Automatos server.
- `auth.modes`: the first mode this build registered wins (`clerk`, `device`). None →
  "This server needs a newer Automatos Go" ([src/auth/select.ts](../src/auth/select.ts)).
- An own server must list `device` and have `pairing.enabled: true`
  ([src/connect/server-support.ts](../src/connect/server-support.ts)).
- The build's own hosted address typed at Connect → "This is the Automatos hosted server. Use Sign
  in to Automatos instead." Any other server that offers only Clerk → "This server needs a newer
  Automatos Go" ([src/connect/next-step.ts](../src/connect/next-step.ts)).
- `capabilities` turn features on. Unknown names are dropped. See
  [architecture.md](architecture.md#how-the-app-talks-to-automatos-ai) for the table.
- After pairing, every call goes to the **origin that answered discovery**, never to the
  document's `api_url`. Studio links open `web_url`
  ([src/api/server.ts](../src/api/server.ts), `ownServerFrom`).

## Pairing, step by step

### 1. Studio mints a code

Studio → **Settings → Phones & devices → Pair a phone → Get a pairing code**. The panel shows only
on a local install in `paired` mode.

- Route: `POST /api/v1/mobile/pairing-codes`. Owner or admin only; 404 on SaaS. The answer is
  `{code, expires_at, qr_payload}` with `Cache-Control: no-store`.
- The server adds a pending `mobile_devices` row of kind `paired` that holds only the code's
  SHA-256 hash and its expiry.
- `qr_payload` is the pairing link: `{FRONTEND_URL}/go/pair?api=<api address>&code=<code>`.
  While `PUBLIC_API_HOST` is unset, the API address is the one the browser used to reach the API,
  so a code minted from Studio opened on the server itself can carry `http://localhost:8000`.
  Once it is set, the link names `https://<PUBLIC_API_HOST>` (automatos-ai
  `services/mobile/urls.py`, `api_url`).
- Studio shows the code, "Expires in m:ss" and the link with Copy. The QR image of the link is on
  the W2 branch.

From a terminal on the server, for the first phone:

```bash
docker compose exec backend python -m scripts.mint_pairing_code [--name NAME]
```

It mints a code for `LOCAL_OPERATOR_EMAIL` in `DEFAULT_WORKSPACE_ID`, prints the code, its expiry
and the link, and exits 2 on SaaS or outside `paired` mode.

### 2. The phone takes the address and the code

Welcome → **Connect to your own server** ([app/connect/index.tsx](../app/connect/index.tsx)). Three
ways in, all of which stop at the confirm card:

- **Type** the server address and the code.
- **Scan the code in Studio** ([app/connect/scan.tsx](../app/connect/scan.tsx)). The camera
  permission is asked here, not at launch.
- **A pairing link** handed to the app: `{web_url}/go/pair?api=…&code=…` or
  `automatos://go/pair?…` ([app/go/pair.tsx](../app/go/pair.tsx),
  [src/connect/pair-link.ts](../src/connect/pair-link.ts)). The link's own host is never
  contacted; only its `api` parameter is used. If the phone already uses another server, it asks
  "Connect to another server?" first.

Scanning a self-hosted QR with the iPhone **Camera app** opens that server's `/go/pair` web page,
not the app. Universal links cover only `ui.automatos.app` (`applinks:ui.automatos.app` in
[app.json](../app.json)), and the web page never pairs. Scan from inside Automatos Go.

The code is checked on the phone first ([src/connect/pair-code.ts](../src/connect/pair-code.ts)):
8 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0, O, 1 or I), spaces and hyphens
ignored, always sent as `XXXX-XXXX`.

### 3. The address is checked

[src/connect/address.ts](../src/connect/address.ts) `parseServerAddress`:

| Address | Result |
|---|---|
| No scheme typed | `https://` is added |
| `https://` any host | Allowed |
| `http://` to `10.x.x.x`, `172.16–31.x.x`, `192.168.x.x`, or a name ending `.local` | Allowed, marked unencrypted |
| `http://` to any other host, including IPv6 literals and Tailscale's `100.64.0.0/10` | Refused: "This address needs https://…" |
| `localhost`, `*.localhost`, `127.x.x.x`, `0.x.x.x`, IPv6 loopback | Refused: on a phone, that is the phone itself |
| A path, query, fragment or user info after the host | Refused: type just the server address |

For Tailscale, use the https `*.ts.net` name (`tailscale serve`), not the `100.x` address.

The binary allows this: iOS `NSAllowsLocalNetworking`, Android `usesCleartextTraffic`
([app.json](../app.json); [native-modules.md](native-modules.md), "App Transport Security and
cleartext").

### 4. Discovery and the confirm card

The phone reads discovery at that origin and shows **Pair with this server?** with the server's
name, edition and address, and "Address the server lists" when the document names a different one.
Nothing pairs until the person taps **Pair** ([src/connect/flow.ts](../src/connect/flow.ts): the
only way into `pairing` is `confirm`).

An http server adds a warning on the card. Once paired, a one-line "Unencrypted home network ·
{host}" bar sits above every signed-in screen while the server uses http
([app/(app)/_layout.tsx](../app/(app)/_layout.tsx)).

The card also carries the data note: chats, files and reports stay on the server; the app itself
sends crash reports to Automatos, checks Expo for app updates and, if the operator agrees, sends
notifications through Expo and Apple or Google ([src/connect/strings.ts](../src/connect/strings.ts)).
Crash reporting is not started on `main` yet; see "Known gaps".

### 5. The code is exchanged for a token

`POST /api/v1/mobile/pair`, through the one client with **no credential**: no bearer, no
`X-Workspace-ID` ([src/connect/api.ts](../src/connect/api.ts)).

```json
{
  "code": "ABCD-EFGH",
  "name": "Automatos Go on iPhone",
  "platform": "ios",
  "app_version": "<the app's version>",
  "install_id": "<16 random bytes, base64url>"
}
```

The answer comes once, with `no-store`:

```json
{ "device_id": "…", "workspace_id": "…", "token": "amd_…", "rotate_after": "<ISO 8601>" }
```

How the phone reads a refusal:

| Server answer | What the phone shows |
|---|---|
| `401 {"code":"invalid_pairing_code"}` | "That code didn't work. Codes last 10 minutes and work once." |
| `404` | "This server isn't taking phones yet. Its operator turns pairing on with `LOCAL_REMOTE_ACCESS=paired` …" |
| `429` | "Too many pairing tries from this network. Wait a few minutes, then try again." |
| `409`, `5xx` | "The server couldn't pair this phone just now. Try again in a minute." |
| No answer | "Can't reach this server. Check the address and your phone's connection …" |

### 6. The phone saves the pairing and switches

[src/connect/switch.ts](../src/connect/switch.ts) clears the last server first: the query cache and
its saved copy, the stored workspace id, the active provider and the consent memory. Then it saves
the paired record to the keychain, and only then moves the current server. `AuthRoot` remounts on
the device session with no `ClerkProvider`, and the gate opens the workspace (see "The gate" in
[architecture.md](architecture.md)).

The device shows up in Studio's **Phones & devices** as "Automatos Go on iPhone".

## Security model

**The code.** 8 characters from a 32-symbol alphabet, alive 600 s
(`PAIRING_CODE_TTL_SECONDS`), single use. The server stores only its SHA-256 hash and compares in
constant time. A wrong guess does not use up the pending code (automatos-ai
`core/auth/pairing.py`, `services/mobile/pairing.py`).

**The rate limit.** 10 attempts per client IP per 600 s (an IPv6 /64 counts as one IP), checked
before the code is read. Over it: `429` with `Retry-After`. There is no instance-wide bucket, so
one caller cannot block pairing for everyone. The IP is the first `X-Forwarded-For` hop, so the
limit is only as honest as the proxy in front: a proxy must replace that header. If Redis is down
the attempt is let through and an ERROR is logged (`api/mobile_devices.py`).

**The token.** `amd_` plus `token_urlsafe(32)`. The server stores only its hash. On the phone it
lives in one keychain item, `automatos.paired-server.v1`, with
`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: never in a backup, never on another phone, readable after
the first unlock. It is never in MMKV, the query cache, a log or Sentry
([src/connect/device-store.ts](../src/connect/device-store.ts)). The record is written to the
keychain before the token is used.

**What a paired phone may do.** On the server an `amd_` bearer is resolved before Clerk
(`core/auth/bearer_registry.py`), so every route on `get_request_context_hybrid` accepts it. The
phone acts as its person, in the one workspace it paired to; naming another workspace is 403. The
local operator's phone is `super_admin`; anyone else's is judged by their member role. A paused
workspace is 403. A removed member or a deactivated user gets a plain 401 (`core/auth/device.py`).
SaaS refuses every `amd_` bearer.

**The install id.** 16 random bytes in its own keychain item, `automatos.install-id.v1`, kept
outside the key registry so sign-out and the reinstall wipe leave it
([src/connect/install-id.ts](../src/connect/install-id.ts)). Pairing again with the same person and
install id keeps the same row in Studio: a new token, the old tokens dead.

**The reinstall wipe.** iOS keeps keychain items after the app is deleted. A fresh install finds
no marker in its own small MMKV file and deletes every keychain item in the registry, and the paired
record once more by name, before anything reads the keychain
([src/connect/install-marker.ts](../src/connect/install-marker.ts),
[src/session/InstallGate.tsx](../src/session/InstallGate.tsx)).

### Token rotation

`rotate_after` is `now + MOBILE_TOKEN_ROTATE_DAYS` (30). At launch and on resume, once that time
has passed, the phone calls `POST /api/v1/mobile/devices/{device_id}/rotate` with its **current**
token ([src/connect/rotation.ts](../src/connect/rotation.ts)). Never per request; one rotation at a
time.

- The answer is `{device_id, token, rotate_after, previous_token_valid_until}`. The old token keeps
  working for `MOBILE_TOKEN_ROTATION_OVERLAP_SECONDS` (600).
- The new token is written to the keychain before it is used.
- On any failure the phone keeps the old token and tries at the next launch or resume.
- Presenting a token already rotated out is `409 token_superseded`.

### Revoke and remove

- **From Studio:** Phones & devices → **Revoke**. The server keeps the token hash, so the phone's
  next call is `401 {"code":"device_revoked"}`.
- **From the phone:** Settings → **Remove this phone and forget this server**, asked first. It
  sends `DELETE /api/v1/mobile/devices/{device_id}` with the device token, waits at most 10 s
  (`REMOVE_DEVICE_TIMEOUT_MS`), then forgets the server anyway. If the server could not be told, a
  toast says Studio may still list the phone ([src/connect/remove-device.ts](../src/connect/remove-device.ts)).

When an own server refuses the token, the phone clears the record once and goes back to Connect
with the reason ([src/connect/expiry.ts](../src/connect/expiry.ts)):

| Server answer | What the phone shows |
|---|---|
| `401 device_revoked` | "This phone was removed from {server}. Pair it again from Studio → Settings → Phones & devices." |
| `401 device_pairing_required` | "{server} only answers paired phones. Pair it again …" |
| Any other 401 | "This phone's connection to {server} ended. Pair it again …" |

### When the server is down

An own server that does not answer, or answers 502 or 504 through a proxy, shows "Can't reach
{server}" with the start command `docker compose up -d`
([src/connect/config.ts](../src/connect/config.ts)). A 503 is not "down": the server answers it
while running. The way out is **Remove this phone and forget this server**.

## Known gaps (24 Oct 2026)

- **The named doc section.** The app's copy points operators at "'Reach your install from your
  phone' in the self-hosting docs" ([src/connect/strings.ts](../src/connect/strings.ts); a test
  pins the wording). Closed by the automatos-ai docs change (`docs/self-hosting-phone`), which adds
  that heading to `docs/getting-started/self-hosting.md`; remove this item once it merges.
- **Route marks.** The three routes in [src/connect/routes.ts](../src/connect/routes.ts) are still
  marked `pendingUpstream: 'PRD-266 US-003'`. automatos-ai `main` serves them; the marks come off at
  the next core re-pin.
- **`FRONTEND_URL` at its default.** The mint script warns only about a loopback API address, not
  about `FRONTEND_URL` left at `localhost`, which leaves the phone's Studio links on a page the phone
  cannot load. Pairing itself still works: the app ignores the link's host.
- **Crash reports.** The confirm card's data note says the app sends crash reports, but Sentry is
  not started on `main`: only [src/lib/env.ts](../src/lib/env.ts) reads `EXPO_PUBLIC_SENTRY_DSN`.
  Crash reporting is in the release wave's kit (A7).

## Related

- [push.md](push.md): what Remove this phone and Sign out do to notifications (branch).
- automatos-ai `docs/PRDS/PRD-266-AUTOMATOS-GO-BACKEND.md`: the server plan. Where it differs from
  the code (the per-instance limit, `docker compose exec api`), the code is right.
