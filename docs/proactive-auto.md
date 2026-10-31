# Proactive Auto on the phone (PRD-268)

For engineers. How the app draws the daily brief, suggestions, the approval sheet, readiness and the
status vocabulary that automatos-ai's PRD-268 adds. The server side is automatos-ai's
`docs/PRDS/PRD-268-PROACTIVE-AUTO.md` (§6.11 data shapes, §6.12 surfaces). The people-facing
description is [user/proactive-auto.md](user/proactive-auto.md).

State: everything here is on `main`. The first batch (status words, brief, suggestions, approval
sheet, readiness, Arcade's slots, the core re-pin) came in through #30 to #38; Listen, the thumbs,
Start on a brief row, opening the thread at the brief, the thread's suggestion card and the approval
sheet from a push came in through #39. Where the code and this page differ, the code is right.

## Rules that hold across the feature

- **Gated by capability, not version.** Each surface is built only when discovery lists its
  capability. Without it the code path is not mounted and no request is sent.
- **The server computes, the app draws.** States, next steps, row copy and brief text are the
  server's, in the person's language (`Accept-Language`, `src/api/accept-language.ts`). The app owns
  the frames around them, in one `strings.ts` per module.
- **Unknown values degrade, never crash.** A row, fix or state the app cannot read is dropped (or
  drawn as "not checked"); the rest still draws.
- **No cost language** anywhere in these modules.
- **Face ID** guards the calls that start work: `start_suggestion`, `retry` and the tool approval's
  Approve & run (`src/step-up/policy.ts`). Hide, Deny and Reject are never guarded.
- **Colour is a role and never the only signal:** every state is a glyph plus a word.

## Capability gates

Gates are the functions in [src/api/capabilities.ts](../src/api/capabilities.ts); the names are
listed in [src/api/discovery.ts](../src/api/discovery.ts).

| Capability | Gate | Turns on |
|---|---|---|
| `brief` | `canBrief` | The brief-on-open call (`BriefOnOpen`), the `brief@1` card in threads (`threadRows` option `briefs`), HUD's and Arcade's brief sheets |
| `suggestions` | `canSuggestions` | The open-suggestions query, pinned card, header count, sheet, HUD and Arcade lines, the thread card (`threadRows` option `suggestions`), the Board's From suggestions filter |
| `readiness` | `canReadiness` | Settings → What Auto depends on |
| `approval_view` | `canApprovalView` | The approval sheet opened from a push tap (also needs `roleCan(role, 'approve')`) |
| `tts` | `canServerVoice` | Auto's server voice for Listen (otherwise the phone's voice) |

Row status (`display_state`, `next_step`, `retry`) has no capability. The fields are optional in the
row schemas ([src/api/row-status.ts](../src/api/row-status.ts)); an older server omits them and the
row draws as before. The approval sheet is also reachable without `approval_view`: a thread card
opens it when the card itself carries an `approval_view` part
([src/chat/cards/ToolApprovalCard.tsx](../src/chat/cards/ToolApprovalCard.tsx) `answersInSheet`).

## Routes used

Each module keeps its table beside the code; `npm run check:routes` reads every `src/**/routes.ts`
(not `src/navigation/`) against the pinned route manifest.

| Module | Table | Route |
|---|---|---|
| Brief | [src/brief/routes.ts](../src/brief/routes.ts) `BRIEF_ROUTES.open` | `POST /api/proactive/brief/open` `{local_date, timezone}` |
| Brief | `BRIEF_ROUTES.feedback` | `POST /api/activity/digest/feedback` `{state_hash, rating: 1 or -1}` |
| Brief | (chat's own, [src/chat/routes.ts](../src/chat/routes.ts)) | `GET /api/chat/{chat_id}/messages` returns the `brief@1` part |
| Suggestions | [src/suggestions/routes.ts](../src/suggestions/routes.ts) `SUGGESTION_ROUTES.list` | `GET /api/proactive/suggestions?status=open` |
| Suggestions | `.start` | `POST /api/proactive/suggestions/{suggestion_id}/start` |
| Suggestions | `.hide` | `POST /api/proactive/suggestions/{suggestion_id}/hide` `{reason?}` |
| Readiness | [src/readiness/routes.ts](../src/readiness/routes.ts) `READINESS_ROUTES.current` | `GET /api/readiness` |
| Readiness | `.check` | `POST /api/readiness/check` (429 `checked_recently` when too soon) |
| Approvals | [src/approvals/routes.ts](../src/approvals/routes.ts) `APPROVAL_ROUTES.view` | `GET /api/v1/approval-grants/{grant_id}/view` |
| Status retry | [src/cc/status/row-status.ts](../src/cc/status/row-status.ts) `RETRY_ROUTES` | Mission resume, Mission replan, Board run-now, from `CC_ROUTES` ([src/cc/routes.ts](../src/cc/routes.ts)) |

The approval's answers (grant and deny) are the cards' own routes in `src/chat/routes.ts`. The live
event stream's `suggestion_changed` event refetches the `suggestions` key family
([src/api/live-events.ts](../src/api/live-events.ts) `LIVE_INVALIDATIONS`); the open list also
refetches on an interval (`useOpenSuggestions`).

## Modules and files

| Module | Files | What it does |
|---|---|---|
| `src/brief/` | `schema.ts`, `model.ts`, `api.ts`, `on-open.ts`, `BriefOnOpen.tsx`, `BriefCard.tsx`, `BriefFooter.tsx`, `listen.ts`, `use-brief-listen.ts`, `feedback.ts`, `use-brief-feedback.ts`, `use-brief-view.ts`, `on-screen.tsx`, `HudBrief.tsx`, `use-hud-brief.tsx`, `motion.ts`, `strings.ts` | `Brief@1` parsing; the card's view model; once-a-day open; Listen; thumbs; HUD's sheet |
| `src/suggestions/` | `schema.ts`, `model.ts`, `api.ts`, `cache.ts`, `gated.ts`, `use-suggestions.ts`, `use-ideas.tsx`, `PinnedSuggestion.tsx`, `SuggestionCard.tsx`, `SuggestionsSheet.tsx`, `ThreadSuggestion.tsx`, `HudNext.tsx`, `reason-menu.ts`, `strings.ts` | The open list, Start and Hide, every layout's card, count and sheet |
| `src/approvals/` | `ApprovalSheet.tsx`, `sheet-view.ts`, `PushApprovalSheet.tsx`, `push-sheet.ts`, `use-hud-approval.tsx`, `waiting.ts`, `api.ts`, `strings.ts` | `ApprovalView@1` as a sheet; the push-opened sheet; HUD's |
| `src/readiness/` | `schema.ts`, `view-model.ts`, `use-readiness.ts`, `client-facts.ts`, `client-rows.ts`, `client-ports.ts`, `ReadinessSection.tsx`, `query-keys.ts`, `strings.ts` | Server items plus this phone's rows |
| `src/cc/status/` | `row-status.ts`, `StatusLine.tsx`, `gated.ts`, `use-retry.ts`, `api.ts` | A row's state, next step and Try again |
| `src/styles/dress/status-glyphs.ts` | | Glyphs, words and roles; `glyphPaint` types |
| `src/ui/state-tokens.ts` | | State → colour token |
| `src/chat/` | `focus.ts`, `use-thread-focus.ts`, `components/use-focus-scroll.ts`, `suggestion-row.ts`, `view-model.ts` | Thread rows, opening a thread at a message |
| `src/push/` | `PushRoot.tsx`, `inbound/intent.ts`, `inbound/handler.ts`, `wiring.ts` | Push tap → approval sheet |
| `src/styles/homes/`, `src/styles/arcade/home/`, `src/styles/candy/home/` | `PlayHome.tsx`, `HudHome.tsx`, `ArcadeHome.tsx`, `CandyHome.tsx`; `ArcadeBrief.tsx`, `ArcadeNext.tsx`; `ChatEntry.tsx`, `today.ts` | Per-layout placement |

## Status vocabulary

`display_state` is one of `needs_you`, `working`, `ready`, `done`, `failed`
(`DISPLAY_STATES`, `src/api/row-status.ts`). Readiness adds `needs_setup` and `not_checked`. Together
they are `StatusState` in [src/styles/dress/status-glyphs.ts](../src/styles/dress/status-glyphs.ts).

| Glyph | Role of the glyph | States and statuses |
|---|---|---|
| ◆ | person must act | `needs_you`, `needs_setup`, review, blocked |
| ● | in motion | `working`, in progress, live |
| ✓ | finished or fine | `done`, `ready`, approved |
| ○ | waiting or not known | `not_checked`, inbox, assigned, queued |
| ✕ | failed | `failed`, error |
| — | stopped; also any status this version does not know | cancelled, closed, paused, idle, offline |

(`▸`, a running step, is a seventh glyph used only by HUD's panels.) `ready` is the one status whose
role differs from its glyph's: ✓ in the accent on HUD, because it asks to be looked at.

**Words.** Studio, installed themes and Play say `STATE_WORDS` (`src/styles/strings.ts`): "Needs
you", "Working", "Ready to look at", "Done", "Couldn't finish", "Needs setup", "Not checked". HUD,
Arcade and Candy (`dress.status === 'glyph'`) say `statusGlyph(state).word`, HUD's shorter words.

**Colour: role → token.** Chosen in `stateMark` ([src/cc/status/row-status.ts](../src/cc/status/row-status.ts))
by `dress.status` and `dress.glyphPaint` ([src/styles/dress/dress.ts](../src/styles/dress/dress.ts)):

| State | Studio, Play (`statePaint`, `STATE_TOKENS`) | HUD (`glyph-role`, `GLYPH_ROLE_TOKENS`) |
|---|---|---|
| `needs_you` | `warning` (light ground: `warnInk`); word `warnInk` | accent → `primary` |
| `working` | `running` (light ground: `mutedForeground`) | accent → `primary` |
| `ready`, `done` | `success` | `ready`: `primary`; `done`: `mutedForeground` |
| `failed` | `destructive` | error → `destructive` |
| `needs_setup` | `info` | accent → `primary` |
| `not_checked` | `mutedForeground` | `mutedForeground` |

Arcade and Candy set `glyphPaint: 'state-role'`: they draw HUD's glyph and word but paint the glyph
with `glyphToken(status, 'state-role')`, which is `STATE_TOKENS[glyphState(status)]`. `glyphState`
maps a status outside the vocabulary to its glyph's state (in progress → working, review → needs
you, closed → not checked), so no status on those layouts is painted in the accent. Words in all
layouts use `mutedForeground` except Needs you's.

## The brief

- **Parsing** ([schema.ts](../src/brief/schema.ts)). A `brief@1` part of an Auto message. Sections:
  `needs_you`, `suggestions`, `today`, `since`, `unchecked`. A row has `opens` (`ticket`, `mission`,
  `question`, `chat`, `deliverable`, `suggestion`, `settings`) and `action` (`start`, `answer`,
  `open`, `connect`, `hide`). A row that does not parse is dropped; an unknown `opens` or `action`
  is dropped from the row and the row stays without an action. A brief of another version does not
  parse and the text part shows as before.
- **View model** ([model.ts](../src/brief/model.ts)). `briefView(brief, {needsYou, webUrl})` returns
  the date label, greeting, prose and sections with `shown` and `folded` rows (`foldRows`: fold at
  5, never at 6). The needs-you count is the Needs strip's total (`useStripTotal`) so card, strip and
  badge agree. `briefTarget` maps `opens` to an app route or a Studio link; a suggestion row has no
  link and instead carries `start` (`briefStartOf`), a `SuggestionView` that goes through the
  suggestions' Start. HUD numbers `needs_you` then `suggestions` rows.
- **On open** ([on-open.ts](../src/brief/on-open.ts), [BriefOnOpen.tsx](../src/brief/BriefOnOpen.tsx)).
  On each foreground return, once per local date per workspace (memory only), `POST …/brief/open`.
  A returned message settles the day; `pending` or a retryable failure leaves it for the next
  foreground; 403, 404 and 422 settle it too. On an answer the history and that chat are refetched,
  then `briefOpenStep` decides: `focus` (a thread already shows that chat and scrolls itself),
  `open` (home with a thread, Studio or Play: `routes.chatAt(chatId, messageId)`), or `none`.
- **Listen** ([listen.ts](../src/brief/listen.ts), [use-brief-listen.ts](../src/brief/use-brief-listen.ts)).
  Text is `brief.spoken`, else `toSpeakable(prose)`. It is split into sentences packed up to
  `BRIEF_PIECE_CHARS` (200) and queued on the one voice-out. Server voice when speech carries one,
  the phone's voice for the rest once the server refuses. It never plays until pressed; the reader
  holds the voice's single listener only while reading.
- **Thumbs** ([feedback.ts](../src/brief/feedback.ts)). `feedbackOffered` needs a non-empty
  `state_hash` and `roleCan(role, 'chat')`. The choice is kept per `state_hash` in memory so a
  layout's sheet and the thread's card agree; a failure restores the last choice.

### View models per layout

| Layout | Brief | Suggestions | Header count |
|---|---|---|---|
| Studio | `StudioBriefCard` in Auto's box (`AutoMessage`); `NeedsStrip` shrinks via `useBriefOnScreen` | `PinnedSuggestion` above the composer | `HomeHeader` via `useIdeas` |
| Play | `PlayBriefCard` in `PlayThread` | `PinnedSuggestion` in `PlayHome` | Play's header via `useIdeas` |
| Candy | `BriefBody` + `BriefEntrance` in `ChatEntry` | `PinnedSuggestion` above the Chat view's box (`CandyHome`) | `ideasPill` in `TodayView`'s header |
| HUD | `useHudBrief`: `HudBriefSlot` in the transcript slot, `HudBriefSheet` from OPEN BRIEF | `HudNext` | `hudIdeas` in the command row |
| Arcade | dialogue words + `useArcadeBriefSheet` (OPEN BRIEF); a brief in the story is its own window | `ArcadeNext` (`arcadeNext` in `next.ts`) | `ideasChip` |

`BriefBody` is the shared body (sections, rows, `BriefFooter` with Listen and thumbs).

## Suggestions

- `useOpenSuggestions` runs the list query only when `canSuggestions`; `openSuggestions` filters to
  open and unexpired, newest first. `pinnedSuggestionId` is the first. `pinnedForm(keyboardHeight)`
  gives `'line'` while the keyboard is up.
- `useSuggestionActions` has `start`, `hide`, `busyId`, `started` (4 s, `STARTED_FOR_MS`) and
  `refusal`. Start runs through `startGated` → `guard('start_suggestion', …)`; after success it
  refetches the `suggestions`, `board` and `needsYou` families. Hide asks `reason-menu.ts`
  (`not_now`, `not_useful`, `wrong_agent`) and removes the row at once (`withoutSuggestion`).
  `startRefusal` maps API codes to the app's own lines.
- **Board filter.** `board.ts` adds `FROM_SUGGESTIONS` when suggestions are offered; it keeps
  tickets with `source_type` `'suggestion'`.

### `threadRows` kinds and the focus props

`threadRows(state, {briefs, suggestions})` ([src/chat/view-model.ts](../src/chat/view-model.ts)):

- `briefs` on: an Auto row for a message with a `brief@1` part carries `brief: Brief`; the layout
  draws the card instead of the words.
- `suggestions` on: an Auto message with a `suggestion@1` part becomes a `{type: 'suggestion', key,
  messageId, suggestionId, text}` row ([suggestion-row.ts](../src/chat/suggestion-row.ts)). The
  layout draws `ThreadSuggestion`, which asks `threadSuggestionShown(open, id, startedId)`: `card`
  while the open list has it and it is not the pinned one, `started` for 4 s after a Start from it,
  `text` otherwise.
- Both options off gives the rows as before.

**Focus.** `MessageList` (Studio) and `PlayThread` take `focusMessageId` and `onFocused`. They call
`useFocusScroll`, which scrolls once to the row whose `key` is the message id (`focusIndex`,
`shouldFocus`, retried `FOCUS_RETRIES` times as rows lay out). `useThreadFocus(chatId, routeFocus)`
returns `{focus, settle}`: the store's pending request for that chat, else the route's `focus`
param (`focusFromChatParams`). `threadFocus` (in [focus.ts](../src/chat/focus.ts)) records which chats
a thread view shows so the brief on open can ask a visible thread to scroll instead of opening
another. `ChatScreen` takes `focusMessageId`.

## Approvals

- `ApprovalSheet` draws `ApprovalView@1` from `approvalSheetView`: asked-by, title, target, preview
  (text, selectable), previewLabel by verb, rule, waiting line (minutes left, `minutesLeft`),
  `expired`, `allow`/`refuse` words, `alwaysAllow` only when `answers` holds it. Allow is dropped
  once expired.
- Cards open it when `answersInSheet(card, canAct)`: the card has a `view`, is undecided, and the
  role may act. Approve & run is `grantToolGated` (Face ID); Deny is never guarded.
- HUD: `use-hud-approval.tsx` opens the sheet for `waitingSheetCard(rows)`, the newest tool or plan
  card waiting with a view.
- **Push.** See the next section.

## How push taps route

1. `inbound/intent.ts` decides from a signed payload: an unverified payload is `neutral`; a verified
   `open` or default tap on a push whose `link_type` is `approval_grant` carries `grantId`.
   Nothing is acted on in another workspace.
2. `inbound/handler.ts` opens the destination the tap opened before, then, if
   `intent.grantId` is set and the resolution did not carry a notice (a decided approval), calls
   `deps.approvals.open(grantId)` where `deps.approvals.offered()` is true. Failures are logged and
   swallowed.
3. `PushRoot.tsx` supplies that port: `offered` is `canApprovalView(discovery) &&
   roleCan(role, 'approve')`, read when the tap lands; `open` is `pushApprovals.open`
   ([push-sheet.ts](../src/approvals/push-sheet.ts)), a memory-only store of one grant at a time.
4. `PushApprovalSheet`, mounted by `PushRoot` over whatever screen the tap opened, fetches
   `fetchApprovalView` and shows the sheet. A view that cannot be read (404 decided or lapsed,
   refused, offline) closes with one line (`viewFailureLine`). Success refetches needs-you, questions
   and chats.

## Readiness

`useReadiness` reads `GET /api/readiness` only when `canReadiness`; `Check again` posts
`/api/readiness/check`. `view-model.ts` merges the server's items (first of a repeated id wins) with
the phone's rows from `client-rows.ts` (push, microphone, speech recognition, server voice) and lets
the phone's row replace a server row with the same id. A fix is followed only to an app screen
(`appRouteForWebLink`); `isAppPath` rejects other hosts in the schema. Marks use `readinessMark`
with `dress.status` and `dress.glyphPaint`, the same split as the status vocabulary. The readiness
query keys are not persisted, so each launch reads fresh. Mounted at
`app/(app)/settings/index.tsx`.

## Tests that pin each

| Behaviour | Tests |
|---|---|
| Glyphs, words, roles | `src/styles/dress/__tests__/status-glyphs.test.ts`, `glyph-paint.test.ts` |
| State → token, light stand-ins | `src/ui/__tests__/state-tokens.test.ts`, `src/styles/tokens/__tests__/arcade-status.test.ts` |
| Row status, Try again | `src/api/__tests__/row-status.test.ts`, `src/cc/__tests__/row-status.test.ts` |
| Brief schema, model, open | `src/brief/__tests__/schema.test.ts`, `model.test.ts`, `on-open.test.ts`, `thread.test.ts` |
| Listen, thumbs, Start on a row | `src/brief/__tests__/listen.test.ts`, `feedback.test.ts`, `start.test.ts` |
| Suggestions | `src/suggestions/__tests__/model.test.ts`, `api.test.ts`, `cache.test.ts`, `board-filter.test.ts` |
| Thread suggestion row, focus | `src/chat/__tests__/suggestion-row.test.ts`, `focus.test.ts` |
| Approval sheet | `src/approvals/__tests__/sheet-view.test.ts`, `approval-view.test.ts`, `waiting.test.ts` |
| Push tap → sheet | `src/push/__tests__/tap-approval.test.ts`, `step-up-wiring.test.ts` |
| Readiness | `src/readiness/__tests__/schema.test.ts`, `view-model.test.ts`, `client-rows.test.ts`, `client-facts.test.ts`, `wiring.test.ts` |
| Capabilities, routes | `src/api/__tests__/capabilities.test.ts`, `discovery.test.ts`, `src/cc/__tests__/routes.test.ts` |
| Arcade, Candy placements | `src/styles/homes/__tests__/arcade-prd268.test.ts`, `candy-prd268.test.ts`, `src/styles/arcade/home/__tests__/next.test.ts` |
