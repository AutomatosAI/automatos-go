# Styles and themes (the phone's side)

How Automatos Go paints itself: three built-in styles (Studio, Play, HUD), installed workspace
themes, and "Same as Studio". This page covers the phone only. The theme package, the `mobile`
block in `theme.json` and the server routes are owned by the Themes docs in automatos-ai: see
[docs/theme-host/mobile.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/theme-host/mobile.md)
for the contract, and the Themes pages for people who install themes,
[docs/themes/](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/themes/_index.md) (the phone's page is
[on-your-phone.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/themes/on-your-phone.md)). The Themes pages
merged in automatos-ai #1304, which also revised mobile.md (first merged in #1258).

State on 24 Oct 2026. Most of this page describes the A5 branch, `feat/a5-styles` at `e4336ff` or
later, which is still being built. Paths below marked `A5:` are on that branch.

## Status

| Part | Status |
|---|---|
| Studio style, Light/Dark following the iPhone, the AI label | **On `main`** |
| Style registry, the flip, Studio's Light / Dark / System control | On branch (A5), built |
| Style and look screen (`/settings/style`) | On branch (A5), built; the Settings row "Style and look" links to it from `48a7365` (US-016j, `A5:app/(app)/settings/index.tsx`) |
| Same as Studio, installed themes with a `mobile` block | On branch (A5), built |
| Play's tokens, glow and "Make it yours" (`/settings/look/play`) | On branch (A5), built |
| HUD's tokens, grid, glow and its phone core | On branch (A5), built |
| Play and HUD looks kept in step with the web | On branch (A5), built |
| Auto the mascot (clips, stills, ring) | On branch (A5), built |
| `StyleSync` mounted once in the signed-in shell | On branch (A5), built from `48a7365` (US-016j) |
| HUD's Looks drawer (`/settings/look/hud`) | On branch (A5), built |
| A home per style; Play's Conversations and Shelf; Command Centre in every style | Kit only (US-016k, US-017g, US-016l) |
| Styled First open, Not running, Something went wrong, Lost (`A5:src/styles/edges/`) | On branch (A5), built; only Lost is wired in (`A5:app/+not-found.tsx`). From `8b5c939` the gate has an `edge` slot and `GateEdge` draws its error and Not running, but the signed-in layout does not pass `edge` yet (US-016j, not passing) |

The kit is `scripts/ralph/prd-001-styles.json` on the branch; each story's `passes` is the truth.

## On `main` today

Only Studio ships. [src/styles/theme-choice.ts](../src/styles/theme-choice.ts) holds `light`,
`dark` and `system`, and the app follows the iPhone's appearance (`system`): there is no control
yet. [src/styles/tokens/types.ts](../src/styles/tokens/types.ts) notes that A5 adds `play` and
`hud`.

The AI label is on `main` and stays the same in every style: one small muted caption, "Auto is an
AI" (or "{agent} is an AI"), at the top of each thread ([src/styles/ai-label.tsx](../src/styles/ai-label.tsx)).
It never blocks typing.

## The three styles (A5)

| Style | Picker line | Look page |
|---|---|---|
| **Studio** | "Cream paper or Studio Dark", with Light / Dark / System on its card | none: the scheme is the look |
| **Play** | "Auto and the Ember look" | **Make it yours →** (`/settings/look/play`) |
| **HUD** | "Voice first, glow and grid" | **Looks →** (`/settings/look/hud`) |

Copy: `A5:src/styles/strings.ts`. Screens: `A5:app/(app)/settings/style.tsx`,
`A5:app/(app)/settings/look/play.tsx`, `A5:app/(app)/settings/look/hud.tsx`; paths in
`A5:src/styles/nav.ts`.

**The flip** (`A5:src/styles/provider/flip.ts`). Tapping a card stores the choice on the phone,
plays one haptic tick and crossfades the whole app over 180 ms (at once under Reduce Motion).
Entering Play also counts one "hello" from Auto. Picking the choice already stored does nothing.

**What the phone stores** (`A5:src/styles/registry/choice.ts`, `choice-store.ts`). A small
versioned JSON value under `styles.choice` in the encrypted MMKV store:
`{v: 1, kind: 'builtin', id}` or `{v: 1, kind: 'theme', installId}`, or `{v: 1, kind: 'follow'}`.
**Nothing stored means "Same as Studio"**, the default since 24 Oct. A value the parser cannot
read, or a style this build does not have, is Studio, never a crash.

## Same as Studio (A5)

The first row in the Studio card, just below its Light / Dark / System control
(`A5:src/styles/picker/StyleCard.tsx`, `CardControls`): "Same as Studio · Now {style}". While it
is chosen, the phone paints what Studio shows this member, from `GET /api/themes/active`
(`A5:src/styles/themes/follow.ts`):

| Theme active in Studio | What the phone paints |
|---|---|
| `automatos/play` | Play, the phone's built-in style |
| `automatos/hud` | HUD, the phone's built-in style |
| Any other theme whose install has a `mobile` block the phone can paint | The Studio layout in that theme's colours, fonts and mascot |
| `studio` / `classic`, no theme, a theme revoked with `disable` (`revoked` on `/active`'s answer, or `theme.revoked.level` `disable`), or no `mobile` block | Studio |

Only a `disable` revocation sends the phone to Studio (`A5:src/styles/themes/follow.ts`,
`followStudio`). A `warn` revocation still paints, as it still runs on the web (automatos-ai
`orchestrator/services/themes/revocations.py`).

`/active`'s theme is the member's own choice in Studio, else the workspace default (automatos-ai
`orchestrator/services/themes/defaults.py`, `resolve_active`), not whatever is installed. The phone
follows it only while it is on Same as Studio (`A5:src/styles/registry/style-id.ts`,
`paintedChoice`). So choosing Play or HUD in Studio, or making it the workspace default, switches
the phone to that built-in style: today its tokens, dress, type, ground and Auto. The per-style
homes (HUD's core, Play's Companion) come with US-016k (kit only). Any other theme repaints Studio.
Play then paints the member's Play look and HUD the member's HUD look (see "Looks").

A theme picked on the phone that goes away (uninstalled, withdrawn, no longer offered) puts the
phone back on Studio, with one toast when it was on screen: "That theme isn't available any more,
so Automatos Go is back on Studio." Under Same as Studio, Studio switching to another style or
theme is an ordinary follow, with no toast; the toast shows only when Studio still names a theme
the phone can no longer paint, or `/active` reports it withdrawn (`A5:src/styles/themes/follow.ts`,
`themeGone`; `A5:src/styles/themes/plan.ts`). A read that fails keeps what the phone had: a
passing network fault never drops it to Studio.

## Installed themes (A5, gated on `mobile_theme`)

The picker lists installed themes in the Studio card, after Same as Studio, as "{name} · {version}",
sorted by name, only when the server's discovery lists `mobile_theme`
(`A5:src/styles/themes/installed.ts`). automatos-ai `main` lists it (#1295).

For each install that is not withdrawn and is not Play's or HUD's own web theme, the phone asks
`GET /api/themes/mobile/{install_id}`, at most 4 at a time and at most 100 installs per read. An
install is offered when its answer carries a `mobile` block the phone can paint. A 404 skips that
install; any other failure fails the whole read, so a network fault never reads as every theme
gone.

A theme paints **data only, never code** (D-NO-CODE): colour tokens for light and dark, up to three
font faces and the mascot's files. The phone never loads a theme's JS or CSS. The shape of the
answer is PLAY's contract,
[docs/theme-host/mobile.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/theme-host/mobile.md),
"The answer".

### Which files the phone downloads

`A5:src/styles/themes/file-url.ts` and `files.ts`:

- Only a relative URL under `/api/themes/files/<digest>/`, where `<digest>` is 64 lowercase hex.
  No scheme, no host, no `//`, no `..`, no query, no percent-escape.
- Only a font (`assets/fonts/mobile/<name>.ttf` or `.otf`) or a mascot file
  (`assets/mascot/<state>.mp4` or `.png`). Never `.js`, `.mjs`, `.css`, `.html` or `.htm`, whatever
  the server lists.
- Downloaded from the current API server with the client's own bearer and `X-Workspace-ID`.
- Size caps: fonts 400 KB, mascot files 2 MB each. A download lands in a partial folder and moves
  into place only under its cap; a larger one is deleted. A download that takes over 60 s is given
  up.
- Kept at `<cache>/theme-files/<digest>/<path>`. The digest names the bytes, so a copy already there
  is never fetched again. iOS may empty the cache; a missing copy is fetched on the next read.
- A failure is logged and the phone keeps Studio's fonts or the bundled Auto.

Known limit (security review, 24 Oct): expo-file-system's download has no byte cap or cancel, so
the size is checked once the file has arrived, and iOS follows a redirect with the request's
headers. Both need the configured server itself to misbehave.

## Looks (A5)

A look is one person's settings for Play or HUD. The phone keeps them in step with the web through
`GET` and `PUT /api/themes/looks/{theme_id}`, with `automatos/play` and `automatos/hud` as path
segments (`A5:src/styles/sync/look-themes.ts`, `A5:src/styles/play/looks-api.ts`).

- The server's copy wins, except for a part changed on the phone and not yet kept by the server,
  which is sent next. The first sync merges: the server's saved looks first, then each look only
  the phone has (`A5:src/styles/play/look-sync.ts`, `A5:src/styles/sync/look-sync-run.ts`).
- A `PUT` sends `{looks, active}`, both every time, one save at a time.
- The phone keeps looks per owner: server, workspace and person.
- Stored on the phone under `styles.play.looks` and `styles.hud.looks`, with sync marks under
  `styles.play.looks.sync` and `styles.hud.looks.sync`.
- If the theme is not installed in the workspace (404), the looks stay on the phone. Play's look
  page says "Kept on this phone only" and "Install Play in Studio to keep your looks in step with
  the web." HUD says nothing.

**Play's "Make it yours"** (`A5:src/styles/play/look-page/`): six controls (Accent, Background,
Type, Auto's shell, Auto's light · eyes + ring, Glow), the presets Ember, Obsidian, Aurora, Workshop
and Daylight (vendored from the web, `src/core/web/lib/looks/presets.ts`), **Save as new look**,
**Reset**, and a long press for Rename, Duplicate and Delete.

**HUD's Looks drawer** (`A5:src/styles/hud/LooksDrawer.tsx`, `drawer-model.ts`, `drawer/`). Today
it is reached through **Looks →**, the page `/settings/look/hud`
(`A5:src/styles/hud/drawer/HudLookPage.tsx`). The HUD core's LOOK button opens it over the core,
but `HudCore` is mounted in no `app/` screen yet (only in `A5:src/styles/edges/FirstOpen.tsx`); the
button reaches the app with US-016k. The drawer has the presets ARC, FORGE, GHOST, NOVA and SIGNAL
(`A5:src/styles/tokens/hud-catalogue.ts`) and the saved looks ("MINE 1", "MINE 2"), ACCENT,
BACKGROUND, TYPE, GRID (0–30), GLOW (up to the look's safe glow), SCAN / AUTO / MOTION, SAVE AS NEW
LOOK, RESET, and a long press on a saved look for Rename or Delete (Play's sheet and words, without
Duplicate).
Under Reduce Motion it says "MOTION OFF · REDUCE MOTION". Copy: `A5:src/styles/strings.ts`
`HUD_DRAWER_COPY`. HUD's HOLD TO TALK button is there but disabled until A6; VoiceOver's hint says
"Voice comes with the voice update" (`A5:src/styles/hud/core/model.ts`, `hudButtons`;
[voice.md](voice.md)).

## Auto the mascot (A5)

`A5:src/styles/mascot/media.ts` picks how Auto shows in each state:

| Case | What plays |
|---|---|
| iOS, motion on, no shell tint | The HEVC-alpha clip through expo-video |
| iOS, motion on, a tinted shell | The same clip through Skia under the shell's colour matrix |
| Android, Reduce Motion, or no clip | The state's still image (tinted if the shell is) |
| A theme that brings Auto | That theme's own files, untinted; a state not on the phone yet keeps the bundled Auto |
| A theme with mascot mode `none` | No mascot |

The ring around Auto is drawn by the app. VoiceOver hears "Auto, {what he is doing}".
`MASCOT_TINTED_CLIPS` is one constant: if a device shows a black box where Auto should be, it can be
turned off over the air.

## When the phone reads

`A5:src/styles/sync/StyleSync.tsx` mounts `ThemeSync` and `LookSync`. They read on mount and each
time the app comes back to the foreground. There are no timers and no polling
(`A5:src/styles/sync/foreground.ts`). One read runs at a time per server and workspace, and a read
that finishes after the session changed is dropped.

At `e4336ff` only the Style and look screen and both look pages (Play and HUD) mount `StyleSync`,
so their data is read when they open. From `48a7365` (US-016j) the signed-in shell also mounts it
once (`A5:src/styles/sync/ShellStyleSync.tsx`, handed in by `StyleSyncSlot` in `A5:app/_layout.tsx`),
and a per-process guard lets only one instance read (`A5:src/styles/sync/reader-guard.ts`).

## Routes

`A5:src/styles/routes.ts`, checked by `npm run check:routes`:

| Route | What the phone reads or writes |
|---|---|
| `GET /api/themes/installed` | The workspace's installs: name, version, revocation |
| `GET /api/themes/active` | What this member sees in Studio: `{choice, source, theme, revoked?}` |
| `GET /api/themes/mobile/{install_id}` | One install as phone data. Marked `pendingUpstream` until the core re-pin (it merged after `630fc1c85`) |
| `GET /api/themes/files/{digest}/{path}` | A font or mascot file the answer above names |
| `GET /api/themes/looks/{theme_id}` | This member's looks for Play or HUD |
| `PUT /api/themes/looks/{theme_id}` | Replaces them: `{looks, active}` |

A paired phone (self-hosted only) counts as a member of exactly the workspace it paired to
(automatos-ai `orchestrator/services/themes/membership.py`, `PERSON_AUTH_TYPES`). automatos-ai
#1297 tests it on `GET /api/themes/mobile/{install_id}`, the files that answer names,
`GET /api/themes/active`, `PUT /api/themes/choice` and `GET /api/themes/looks/{theme_id}`.
`GET /api/themes/installed` and the looks `PUT` sit behind the same `members:read` gate, so they
should work, but no test covers them yet.

The mobile answer requires membership of the install's workspace (automatos-ai
`orchestrator/services/themes/serve.py`, `boot_target`). Theme files do not always: the files of
an approved, reviewed Marketplace listing are served to any caller unless a `disable` revocation
covers it; any other package's files only through an active install in a workspace the caller
belongs to, and private code only after that member opted in (`serve.py`, `authorised_package`).

## Merge note

automatos-ai #1300 (W2, `feat/prd-266-w2-push`) merged on 24 Oct (`bd0e60b2b`). Its branch had
merged `main` first (`b34876498`), and `main`'s discovery `CAPABILITY_ROUTES` lists all five:
`digest`, `mobile_theme`, `push`, `spoken_mode` and `voice_live`.

## Related

- [architecture.md](architecture.md): the token rule (no colour literal outside
  `src/styles/tokens/`).
- automatos-ai [docs/theme-host/mobile.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/theme-host/mobile.md):
  the `mobile` block, the answer, what the phone may load and who may call.
- automatos-ai [docs/theme-host/](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/theme-host/_index.md): the theme host for engineers,
  with [api-reference.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/theme-host/api-reference.md) (the routes),
  [security-model.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/theme-host/security-model.md) (review, opt-in, revocations) and
  [operations.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/theme-host/operations.md).
- automatos-ai [docs/themes/](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/themes/_index.md): for people who install themes:
  [installing-and-choosing.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/themes/installing-and-choosing.md),
  [looks.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/themes/looks.md), [managing-themes.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/themes/managing-themes.md),
  [on-your-phone.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/themes/on-your-phone.md) and [faq.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/themes/faq.md); the
  Marketplace's Themes tab is [docs/community-marketplace/themes-tab.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/community-marketplace/themes-tab.md).
