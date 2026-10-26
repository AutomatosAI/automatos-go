# Ralph Build Prompt — Automatos Go, PRD-001 wave A6: Voice (quick-ask, the voice screen, Auto Live)

You are building **the A6 voice wave**, ONE story per session, unattended: every story gets a fresh session. Branch **`feat/a6-voice`**, in its own worktree, cut from the foundation branch after A2 chat and A5 styles phase 1 were merged into it. One PR for the wave and one CI run per phase at the end: nothing in a story waits on CI.

This is a **React Native / Expo SDK 54 app**. There is NO browser, NO simulator and NO device in this loop. **This wave is JavaScript only** (no dependency, no native module, no app.json change) and **native always: no WebView anywhere** — Gerard rejected a WebView for voice as "a hack". Quick-ask is expo-speech-recognition + expo-speech; Auto Live is LiveKit's React Native SDK. Retell's browser SDK is never installed, imported or embedded.

- The base for every diff and check is what `bash scripts/ralph/acceptance-prd001-voice.sh --print-base` prints.
- **The current phase** is what `bash scripts/ralph/acceptance-prd001-voice.sh --print-phase` prints (KV3): `1` (quick-ask and the voice screen) until the kit json's `RETELL_LIVEKIT_CONFIRMED` decision has `"value": true` AND the connect kit's `src/consent/policy.ts` is in this branch; then `2` (Auto Live).
- **`RETELL_LIVEKIT_CONFIRMED` is the lead's to flip, never yours.** Do not edit that decision, do not build a phase-2 story in phase 1, and do not create anything under `src/voice/live/` or import `@livekit/react-native` / `livekit-client` before phase 2 (the gate fails it).
- **Never merge anything into this branch.** The phase-2 base move is the launcher's (`RALPH_BASE_MOVE=1`) or the lead's.

## Your files — and nobody else's (KV1, KV2, gate-enforced)

You may create or change ONLY: `src/voice/**`, `app/(app)/voice.tsx`, this kit's own files under `scripts/ralph/`, and these **named seams** — each edit ADDITIVE (no prop, export or type renamed or removed; without the new optional prop the component behaves exactly as its kit built it) and recorded in that story's DONE notes as `SEAM EDIT: <path> — <why>`:
- A2: `src/chat/request.ts` and `src/chat/controller/**` (spokenMode, US-019f), `src/chat/composer/Composer.tsx` (the voice button, US-019k);
- A5: `src/styles/hud/core/**` (HudCore's optional voice props, HudButtons' hold handlers and labels, StateChip's words, RingCore's lineColour, HudTopBar's menu label — US-019j), `src/styles/play/companion/PlayComposer.tsx` (the voice button, US-019k), `src/styles/homes/HudHome.tsx` (only when it exists in the base, US-019k).

Never: any `__tests__` folder of A2 or A5 (their tests must pass unchanged), `src/core/**`, `src/api/**`, `src/auth/**`, `src/ui/**`, `src/navigation/**` (your app path lives in `src/voice/nav.ts`, KV17), `src/storage/**`, `src/app-state/**`, `src/consent/**` (read only), `src/connect/**`, `src/cc/**`, every other file of `src/styles/**` and `src/chat/**`, `src/styles/ai-label.tsx`, `app/_layout.tsx`, `app/(app)/_layout.tsx`, every other app route, `package.json`, `package-lock.json`, `app.json`, `eas.json`, `plugins/**`, `.github/**`, `scripts/*` outside `scripts/ralph/`. **A contract that is missing or wrong** in the foundation, A2, A5 or connect: build the smallest adapter inside `src/voice/` and write `FOUNDATION GAP: <what, where>` in the DONE mark. Never "just fix" another kit's file.

## Read first, every iteration

1. `scripts/ralph/prd-001-voice.json` is the BINDING contract: `decisions` (D-* from PRD-001 and Gerard's Q&A; KV* this kit's; RETELL_LIVEKIT_CONFIRMED), `retellLiveKitProtocol` (the exact protocol Auto Live speaks — the evidence from Retell's published SDK), each story's ACs, `files`, `phase` and `notes`, `references`, `needsInBase`.
2. `docs/prd/PRD-001-AUTOMATOS-GO-V1.md` §4.4, §4.6, §4.7, §4.9, §4.11 and Wave A6; `CLAUDE.md`.
3. **The code you build on — read the actual files, not your memory; every contract marked RE-VERIFY was written before that code existed:** the foundation (`src/api/{client,errors,strings,capabilities,discovery,workspace,routes}.ts`, `src/auth/{role,strings}.ts`, `src/styles/ai-label.tsx`, `src/ui/index.ts`, `src/navigation/routes.ts`, `src/lib/logger.ts`, `scripts/check-routes.ts`, the vendored `src/core/web/lib/{ai-label/copy,mascot/media,mascot/types}.ts` and `components/play/chat/labels.ts`, `docs/native-modules.md`, `app.json`); A2 (`src/chat/{request,view-model}.ts`, `src/chat/controller/`, `src/chat/composer/`, `src/chat/screens/`, and `scripts/ralph/prd-001-chat.json` with its DONE notes); A5 phase 1 (`src/styles/hud/core/`, `src/styles/provider/`, `src/styles/mascot/`, `src/styles/play/companion/PlayComposer.tsx`, `src/styles/nav.ts`, and `scripts/ralph/prd-001-styles.json` with its DONE notes). Phase 2 also: the connect kit's `src/consent/` and `scripts/ralph/prd-001-connect.json`.
4. **The installed module APIs** (read `node_modules`, never guess): `expo-speech-recognition` (3.1.3: `build/ExpoSpeechRecognitionModule.types.d.ts`, `build/constants.d.ts`, the Android and iOS lines KV4 cites), `expo-speech` (14.0.8), `expo-localization`, `expo-keep-awake` (15.0.8, via `expo`), and in phase 2 `@livekit/react-native` (3.1.0: `lib/typescript/src/index.d.ts`, `audio/AudioSession.d.ts`) and `livekit-client` (2.23.0: `Room`, `RoomEvent`).
5. The story's references, READ ONLY (never edit anything there): the automatos-ai checkout `/Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/mobile-review-main` (`git -C <that path> show HEAD:<path>`: `orchestrator/api/voice_retell.py`, `orchestrator/modules/voice/*`, `orchestrator/modules/policy/ai_disclosure.py`, `frontend/hooks/use-retell-call.ts`, `frontend/lib/voice/orb-state.ts`); the backend kits `/Users/gkavanagh/Development/Automatos-AI-Platform/automatos-ai/scripts/ralph/prd-266w1.json` (US-007a, US-008a) and `prd-266w3.json` (US-017b/c); the HUD design `/Users/gkavanagh/Development/Automatos-AI-Platform/DUMPING AREA/automatos-play-command/README.md` ('Core (voice)').
6. Your own earlier stories' files: mirror the idiom you already set; never a second pattern.

## Local checks

Allowed (pure Node, the repo's CLAUDE.md rule): `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run check:bundle`, `npm run check:core`, `npm run check:routes`, `bash scripts/ralph/acceptance-prd001-voice.sh --no-ci | --print-base | --print-phase`; reading `node_modules` and the automatos-ai checkout.
**NEVER:** `npm install`, `npx expo install` or any dependency change (never install `retell-client-js-sdk`); `expo start`, `expo run:*`, `expo prebuild`; any `eas` command; a simulator, Metro's dev server or any server; `gh workflow run`; `git push`; opening a PR; `git merge`. Write the tests each AC names (`src/voice/__tests__/*.test.ts`, vitest, node — there is no React renderer: keep components thin and test their pure models). **Pure modules never import `react`, `react-native`, `expo-*`, `@livekit/*` or `livekit-client`**, so vitest can load them. Never claim a check passed that you did not see pass.

## Code rules

- **On the phone or not at all (KV4).** Every recognition start passes `requiresOnDeviceRecognition: true` and runs only with a 'ready' policy (iOS: `supportsOnDeviceRecognition()` checked first, because the module silently uses Apple's servers otherwise; Android: API 33+, the on-device recognizer and the installed language). Never `androidRecognitionServicePackage`, `recordingOptions` or `audioSource`. Never a network fallback.
- **The mic opens only on a press (KV5, D-SCREEN-ON).** Permissions are asked from the press handler, never at mount or launch. MIC LIVE follows the recognizer's audiostart/audioend (and, in Live, the connected call). Nothing resumes the mic, speech or Live by itself after an interruption or a return from the background (KV10).
- **One reducer (KV8):** every word and state on the voice screen derives from `src/voice/machine/voice-reducer.ts` through the view-model.
- **One audio owner (KV13); one file per native module (KV15):** `recognizer.ts` and `permissions.ts` import expo-speech-recognition, `speaker.ts` imports expo-speech, `keep-awake.ts` imports expo-keep-awake, `livekit-session.ts` imports LiveKit — nothing else does (gate-enforced).
- **Chat goes through A2 only:** quick-ask sends through A2's controller (spokenMode when `canSpokenMode`), STOP uses A2's Stop (cancels on the server). Never a second chat request, stream or report path.
- **The AI label** (`src/styles/ai-label.tsx`) is never edited or restyled; it is one small muted caption on the voice screen and nothing ever waits on it (no fence: HOLD TO TALK, LIVE and typing are never disabled for it; D73). The AI notice (KV7) is shown and spoken ONCE per voice session, never repeated, never switchable.
- **Tokens only** (colours from A5's resolved style; the lint fails literals). Accessibility (D-A11Y): nothing under 11 pt, text twins for every animation, Reduce Motion stops every loop, 44 pt targets, HOLD TO TALK toggles under a screen reader.
- **Words:** nothing about plans, credits or prices (W1's 'Auto Live is on the Business plan' is never shown: KV14); no pointer to creating an account; no "nothing leaves your server" claim — Live's copy names Retell (KV18). Copy in `src/voice/strings.ts`.
- **The access token is a credential** (phase 2): used once, never logged, stored, put in a breadcrumb or an error message.
- **File names the secrets hook blocks** (it matches the path, not the content): never `*.env`, `*.env.*`, `*/credentials*`, `*/secrets/*`, `*/secret/*`, `*.pem`, `*.key`, `*_rsa*`, `*/service-account*.json`, `*/sa-key*.json`. Name a token helper `token.ts` or `mint.ts`, never `credentials.ts`. Never work around the hook.
- HTTP only through the foundation's client with the route table `src/voice/routes.ts` (phase 2); zod at every boundary; unknown fields and packets ignored. Immutability. Files 200–400 lines (never over 800), functions under 50, components under 150, nesting under 4.

## The execution contract

- **This session ends when your turn ends.** Never end it with background work; never ScheduleWakeup; never "pick up later". Wait in the foreground for everything you start.
- **No reviewer agents in build sessions, except** where an AC names the security-reviewer (US-020a, US-020d): run it in the FOREGROUND and wait for it before committing.
- **One story per session.** Build the first story (by `priority`) whose `phase` is at most the current phase and whose ACs are not all DONE, then STOP (step 5). The priority order is the dependency order.
- **Re-verify every anchor** by reading it before relying on it.

## Commits

- `git commit -s` (DCO) on EVERY commit; `feat(prd-001): <story id> — <title>` (or fix/test/docs/chore), **every story commit ends with ` [skip ci]`**, evidence in the body.
- Stage explicit paths only (`git add <path> …`): NEVER `git add -A`, `.`, `-u` or `-f`; never `git stash`; never amend, rebase, cherry-pick, merge or switch branches. `git status --short` before each commit; account for every line.

## Hard NOs

- NO file outside KV1 and KV2. NO dependency, native, app.json or eas.json change. NO pushing, PRs or merges (the runner pushes `origin feat/a6-voice` as a backup and opens the draft PR when a phase completes).
- NO edit to `RETELL_LIVEKIT_CONFIRMED`, `src/styles/ai-label.tsx`, `src/core/**`, `src/navigation/**`, or any A2/A5 test. NO breaking change to an A2 or A5 export, prop or type.
- NO weakening, skipping or deleting a test, lint rule or check; no inline lint disable without a one-line reason.
- NO WebView, no Retell browser SDK, no network speech recognition, no saved audio, no background microphone, no foreground service, no background task (KV11). NO push (A4), pairing or consent UI (A1: Live reads connect's consent, never a second sheet), chat or style behaviour beyond the seams.

## Per-iteration protocol

1. Read the current phase (`--print-phase`). Pick the first story (by `priority`) with `phase` <= the current phase and ACs not yet DONE. Read its sources, the code it builds on and the module APIs it uses, fresh.
2. Implement it with its tests; run its checks until green.
3. Commit the story (signed, ` [skip ci]`).
4. Mark it in `scripts/ralph/prd-001-voice.json`: APPEND ` → DONE — <evidence>` to each AC, set `passes` to `true`, add one line to `notes` after ' | ' (including every `SEAM EDIT:` and `FOUNDATION GAP:`); `jq . scripts/ralph/prd-001-voice.json >/dev/null`; commit that file alone (signed, ` [skip ci]`).
5. **STOP.** Unless that was the last story of the current phase, end your reply with `STORY_DONE <story id>` as its last line. **RALPH_COMPLETE, RALPH_BLOCKED and STORY_DONE are sentinels the runner reads on your LAST line only (≤ 80 characters): never write them anywhere else.**

## Completion (per phase)

- **Every story of the current phase `passes: true`** (in phase 1 the Auto Live stories stay `passes: false` — that is not a block): run `bash scripts/ralph/acceptance-prd001-voice.sh --no-ci`; fix what is red in signed ` [skip ci]` commits (a gate check that is itself wrong is not yours to loosen: report it and stop with BLOCKED); then ONE signed commit WITHOUT `[skip ci]` — `git commit -s --allow-empty -m "chore(prd-001): A6 voice phase <N> built, run CI"` — and reply with `RALPH_COMPLETE` as the last line.
- **Already built and tested:** every story of the current phase `passes: true` and the last commit touching anything outside `scripts/ralph/` is that CI commit, or a commit without `[skip ci]` whose ci.yml run completed green (`gh run list --branch feat/a6-voice --workflow ci.yml --limit 5 --json headSha,status,conclusion`): make NO commit; reply `RALPH_COMPLETE` and nothing else.
- **A story cannot be built without breaking a Hard NO** (it truly needs a new dependency, a native change, or another kit's file no adapter can replace), **or the base lacks A2 or A5 phase 1** (the gate's 'the base carries A2 chat and A5 styles phase 1' check is red): one line of why and the evidence, then `RALPH_BLOCKED` as the last line. The tip must stay green.
