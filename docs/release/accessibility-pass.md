# Accessibility pass: the largest text, every style (OT-R8)

PRD-001 US-021 AC3 and R17: every screen stays readable and usable at the largest Dynamic Type
size, in every style (D38). The code half is a test that runs in CI on every pull request; the
screens themselves can only be checked on a phone. That is this owner step.

## What CI already checks

[src/release/\_\_tests\_\_/a11y-audit.test.ts](../../src/release/__tests__/a11y-audit.test.ts)
(US-021l) reads every product file under `src/` and `app/` and fails when:

- a text turns Dynamic Type off (`allowFontScaling={false}`, or `allowFontScaling: false` in a
  props object), or caps it (`maxFontSizeMultiplier`) below 2 or without a one-line reason
  directly above;
- a `fontSize` is written as a number under 11 pt (D38). The type scale holds the same floor
  (`MIN_TEXT_SIZE` in `src/styles/type.ts`);
- a control that shows no words has no accessibility label, or a label is empty;
- an icon-only button is not the `IconButton` primitive (`src/ui/IconButton.tsx`), whose
  `accessibilityLabel` its type requires.

The Text primitive cannot be told to stop scaling: `allowFontScaling` is not one of its props.
Three exceptions are listed, each with its reason, in
`src/release/__tests__/support/a11y-allowed.ts`: the header's menu button (its badge sits beside
the icon), HUD's menu square (part of HUD's command row) and Lost's big '404' (a decoration hidden
from VoiceOver, with the same meaning in text under it).

What CI cannot see: text that clips, overlaps or runs off the screen at the largest size, a
layout that does not wrap, an action pushed out of reach. That is what this pass checks.

## Set up the phone

On Gerard's iPhone, with the TestFlight build of the A7 merge (or later):

1. **Settings → Accessibility → Display & Text Size → Larger Text**: turn on **Larger
   Accessibility Sizes** and drag the slider to the far right (the largest size).
2. **Settings → Accessibility → Display & Text Size → Bold Text**: on.
3. **Settings → Accessibility → Motion → Reduce Motion**: on.
4. Have a workspace with test data: questions waiting, a ticket in Review, a social post waiting
   for approval, Deliverables, a mission on the Board, a calendar item, at least two older chats,
   and a thread where Auto has made a card (a mission suggestion or a ticket card) and shown its
   receipts.

## Switch style

In the app: **Settings → Style and look**.

| Column | How to set it |
|---|---|
| `studio-light` | Choose **Studio**, then **Light** under Studio appearance |
| `studio-dark` | Choose **Studio**, then **Dark** |
| `play` | Choose **Play** (its default look) |
| `hud` | Choose **HUD** (its default look) |

Welcome, Sign in and Connect come before sign-in. Sign-out keeps the style and the Light / Dark
choice (US-021j), so set the style first, sign out, and shoot those screens in it.

## The matrix

Shoot each row in each of the four columns, except the columns named under "Not in": that style
has no way to the screen. HUD's home links to Settings, not to older chats (its menu square opens
Settings), so row 12 is skipped in HUD. HUD's home is the HUD core the voice screen draws in every
style, with HOLD TO TALK on it (US-019k), and no HUD composer carries the voice button: instead of
row 26, shoot row 06 again while holding HOLD TO TALK, as `a11y-hud-06-home-talk.png`.

| # | Screen (`<screen>` in the file name) | Where it is | How to reach it | Not in |
|---|---|---|---|---|
| 01 | `welcome` | `app/welcome.tsx` | Signed out: the first screen, with the legal line under the buttons | |
| 02 | `sign-in` | `app/(auth)/sign-in.tsx` | Welcome → Sign in to Automatos | |
| 03 | `connect` | `app/connect/index.tsx` | Welcome → Connect to your own server; type an address and a code to reach the confirm card | |
| 04 | `connect-scan` | `app/connect/scan.tsx` | Connect → Scan the code in Studio | |
| 05 | `consent` | `src/consent/ConsentSheet.tsx` | The AI-provider consent sheet before the first message on a workspace (a fresh install, or a new workspace) | |
| 06 | `home` | `app/(app)/index.tsx` | Home with something waiting: Studio's needs strip, Play's 'NEEDS YOU · N' line, HUD's 'COMMAND · N' row | |
| 07 | `home-menu` | `src/chat/home/HomeMenu.tsx` | Home → the menu button (with its count) | play, hud |
| 08 | `thread` | `app/(app)/chat/[id].tsx` | A thread with Auto's card and its receipts; the 'Auto is an AI' label at the top in shot | |
| 09 | `composer-attachment` | the thread's composer | Attach a photo; shoot with the chip in the composer and the keyboard up | |
| 10 | `attach-menu` | `src/chat/attachments/AttachMenu.tsx` | The composer's attach button | |
| 11 | `report` | `src/ui/ReportSheet.tsx` | Long-press Auto's reply → Report this | |
| 12 | `older-chats` | `app/(app)/chats.tsx` | Studio: the menu → Chats; Play: 'Chats' (its Conversations) | hud |
| 13 | `cc-board` | `app/(app)/cc/board.tsx` | The Command Centre (Board tab) | |
| 14 | `ticket` | `app/(app)/cc/ticket/[taskId].tsx` | Board → a ticket | |
| 15 | `calendar` | `app/(app)/cc/calendar.tsx` | Command Centre → Calendar | |
| 16 | `calendar-item` | `src/cc/calendar/ItemSheet.tsx` | Calendar → an item | |
| 17 | `questions` | `app/(app)/cc/questions.tsx` | Command Centre → Questions, with one waiting | |
| 18 | `social` | `app/(app)/cc/social/[postId].tsx` | A social post waiting for approval | |
| 19 | `deliverables` | `app/(app)/cc/deliverables.tsx` | Command Centre → Deliverables | |
| 20 | `deliverable` | `app/(app)/cc/deliverables/[id].tsx` | Deliverables → one (Play: the printed page) | |
| 21 | `settings` | `app/(app)/settings/index.tsx` | Settings, top | |
| 22 | `settings-privacy` | `src/release/components/PrivacySection.tsx` | Settings, scrolled to Privacy & legal: the links, Send crash reports, the version | |
| 23 | `notifications` | `app/(app)/settings/notifications.tsx` | Settings → Notifications | |
| 24 | `style` | `app/(app)/settings/style.tsx` | Settings → Style and look | |
| 25 | `look` | `app/(app)/settings/look/play.tsx`, `look/hud.tsx` | Play: 'Make it yours'; HUD: 'Looks' (Studio's look is Light / Dark on its card) | studio-light, studio-dark |
| 26 | `voice` | `app/(app)/voice.tsx` | A thread's composer → the voice button; the AI label in shot | hud |
| 27 | `push-prompt` | `src/push/prompt/PushPrompt.tsx` | 'Get a notification when Auto needs you', when the app first asks | |
| 28 | `remove-phone` | `src/push/bind/RemovePhone.tsx` | Signed in to hosted Studio: Settings → Remove this phone; shoot, then Cancel | |
| 29 | `forget-server` | `src/connect/components/ForgetServer.tsx` | Paired to the VPS: Settings → Remove this phone and forget this server; shoot, then Cancel | |
| 30 | `edge-first-open` | `src/styles/edges/FirstOpen.tsx` | A workspace with no chats yet | |
| 31 | `edge-not-running` | `src/styles/edges/NotRunning.tsx` | Paired to the VPS with the VPS stopped (or the phone's Wi-Fi off) | |
| 32 | `edge-something-wrong` | `src/styles/edges/SomethingWrong.tsx` | Only when the server answers with an error; skip it if it cannot be made to happen, and say so | |
| 33 | `edge-lost` | `app/+not-found.tsx` (`src/styles/edges/Lost.tsx`) | Type `automatos://nowhere` in Safari's address bar and open it in the app | |

On each screen, scroll to the bottom and shoot again when it is longer than the phone: add `-2`,
`-3` to the name.

## What to look for

On every shot:

- **No clipped or overlapping text.** Every word is on screen in full, not cut off at the top or
  bottom of its box, and no text sits over other text or an icon. A line that ends in '…' is a
  finding unless the full text is one tap away (a chat title in a list, for example).
- **Layouts wrap.** Rows stack or wrap to more lines; nothing runs off the right edge; buttons grow
  taller rather than squeezing their words.
- **Every action is reachable.** Each button, link and switch can be reached by scrolling and
  tapped; nothing is hidden behind the keyboard, the home indicator or another button.
- **The AI label is visible.** The 'Auto is an AI' caption at the top of every thread (the home
  screen's conversation included) and on the voice screen, in full.
- **Statuses have words.** Every coloured status (a pip, a pill, a badge) also says what it is in
  words.
- **Bold Text and Reduce Motion.** The app sets its words in its own bundled typefaces, which Bold
  Text does not change; it is on so the system's parts (alerts, the keyboard, the photo picker,
  share sheets) are shot as a tester with it on sees them. With Reduce Motion on, nothing on the
  app's screens moves on its own: an animation stops or becomes a fade.

## Screenshot names

`a11y-<column>-<nn>-<screen>.png`, from the two tables above: for example
`a11y-studio-light-06-home.png`, `a11y-hud-26-voice.png`, `a11y-play-20-deliverable-2.png`.

## Where they go

Attach the screenshots to the A7 pull request (branch `feat/a7-release`): one comment per column
with that column's shots (or a zip of the four folders), and this results table filled in. A
finding names the shot and what is wrong; each one becomes a fix before App Review.

| Column | Shots | Findings |
|---|---|---|
| studio-light | | |
| studio-dark | | |
| play | | |
| hud | | |
