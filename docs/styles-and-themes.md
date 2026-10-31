# Styles and themes (the phone's side)

How Automatos Go paints itself: four built-in styles (Studio, Play, HUD and Arcade), each with its
own layout, installed workspace themes, and "Same as Studio". Which theme gets which layout: under
Same as Studio, `automatos/play`, `automatos/hud` and `automatos/arcade` switch the phone to that
style's own layout; every other theme paints the Studio layout through its `mobile` skin. This page
covers the phone only. The theme package, the `mobile` block in `theme.json` and the server routes
are owned by the Themes docs in automatos-ai: see
[docs/theme-host/mobile.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/theme-host/mobile.md)
for the contract, and the Themes pages for people who install themes,
[docs/themes/](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/themes/_index.md) (the phone's page is
[on-your-phone.md](https://github.com/AutomatosAI/automatos-ai/blob/main/docs/themes/on-your-phone.md)). The Themes pages
merged in automatos-ai #1304, which also revised mobile.md (first merged in #1258).

State on 30 Oct 2026. Studio, Play and HUD are on `main` (A5, #14). Arcade is wave A8 (PRD-001
§4.6.1, US-022) on the branch `feat/a8-arcade`, not on `main` yet; the parts of this page about
Arcade describe that branch.

## Status

| Part | Status |
|---|---|
| Studio style, Light/Dark following the iPhone, the AI label | On `main` |
| Style registry, the flip, Studio's Light / Dark / System control, the Style and look screen (`/settings/style`) | On `main` (A5) |
| Same as Studio, installed themes with a `mobile` block | On `main` (A5) |
| Play: tokens, glow, the Companion home, Conversations, Shelf, "Make it yours" (`/settings/look/play`) | On `main` (A5) |
| HUD: tokens, grid, glow, the voice-first core as home, the Looks drawer (`/settings/look/hud`) | On `main` (A5) |
| Play and HUD looks kept in step with the web; `StyleSync` mounted once in the signed-in shell | On `main` (A5) |
| Auto the mascot (clips, stills, ring) | On `main` (A5) |
| The Command Centre, sheets, settings, the edge screens and the voice screen dressed per style | On `main` (A5, A6) |
| Arcade: the fourth style, its looks and Options (`/settings/look/arcade`), Press Start 2P and Pixelify Sans, Auto as a pixel sprite, the handheld home with its party, Quests and Inventory, the shared screens in its dress | Branch `feat/a8-arcade` (A8) |

The kits are `scripts/ralph/prd-001-styles.json` (A5) and `scripts/ralph/prd-001-arcade.json`
(A8); each story's `passes` is the truth.

The AI label stays the same in every style: one small muted caption, "Auto is an AI" (or "{agent}
is an AI"), at the top of each thread ([src/styles/ai-label.tsx](../src/styles/ai-label.tsx)). It
never blocks typing. In Arcade it is the story window's first row and scrolls away with it;
scanlines are never drawn over it.

## The four layouts

Every home talks to the same Auto over A2's one thread (`src/chat/controller`). The resolved
style's layout picks the home ([src/styles/homes/layout.ts](../src/styles/homes/layout.ts),
`homeFor`; [StyleHome.tsx](../src/styles/homes/StyleHome.tsx)):

| Layout | What it draws |
|---|---|
| **Studio** | A2's home as built: the brand header with the Command Centre button and avatar, the needs strip, the thread with its cards, the composer |
| **Play** | The Companion chat (Ember 01-02): the chat's title, "Shelf +N" and the needs line, Auto's row with his state, the thread, Play's message box; Conversations and the Shelf of Deliverables behind it |
| **HUD** | The voice-first core: the ring core with Auto and the state chip, the YOU / AUTO transcript, the waveform, TYPE · HOLD TO TALK · STOP, COMMAND and LOOK |
| **Arcade** | The handheld: the status bar (Auto's mark, the counters, the pause control), the party strip (your agents, each with its state word), and a screen the D-pad switches: ◀ Chat (the story window over the thread, then the dialogue window with Auto's portrait and his reply typing out), ▲ Quests (the overworld map, the Board's tickets as quests) and ▶ Inventory (the item grid with tabs, the Deliverables as items); ▼ Menu opens the header menu; hold to talk in the round surround |

An installed theme paints the Studio layout, so it has Studio's home. The Command Centre, sheets,
settings, the edge screens (First open, Not running, Something went wrong, Lost) and the voice
screen are one set of screens in every style, each dressed by the style
(`src/styles/dress/`, `src/styles/edges/`, `src/voice/screen/dress.ts`).

**Arcade's handheld** ([src/styles/homes/ArcadeHome.tsx](../src/styles/homes/ArcadeHome.tsx), the
parts in `src/styles/arcade/parts/`, the screens in `src/styles/arcade/home/`). It shows only data
the app already reads; there is no new endpoint (D-ARC-6). The counters: **!** is the needs-you
number (`useNeedsYou`), **QUEST** the Board's work in progress; XP is left out while the Board's
rows carry no completion time. The party is the chat's agents (`GET /api/chat/agents`). Quests
draws the Board's tickets on the design kit's map, with a link to the full Board; Inventory the
Deliverables gallery, with a link to all of them. TYPE in the dialogue window opens A2's composer
in a sheet; hold to talk is A6's quick-ask. Auto is the design kit's 32 × 32 pixel sprite, drawn
with Skia from vendored source (`src/styles/arcade/sprite/`), never the bundled clips: twelve
states on a 60 ms clock. Reduce Motion, or the pause control, stills every loop (the sprite on
frame 1, the ▶ / ▼ cursors, the typewriter, the voice screen's rings and waveform) and says so in
words. The control (PAUSE / PLAY; none under Reduce Motion) sits wherever Arcade loops: at the
end of the home's status bar, under the voice screen's top bar in Arcade, at the top of each edge
screen's window (First open, Not running, Something went wrong, Lost) and beside the way back on
Options. Every copy sets the one stored value, so one tap stills Arcade everywhere. The picker's
Arcade card draws none and moves nothing.

**PRD-268 on the handheld** (D-ARC-7). Arcade has PRD-268's phone features on the same hooks
and data as the other layouts; a feature with a capability shows only where discovery lists it:

- **The day's brief** (US-G06, `brief`). The thread keeps a message's brief as Play's thread does
  (`threadRows(state, { briefs })`). The dialogue window says the reply the story leaves out
  (`sayingRowKey`'s row, `arcade-home.ts` `sayingOf`). When that reply is the brief, the dialogue
  says its greeting and Auto's Read as plain words, typed at the look's text speed when it lands
  while the chat is on screen, else whole. OPEN BRIEF sits beside TYPE, and Report this stays on
  it. A brief further up the story is its own window: '★ TODAY'S BRIEF' (or the brief's date when
  it is another day's), its greeting and OPEN BRIEF, never its markdown (`arcade-story.ts`
  `storyBrief`). OPEN BRIEF opens the brief's own view (`BriefCard.tsx` `BriefBody`) inside an
  Arcade window in the foundation's Sheet (`src/styles/arcade/home/ArcadeBrief.tsx`).
- **Auto's suggestions** (US-G01, `suggestions`). 'IDEAS · N' under the status bar opens the sheet
  of them all (`useIdeas`). Under it the NEXT line ('▶ NEXT', the newest open suggestion's title,
  START and HIDE) is HUD's NEXT ▸ in Arcade's dress. It says 'Started. Auto is on it.' for 4 s
  after a Start (`src/styles/arcade/home/ArcadeNext.tsx`, `next.ts`).
- **The thread's suggestion card** (§6.5.1, `suggestions`). The story asks for suggestion rows as
  Studio's and Play's threads do (`threadRows(state, { briefs, suggestions })`). A suggestion Auto
  posted is the foundation's card (`src/suggestions/ThreadSuggestion.tsx`) in an Arcade window while
  it is open, 'Started. Auto is on it.' there after a Start from it, else its AUTO line
  (`arcade-story.ts` `suggestionEntry`). The newest open suggestion is on the NEXT line, so its post
  draws as words: only one place offers START. To the dialogue the post is one of Auto's replies
  (`autoRowOf`). When it is the newest after the person's last message, the dialogue says its words
  as a normal reply, with Report this, and the story keeps only the card.
- **Opening at a message** (US-G03). ArcadeHome takes the chat route's `focus` param and the brief
  on open's request through `useThreadFocus`, as Studio's and Play's threads do. The story window is
  a ScrollView inside the handheld's own ScrollView (a FlatList there would nest one list in
  another). So it records each entry's top as it is laid out and scrolls there once, not animated,
  by `src/chat/focus.ts`'s rules (`src/styles/arcade/home/story-focus.ts`, `use-story-focus.ts`).
  A focus on the reply the dialogue says settles at once, without a scroll: the dialogue shows it.
  The focus waits while Quests or Inventory is on the handheld's screen.
- **The approval sheet** (US-G08). A card waiting with an ApprovalView opens its answer sheet by
  itself, once. If the sheet is closed unanswered, '◆ WAITING FOR YOU · OPEN' under the dialogue
  window opens it again (`src/approvals/use-hud-approval.tsx`, as HUD mounts it under its chip).

When two of Auto's messages follow the person's last one, the dialogue says the newer and the story
keeps the first (`hud-turn.ts` `sayingTurn`; HUD's own transcript still says the first).

**Status colours on Arcade** (PRD-268 §6.12.2, D-ARC-7). Arcade draws HUD's glyph and WORD
(`src/styles/dress/status-glyphs.ts`) but paints each glyph in its state's role token, never in
the accent. The dress's `glyphPaint` is `'state-role'`, through `src/ui/state-tokens.ts`
`glyphToken`. HUD keeps its own glyph roles (`'glyph-role'`), and Studio and Play keep their dots.

- A status outside the vocabulary reads as its glyph's state: in progress and live as working,
  review and blocked as needs you, inbox and closed as not checked.
- Arcade's role tokens (`src/styles/tokens/arcade.ts` `ARCADE_ROLES`) follow the status bar's
  colours:

  | State | Role | Arcade colour |
  |---|---|---|
  | Needs you | warning | `qs`, the ! counter's quest yellow |
  | Working | running | `mp`, QUEST's mana blue |
  | Ready, done | success | `tx`, the plain text: the ✓ and the word carry them |
  | Failed | destructive | `hp`, HP red |
  | Needs setup, not checked | info, muted | `tx2`, the secondary text: the glyph and the word carry them |

- The success text tone (olive) is the plain text too, and the live dot is mana blue.
- This holds wherever Arcade paints a status:
  - the Command Centre (StatusPip, StateMark, LIVE);
  - the brief's rows and the readiness list;
  - the party strip (WORKING ● in mana blue);
  - the Quests map (an active quest in mana blue).
- `src/styles/tokens/__tests__/arcade-status.test.ts` checks every palette:
  - each status reads at AA on the window and the page;
  - none of them is the accent;
  - needs you, working, done and failed are at least ΔE 30 apart (CIE76 in CIELAB);
  - every other status is at least ΔE 20 from needs you.

## The four styles in the picker

| Style | Picker line | Look page |
|---|---|---|
| **Studio** | "Cream paper or Studio Dark", with Light / Dark / System on its card | none: the scheme is the look |
| **Play** | "Auto and the Ember look" | **Make it yours →** (`/settings/look/play`) |
| **HUD** | "Voice first, glow and grid" | **Looks →** (`/settings/look/hud`) |
| **Arcade** | "Your agents as a party, Auto in the dialogue box" | **Options →** (`/settings/look/arcade`) |

Copy: [src/styles/strings.ts](../src/styles/strings.ts). Screens: `app/(app)/settings/style.tsx`
and `app/(app)/settings/look/{play,hud,arcade}.tsx`; paths in
[src/styles/nav.ts](../src/styles/nav.ts). The registry
([src/styles/registry/registry.ts](../src/styles/registry/registry.ts)) gives each style its look
page and whether the bundled Auto shows: Studio and Arcade never, Play always, HUD when the look
turns him on.

**The flip** ([src/styles/provider/flip.ts](../src/styles/provider/flip.ts)). Tapping a card
stores the choice on the phone, plays one haptic tick and crossfades the whole app over 180 ms (at
once under Reduce Motion). Entering Play also counts one "hello" from Auto. Picking the choice
already stored does nothing.

**What the phone stores** ([src/styles/registry/choice.ts](../src/styles/registry/choice.ts),
`choice-store.ts`). A small versioned JSON value under `styles.choice` in the encrypted MMKV store:
`{v: 1, kind: 'builtin', id}` or `{v: 1, kind: 'theme', installId}`, or `{v: 1, kind: 'follow'}`.
**Nothing stored means "Same as Studio"**, the default since 24 Oct. A value the parser cannot
read, or a style this build does not have, is Studio, never a crash.

## Same as Studio

The first row in the Studio card, just below its Light / Dark / System control
(`src/styles/picker/StyleCard.tsx`, `CardControls`): "Same as Studio · Now {style}". While it
is chosen, the phone paints what Studio shows this member, from `GET /api/themes/active`
(`src/styles/themes/follow.ts`):

| Theme active in Studio | What the phone paints |
|---|---|
| `automatos/play` | Play, the phone's built-in style |
| `automatos/hud` | HUD, the phone's built-in style |
| `automatos/arcade` | Arcade, the phone's built-in style (A8; a build from before Arcade: see below) |
| Any other theme whose install has a `mobile` block the phone can paint | The Studio layout in that theme's colours, fonts and mascot |
| `studio` / `classic`, no theme, a theme revoked with `disable` (`revoked` on `/active`'s answer, or `theme.revoked.level` `disable`), or no `mobile` block | Studio |

Only a `disable` revocation sends the phone to Studio (`src/styles/themes/follow.ts`,
`followStudio`). A `warn` revocation still paints, as it still runs on the web (automatos-ai
`orchestrator/services/themes/revocations.py`).

`/active`'s theme is the member's own choice in Studio, else the workspace default (automatos-ai
`orchestrator/services/themes/defaults.py`, `resolve_active`), not whatever is installed. The phone
follows it only while it is on Same as Studio (`src/styles/registry/style-id.ts`,
`paintedChoice`). So choosing Play, HUD or Arcade in Studio, or making it the workspace default,
switches the phone to that built-in style: its layout and home, tokens, dress, type, ground and
Auto. Any other theme repaints Studio. Play then paints the member's Play look, HUD the member's
HUD look and Arcade the member's Arcade look (see "Looks").

**A build from before Arcade.** The theme ids that are a built-in style are one map,
`BUILT_IN_THEME_STYLES` in [src/styles/themes/follow.ts](../src/styles/themes/follow.ts); A8 adds
`'automatos/arcade': 'arcade'` (D-ARC-1). A build without that entry (anything from `main` before
A8 merges, TestFlight builds included) treats `automatos/arcade` as any other theme: under Same as
Studio it paints `automatos/arcade`'s `mobile` skin on the Studio layout (D-ARC-2; the kit's
`theme.json` at `034fa629c`: colours from its looks, Press Start 2P and Pixelify Sans as its two
faces, the mascot as stills), and the picker lists it under Studio as "{name} · {version}". It never
draws the handheld: that layout is app code, and a theme brings data only.

A theme picked on the phone that goes away (uninstalled, withdrawn, no longer offered) puts the
phone back on Studio, with one toast when it was on screen: "That theme isn't available any more,
so Automatos Go is back on Studio." Under Same as Studio, Studio switching to another style or
theme is an ordinary follow, with no toast; the toast shows only when Studio still names a theme
the phone can no longer paint, or `/active` reports it withdrawn (`src/styles/themes/follow.ts`,
`themeGone`; `src/styles/themes/plan.ts`). A read that fails keeps what the phone had: a
passing network fault never drops it to Studio.

## Installed themes (gated on `mobile_theme`)

The picker lists installed themes in the Studio card, after Same as Studio, as "{name} · {version}",
sorted by name, only when the server's discovery lists `mobile_theme`
(`src/styles/themes/installed.ts`). automatos-ai `main` lists it (#1295).

For each install that is not withdrawn and is not a built-in style's own web theme (Play's, HUD's
or, from A8, Arcade's: `builtInStyleOf` in `follow.ts`), the phone asks
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

`src/styles/themes/file-url.ts` and `files.ts`:

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

## Looks

A look is one person's settings for Play, HUD or Arcade. The phone keeps them in step with the web
through `GET` and `PUT /api/themes/looks/{theme_id}`, with `automatos/play`, `automatos/hud` and
(A8) `automatos/arcade` as path segments (`src/styles/sync/look-themes.ts`, `src/styles/play/looks-api.ts`).

- The server's copy wins, except for a part changed on the phone and not yet kept by the server,
  which is sent next. The first sync merges: the server's saved looks first, then each look only
  the phone has (`src/styles/play/look-sync.ts`, `src/styles/sync/look-sync-run.ts`).
- A `PUT` sends `{looks, active}`, both every time, one save at a time.
- The phone keeps looks per owner: server, workspace and person.
- Stored on the phone under `styles.play.looks`, `styles.hud.looks` and `styles.arcade.looks`,
  with sync marks under `styles.play.looks.sync`, `styles.hud.looks.sync` and
  `styles.arcade.looks.sync`. Arcade's pause is the phone's alone, under
  `styles.arcade.motionPaused`, and never synced.
- If the theme is not installed in the workspace (404), the looks stay on the phone. Play's look
  page says "Kept on this phone only" and "Install Play in Studio to keep your looks in step with
  the web."; Arcade's Options says "Kept on this phone only" and "Arcade isn't installed in this
  workspace, so your looks stay on this phone." HUD says nothing.

**Play's "Make it yours"** (`src/styles/play/look-page/`): six controls (Accent, Background,
Type, Auto's shell, Auto's light · eyes + ring, Glow), the presets Ember, Obsidian, Aurora, Workshop
and Daylight (the web's, frozen in `src/core/frozen/lib/looks/presets.ts`), **Save as new look**,
**Reset**, and a long press for Rename, Duplicate and Delete.

**HUD's Looks drawer** (`src/styles/hud/LooksDrawer.tsx`, `drawer-model.ts`, `drawer/`). It is
reached through **Looks →**, the page `/settings/look/hud` (`src/styles/hud/drawer/HudLookPage.tsx`),
and from the LOOK button on HUD's home, the core (`HudHome.tsx`). The drawer has the presets ARC, FORGE, GHOST, NOVA and SIGNAL
(`src/styles/tokens/hud-catalogue.ts`) and the saved looks ("MINE 1", "MINE 2"), ACCENT,
BACKGROUND, TYPE, GRID (0–30), GLOW (up to the look's safe glow), SCAN / AUTO / MOTION, SAVE AS NEW
LOOK, RESET, and a long press on a saved look for Rename or Delete (Play's sheet and words, without
Duplicate).
Under Reduce Motion it says "MOTION OFF · REDUCE MOTION". Copy: `src/styles/strings.ts`
`HUD_DRAWER_COPY`. HUD's HOLD TO TALK is A6's quick-ask on the core
(`src/styles/hud/core/model.ts`, `voiceButtons`; [voice.md](voice.md)).

**Arcade's Options** (A8, `src/styles/arcade/look-page/`): the design kit's five knobs as rows with
a ▶ beside the choice (Palette: Overworld, Dungeon, Neon Cabinet, Night City, Handheld; Scanlines;
Pixel scale 2× or 3×; Window: Classic double or Thin; Text speed), a live preview, **Save look**,
**Reset** (the palette's preset as it ships), and the save slots, one preset per palette and the
saved looks, with a long press for Rename or Delete. The schema, presets and rules are vendored
from the design kit's `themes/arcade` at `034fa629c` (`src/styles/arcade/look-schema.ts`,
`src/styles/tokens/arcade-catalogue.ts`), with each source's sha256 in the file's header.

## Auto the mascot

`src/styles/mascot/media.ts` picks how Auto shows in each state:

| Case | What plays |
|---|---|
| iOS, motion on, no shell tint | The HEVC-alpha clip through expo-video |
| iOS, motion on, a tinted shell | The same clip through Skia under the shell's colour matrix |
| Android, Reduce Motion, or no clip | The state's still image (tinted if the shell is) |
| A theme that brings Auto | That theme's own files, untinted; a state not on the phone yet keeps the bundled Auto |
| A theme with mascot mode `none` | No mascot |

Arcade never shows the bundled clips (the registry's `'never'`): Auto there is the pixel sprite
(see "The four layouts").

The ring around Auto is drawn by the app. VoiceOver hears "Auto, {what he is doing}".
`MASCOT_TINTED_CLIPS` is one constant: if a device shows a black box where Auto should be, it can be
turned off over the air.

## When the phone reads

`src/styles/sync/StyleSync.tsx` mounts `ThemeSync` and `LookSync`. They read on mount and each
time the app comes back to the foreground. There are no timers and no polling
(`src/styles/sync/foreground.ts`). One read runs at a time per server and workspace, and a read
that finishes after the session changed is dropped.

The Style and look screen and the look pages (Play, HUD and Arcade) mount `StyleSync`, so their
data is read when they open, and the signed-in shell mounts it once (`src/styles/sync/ShellStyleSync.tsx`, handed in by `StyleSyncSlot` in `app/_layout.tsx`),
and a per-process guard lets only one instance read (`src/styles/sync/reader-guard.ts`).

## Routes

`src/styles/routes.ts`, checked by `npm run check:routes`:

| Route | What the phone reads or writes |
|---|---|
| `GET /api/themes/installed` | The workspace's installs: name, version, revocation |
| `GET /api/themes/active` | What this member sees in Studio: `{choice, source, theme, revoked?}` |
| `GET /api/themes/mobile/{install_id}` | One install as phone data (on the server since the re-pin to `8c9361687`) |
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
