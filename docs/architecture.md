# Architecture

How Automatos Go is put together, and how it talks to an Automatos server (automatos-ai).
State on 24 Oct 2026: `main` at `f432b3f`. Push, the extra styles and voice are on branches;
see [push.md](push.md), [styles-and-themes.md](styles-and-themes.md) and [voice.md](voice.md).

Automatos Go is a native Expo app (SDK 54, React Native 0.81.5, expo-router 6, TypeScript strict).
It talks to one Automatos server at a time over HTTPS. There is no WebView: a link to Studio opens
the system browser ([CLAUDE.md](../CLAUDE.md) "Never").

## The picture

```
 Automatos Go
 +----------------------------------------------------------------------------------+
 | app/            expo-router screens: welcome, (auth)/sign-in, connect, go/pair,  |
 |                 (app)/ home, chat, chats, cc/*, settings                         |
 +----------------------------------------------------------------------------------+
 | src/app-state   the gate: server -> sign-in -> discovery -> workspace -> consent |
 | src/session     install wipe, auth branch, role refresh, token rotation          |
 +----------------------------------------------------------------------------------+
 | features        src/chat  src/cc  src/connect  src/consent  src/styles  src/ui   |
 |                 (src/push + src/step-up on feat/a4-push; src/voice planned)      |
 +----------------------------------------------------------------------------------+
 | src/navigation  app routes, web link -> app route                                |
 | src/auth        AuthProvider: clerk (hosted) | device (paired own server)        |
 | src/api         the one client: bearer + X-Workspace-ID, zod, errors, SSE, cache |
 | src/core        pure TypeScript vendored from automatos-ai at 1a8956c87          |
 | src/storage     encrypted MMKV          src/lib  env, logger, keychain registry  |
 +----------------------------------------------------------------------------------+
                         |  HTTPS (http only to a home-network address)
                         v
 automatos-ai: GET /.well-known/automatos.json, /api/..., GET /api/v1/tasks/stream
```

Screens call feature modules. Feature modules make every HTTP call through `src/api`. Nothing
else may: `fetch` and `XMLHttpRequest` are lint-banned outside `src/api/**`, and only
`src/api/transport.ts` may import `expo/fetch` ([eslint.config.js](../eslint.config.js),
[CLAUDE.md](../CLAUDE.md) "Lint guards").

## The layers

### `app/`: screens

expo-router file routes. On `main`:

| File | Screen |
|---|---|
| `app/welcome.tsx` | Welcome: Sign in to Automatos, or Connect to your own server |
| `app/(auth)/sign-in.tsx` | Hosted sign-in (Clerk) |
| `app/connect/index.tsx`, `app/connect/scan.tsx` | Connect to your own server, and the QR scanner |
| `app/go/pair.tsx` | A pairing link handed to the app; opens Connect prefilled |
| `app/(app)/index.tsx` | Home: the header, the one menu, the needs strip, Auto's thread |
| `app/(app)/chat/index.tsx`, `app/(app)/chat/[id].tsx` | A new chat, and one chat |
| `app/(app)/chats.tsx` | Conversations (older chats) |
| `app/(app)/cc/*` | Command Centre: board, calendar, questions, deliverables, ticket, social |
| `app/(app)/settings/index.tsx` | Settings → Account |
| `app/+native-intent.tsx` | Maps a system link (universal link, App Link) to an app path |

The root layout ([app/_layout.tsx](../app/_layout.tsx)) wraps the router in this order:
gesture root → safe area → `InstallGate` → `ThemeProvider` → `ToastProvider` → `QueryRoot` →
`AuthRoot` → `Stack`. `InstallGate` runs the reinstall wipe before anything reads the keychain.
`AuthRoot` mounts the sign-in tree for the current server.

Everything under `app/(app)/` opens only through the gate
([app/(app)/_layout.tsx](../app/(app)/_layout.tsx)). The same layout mounts `useSessionRefresh`
beside the gate, and the "Unencrypted home network" bar above every signed-in state while an own
server uses http.

### `src/app-state/` and `src/session/`: the gate

[src/app-state/gate.ts](../src/app-state/gate.ts) decides what a signed-in phone sees. It is pure
and tested; `AppGate.tsx` wires it. In order:

1. **The server and the sign-in.** Connected nowhere → Welcome. A paired server with no token, or
   one that refused it → Connect, with that server and the reason. Otherwise the session.
2. **Discovery.** `GET /.well-known/automatos.json` at the current server. An own server that does
   not answer, or answers 502/504 through a proxy, is "not running".
3. **A sign-in this app has.** The first of the server's `auth.modes` that this build registered
   ([src/auth/select.ts](../src/auth/select.ts)). None → "This server needs a newer Automatos Go".
   An own server must still list `device` and have `pairing.enabled`
   ([src/connect/server-support.ts](../src/connect/server-support.ts)).
4. **The workspace.** `GET /api/workspaces/current`, read again on every launch
   ([src/app-state/use-launch.ts](../src/app-state/use-launch.ts)). A refusal is "paused" or
   "workspace not available" ([src/session/bootstrap-refusal.ts](../src/session/bootstrap-refusal.ts));
   any other failure gets Retry.
5. **Consent.** The AI-provider consent sheet, for a person who can send and has not agreed to the
   workspace's current `ai_providers` ([src/consent/policy.ts](../src/consent/policy.ts)).
6. **The screens**, with the session (`useAppSession`, [src/app-state/session.tsx](../src/app-state/session.tsx))
   and the one live connection, mounted afresh for each workspace.

`src/session/` holds the parts that run beside the gate:

- `InstallGate.tsx` + `src/connect/install-marker.ts`: the reinstall wipe. iOS keeps keychain
  items after the app is deleted, so a fresh install deletes every item in the key registry.
- `auth-branch.ts`: which sign-in tree `AuthRoot` mounts (own, hosted, or hosted not configured).
- `role-refresh.ts` + `config.ts`: the role is read again at launch, on resume when the last read
  is older than 30 s, and after any 403 at most once every 10 s.
- `use-session-refresh.ts`: runs those reads, and rotates a paired phone's token when it is due.

### `src/auth/`: who is signed in

One small interface, [src/auth/providers/types.ts](../src/auth/providers/types.ts):

```ts
interface AuthProvider {
  readonly kind: 'clerk' | 'device' | 'oidc';
  getToken(): Promise<string | null>;
  signOut(): Promise<void>;
  onExpired(listener: () => void): () => void;
}
```

[registry.ts](../src/auth/providers/registry.ts) registers two providers. `oidc` is a known mode
with no provider yet, so a server that offers only it gets "needs a newer Automatos Go".

| Provider | Used for | Token |
|---|---|---|
| [clerk.ts](../src/auth/providers/clerk.ts) | The build's hosted server | A Clerk JWT from the `mobile` template only ([config.ts](../src/auth/config.ts)). A 404 from the template reads "Sign-in is not set up for Automatos Go on this server yet." |
| [device.ts](../src/auth/providers/device.ts) | A self-hosted server the phone paired with | The `amd_` device token from the keychain. A 401 after the token went out ends the pairing once, with the reason ([src/connect/expiry.ts](../src/connect/expiry.ts)). |

[AuthRoot.tsx](../src/auth/AuthRoot.tsx) mounts the tree for the current server. An own server
gets the device session and **no `ClerkProvider`**: no Clerk hook runs and nothing reaches Clerk.
The hosted server gets `ClerkProvider` with the build's `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, the
keychain token cache ([token-cache.ts](../src/auth/token-cache.ts)) and native passkeys. A new
server or a new pairing remounts the tree.

Roles come from the workspace bootstrap, never from the sign-in mode
([src/auth/role.ts](../src/auth/role.ts)). Owners, admins and editors may `chat`, `answer`,
`approve`, `pause` and `report`. Viewers get a read-only app. A role the app does not know reads as
viewer ([src/api/workspace.ts](../src/api/workspace.ts)). The server enforces the same line.

### `src/api/`: the one client

[client.ts](../src/api/client.ts) is the only HTTP client. For each call it:

- fills the route's `{name}` path parameters, URI-encoded;
- sends `Authorization: Bearer <token>` and, once known, `X-Workspace-ID`
  ([auth-headers.ts](../src/api/auth-headers.ts));
- JSON-encodes plain bodies and passes `FormData` through (attachments);
- maps every failure to one error kind ([errors.ts](../src/api/errors.ts));
- parses every JSON response with the caller's zod schema. With no schema the body is discarded.

Native loads that cannot go through the client (expo-file-system downloads, expo-image sources)
take the same two headers from `authHeaders()`.

Timeouts ([config.ts](../src/api/config.ts)): 30 s for a request; 30 s for a stream to answer
with its status, after which the body runs until the caller aborts.

**Error kinds.** Each kind has one sentence ([strings.ts](../src/api/strings.ts)). Statuses with no
kind of their own (400, 422, 429, …) are `server`.

| Kind | What the person reads |
|---|---|
| `network` | "Can't reach Automatos. Check your connection and try again." |
| `auth` | "Your session has ended. Sign in again to carry on." |
| `forbidden` | "You don't have permission to do that in this workspace." |
| `not_found` | "We couldn't find that. It may have been moved or removed." |
| `conflict` | "That changed while you were working on it. Refresh and try again." |
| `server` | "Automatos couldn't finish that. Try again in a moment." |
| `stream` | "The reply was interrupted. Try again." |
| `invalid_response` | "Automatos sent something this version can't read. Try again, or update the app." |

**Route tables.** [src/api/routes.ts](../src/api/routes.ts) holds the foundation's routes. Each
feature keeps its own `src/<feature>/routes.ts`. `npm run check:routes`
([scripts/check-routes.ts](../scripts/check-routes.ts)) checks every `{method, path}` against
`src/core/route-manifest.json` at the pinned automatos-ai commit. A route the server added after
the pin carries `pendingUpstream: '<story>'`; it passes and is listed.

**Live events.** One `GET /api/v1/tasks/stream` (server-sent events) while the app is in the
foreground ([live-connection.ts](../src/api/live-connection.ts)). It is an invalidation signal,
not a data feed: `board_changed` refetches the board, the open ticket, the needs-you number and the
questions; `chat_changed` goes only to the screens that subscribe to it
([live-events.ts](../src/api/live-events.ts)). A drop
reconnects after 1 s, 2 s, 4 s … up to 30 s. The stream has no replay, so coming back to the
foreground refetches first.

**Cache.** TanStack Query ([query-client.ts](../src/api/query-client.ts)). Persisted for 24 h in
the encrypted store: workspace, discovery, board, schedule and Deliverables lists. Memory only:
chat, questions, needs-you, ticket, social post, Deliverable detail
([query-keys.ts](../src/api/query-keys.ts)). Mutations are never persisted and never queued
offline: an answer or an approval reaches the server now or fails.

### `src/core/`: code shared with the web

`src/core/web/` is pure TypeScript copied from automatos-ai's `frontend/` by
[scripts/sync-core.ts](../scripts/sync-core.ts) and recorded in [core.lock.json](../core.lock.json)
(source `AutomatosAI/automatos-ai`, sha `1a8956c87`, synced 30 Oct 2026). It holds the chat
helpers (receipts, narration, tool calls, errors), the board and calendar helpers and the look
kit. Nobody edits it by hand: `npm run check:core` fails on any drift. The lock also lists the
web's tests that could not be copied, and why.

`src/core/frozen/` holds what core has since deleted but the app still runs: PRD-261 W-A8 took
built-in Play out of core (Play now ships from the Design Kit, `AutomatosAI/automatos-design-kit`
`themes/play/src`), so Play's chat lines and caption, the looks catalogue and engine, the mascot's
state machine, their web tests and the theme SDK type slices they import stay as `630fc1c85`
vendored them. It mirrors `frontend/` like `src/core/web/`; each file opens with a provenance
header (source path and SHA), and `scripts/core-manifest.json` `frozen` records its sha256, so
`npm run check:core` fails on an edit, a lost header or a stray file. Nothing writes these files:
to change one, make it the app's own code outside `src/core/frozen/` and drop its entry. The looks
engine's Studio-token test did that at the re-pin to `1a8956c87`, when PRD-268 K13 made the
vendored `lookToStudioTokens` set Studio's status tokens: it is now
[play-look-studio-tokens.test.ts](../src/styles/tokens/__tests__/play-look-studio-tokens.test.ts).

The app's own pure code sits beside it: [turn-reducer.ts](../src/core/turn-reducer.ts) folds one
chat turn from its stream frames, and `src/core/parity/` with `src/core/__fixtures__/parity/`
checks the stream parser against recorded server turns (see the README, "Recording a real chat
turn"). `src/core/*.ts` and `src/core/parity/**` import no React, React Native or Expo (lint rule).

To move the pin: `npx tsx scripts/sync-core.ts --source <automatos-ai checkout>`, then
`npm run check:core` and `npm run check:routes`. A re-pin is also when `pendingUpstream` marks come
off routes the server now has.

### Feature modules

| Module | What it does |
|---|---|
| `src/chat/` | Auto's thread. `controller/` runs turns over `POST /api/chat` and folds them with `turnReducer`. Stop aborts the read **and** sends `POST /api/chat/{id}/cancel`, because the turn runs detached on the server ([turn-runner.ts](../src/chat/controller/turn-runner.ts)). A cached chat id is checked before reuse, because `POST /api/chat` with a stale id starts a new chat ([live-chat.ts](../src/chat/controller/live-chat.ts)). Also: composer, attachments, markdown, cards, older chats, ticket discussion, Report this (**Gated** on `report_content`). |
| `src/cc/` | Command Centre: `shell/` (top bar, head, tabs), `board/`, `ticket/`, `calendar/`, `questions/`, `social/`, `deliverables/`. |
| `src/connect/` | Own-server address rules, discovery check, pairing, the paired record, token rotation, server switching. See [connecting.md](connecting.md). |
| `src/consent/` | The AI-provider consent sheet. The record is kept per server and workspace in the encrypted store and never sent anywhere ([store.ts](../src/consent/store.ts)). |
| `src/styles/` | On `main`: Studio's tokens, fonts, the thread look, Light/Dark following the iPhone, and the AI label ([ai-label.tsx](../src/styles/ai-label.tsx)). A5 adds Play, HUD, the mascot and installed themes. |
| `src/ui/` | Primitives shared by every screen: Button, Card, Sheet, Toast, ListRow, TextField, ReportSheet and others. |
| `src/navigation/` | [routes.ts](../src/navigation/routes.ts) names every app route; screens never write a path by hand. [web-links.ts](../src/navigation/web-links.ts) maps a web path to an app screen; any other internal path opens the current server's Studio in the browser. |

### `src/storage/` and `src/lib/`

- [encrypted-storage.ts](../src/storage/encrypted-storage.ts): one MMKV file, AES-256, with the key
  made once from secure random bytes and kept in the keychain. If the keychain cannot give the key
  (locked before the first unlock), the store runs in memory for that launch. It never falls back
  to an unencrypted file.
- [secure-keys.ts](../src/lib/secure-keys.ts): every keychain item the app writes is named in one
  index item, written before the item and removed after it. Sign-out and the reinstall wipe list
  the index and delete everything. Items use `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: never in a
  backup, never on another phone.
- [env.ts](../src/lib/env.ts): the four `EXPO_PUBLIC_*` values, parsed with zod. Blank means "not
  configured".
- [logger.ts](../src/lib/logger.ts): the only file that may use `console`.

## How the app talks to automatos-ai

**One server at a time** ([src/connect/current-server.ts](../src/connect/current-server.ts)). The
phone uses an own server exactly when it holds a paired record. Otherwise it uses the build's
hosted server from `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL`
([src/api/server.ts](../src/api/server.ts)). There is no other saved choice. For an own server,
every call goes to the origin that answered discovery, never to the document's `api_url`; Studio
links open its `web_url`.

**The token.** Hosted: the Clerk `mobile` JWT. Own server: the `amd_` device token. On the server,
an `amd_` bearer is resolved before Clerk (automatos-ai `orchestrator/core/auth/bearer_registry.py`,
`core/auth/device.py`), so every route that takes `get_request_context_hybrid` accepts a paired
phone. The phone acts as its person, in the one workspace it paired to. Naming another workspace is
403.

**Discovery and capabilities.** The app reads `GET /.well-known/automatos.json` with no bearer
([src/api/discovery.ts](../src/api/discovery.ts)). It shows features by capability, never by server
version ([src/api/capabilities.ts](../src/api/capabilities.ts)). Unknown capabilities are dropped.
If the hosted server answers 404, the app uses built-in defaults with no capabilities.

| Capability | Turns on | Listed by automatos-ai `main` today |
|---|---|---|
| `mobile_theme` | Installed themes in the style picker (A5) | yes |
| `spoken_mode` | Spoken-style replies for voice (A6) | yes |
| `voice_live` | The Auto Live button (A6) | yes |
| `report_content` | Report this (**Gated**) | no: Report this stays hidden on every server |
| `push` (with `push.expo: true`) | Notifications (A4) | yes, since #1300 (W2, 24 Oct); `push.expo` is true on SaaS, and self-hosted once its operator agrees |
| `digest` | Daily digest time (A4) | yes, since #1300 (W2, 24 Oct) |
| `tts` | Auto's server voice: quick-ask's replies and Settings → Voice's list ([voice.md](voice.md#autos-server-voice)) | yes, since #1348 (27 Oct), listed only when the server has a voice (`VOICE_TTS_URL`) |
| `digest_now` | **Send today's brief now** under the digest time (A4, `POST /api/v1/mobile/digest/now`) | yes, since #1356 (28 Oct) |
| `brief` | PRD-268's brief: the on-open call (`POST /api/proactive/brief/open`) and the `brief@1` card in the thread (US-G06) | yes, since #1375 (PRD-268 W2, K20; on core `main` 30 Oct) |
| `suggestions` | PRD-268's suggestions: the pinned card, the header count, Start and Hide (US-G01) | yes, since #1375 (PRD-268 W2, K20; the routes since W1, #1367; on core `main` 30 Oct) |
| `readiness` | PRD-268's **What Auto depends on** in Settings: `GET /api/readiness`, Check again (`POST /api/readiness/check`), and this phone's push, microphone, speech recognition and server voice rows (US-G07) | yes, since #1375 (PRD-268 W2, K20; the routes since W1, US-C18, #1367; on core `main` 30 Oct) |

The server side is automatos-ai `orchestrator/services/mobile/discovery.py` (`CAPABILITY_ROUTES`).

**The workspace bootstrap.** `GET /api/workspaces/current` on every launch. The server silently
replaces an `X-Workspace-ID` the person can no longer use, so the app stores the id it returns and
sends that from then on ([src/api/workspace.ts](../src/api/workspace.ts)). The schema keeps only
what the app reads; plan limits and prices are dropped at parse time.

**Leaving a server.** Switching servers clears the query cache and its saved copy, the stored
workspace id, the active provider, the consent memory and the session's other memory (today's
brief's wait), in that order, before the next server is used
([src/connect/switch.ts](../src/connect/switch.ts)).

## Rules that hold everywhere

From PRD-001 §4.11 and [CLAUDE.md](../CLAUDE.md):

- HTTP only through `src/api/`. zod at every boundary; unknown fields ignored.
- Pure logic outside React, with tests in `__tests__/` beside the module.
- Immutable updates. No hard-coded URLs or keys: they come from the EAS environment or discovery.
- Colours only from tokens: no colour literal outside `src/styles/tokens/**` (lint rule).
- User-facing words in one `strings.ts` per feature.
- Files warn over 400 lines and fail over 800; functions 50 lines (`.tsx` 150).

## Related

- [connecting.md](connecting.md): hosted sign-in and pairing with your own server.
- [native-modules.md](native-modules.md): every native module, usage string and config plugin.
- [release.md](release.md): CI, EAS Workflows, updates and builds.
