# Ralph Build Prompt — Automatos Go, PRD-001 wave A5: Styles (Studio, Play, HUD)

You are building **the A5 styles wave**, ONE story per session, unattended: every story gets a fresh session. Branch **`feat/a5-styles`**, in its own worktree, cut from `origin/feat/a0-a1-foundation`. One PR for the wave and one CI run per phase at the end: nothing in a story waits on CI.

This is a **React Native / Expo SDK 54 app**. There is NO browser, NO simulator and NO device in this loop. **This wave is JavaScript and bundled assets only** (no dependency, no native module, no app.json change) and **native always: no WebView anywhere**. Gerard wants this wave to feel unique and fun: build every screen to the numbers in the json, which come from the three design sources.

- The base for every diff and check is what `bash scripts/ralph/acceptance-prd001-styles.sh --print-base` prints.
- **The current phase** is what `bash scripts/ralph/acceptance-prd001-styles.sh --print-phase` prints (KS3): `1` while A2's and A3's code is not in this branch, `2` once it is.
- **Never merge anything into this branch.** The phase-2 base move is the launcher's (`RALPH_BASE_MOVE=1`) or the lead's, never a build session's.

## Your files — and nobody else's (KS1, gate-enforced)

**Phase 1** may create or change ONLY: `src/styles/**` (never `src/styles/ai-label.tsx`), `src/ui/**`, `assets/mascot/**`, `assets/styles-fonts/**` (US-016d fallback only), `app/(app)/settings/style.tsx`, `app/(app)/settings/look/**`, `app/+not-found.tsx` (a seam), and this kit's own files under `scripts/ralph/`. Phase 1 runs beside the A2 chat, A3 Command Centre and A1 connect kits: it never touches `src/chat/**`, `src/cc/**`, `app/(app)/index.tsx`, `app/(app)/chat/**`, `app/(app)/chats.tsx`, `app/(app)/cc/**`, nor the shell files the connect kit edits (`app/(app)/_layout.tsx`, `app/_layout.tsx`, `app/(app)/settings/index.tsx`, `src/navigation/**`, `src/app-state/**`, `src/api/**`).
**Phase 2** adds `app/(app)/_layout.tsx`, `app/_layout.tsx`, `app/(app)/settings/index.tsx` (US-016j) and `src/chat/**`, `src/cc/**`, `app/(app)/index.tsx`, `app/(app)/chat/**`, `app/(app)/chats.tsx`, `app/(app)/cc/**` — for mounting, the layout switch and removing a hard-coded style decision only.
Never: `src/core/**` (vendored, `scripts/sync-core.ts` only), `scripts/core-manifest.json`, `core.lock.json`, `assets/fonts/**` (the foundation's font tree), `src/navigation/routes.ts` (A5's own paths live in `src/styles/nav.ts`), `package.json`, `package-lock.json`, `app.json`, `eas.json`, `.github/**`, `scripts/*` outside `scripts/ralph/`.

**Seams (KS2):** every edit of a foundation file is ADDITIVE — no prop, export or type renamed or removed; `useTokens()` keeps its return type — because the A2 chat and A3 Command Centre kits build their screens on the same primitives at the same time. Record each edit of a seam file (`app/+not-found.tsx`; in phase 2 the three shell files and every A2/A3 file) in that story's DONE notes as `SEAM EDIT: <path> — <why>` (the gate checks it). A foundation contract that is missing or wrong: build the smallest adapter inside `src/styles/` and write `FOUNDATION GAP: <what, where>` in the DONE mark.

## Read first, every iteration

1. `scripts/ralph/prd-001-styles.json` is the BINDING contract: `decisions` (D-* from PRD-001 and Gerard's Q&A, KS* this kit's), each story's ACs, `files`, `phase` and `notes`, `references`.
2. `docs/prd/PRD-001-AUTOMATOS-GO-V1.md` §4.3, §4.6, §4.7, §4.11 and Wave A5; `CLAUDE.md`.
3. **The foundation you build on — read the actual files, not your memory; every contract in the json marked RE-VERIFY was written before the foundation was built:** `src/styles/` (tokens/, theme.tsx, type.ts, fonts.ts, ai-label.tsx), `src/ui/` (index.ts lists the primitives; variants.ts the statuses), `src/storage/mmkv.ts`, `src/api/` (client, errors, strings, capabilities, discovery, server, query-keys), `src/navigation/routes.ts`, `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(app)/settings/index.tsx`, `scripts/check-routes.ts`, and the vendored `src/core/web/`: `lib/look-kit/*`, `lib/looks/*`, `lib/mascot/*`, `lib/theme-host/{look-schema,css-value}.ts`, `components/play/chat/{labels,reply,caption}.ts`, `lib/ai-label/copy.ts`. `scripts/ralph/prd-001-foundation.json` says what each foundation story promised and its DONE notes record any gap.
4. **Phase 2 only:** the A2 and A3 code in this branch (`src/chat/**`, `src/cc/**`, their app routes) and their kit json files (`scripts/ralph/prd-001-chat.json`, `prd-001-cc.json`) with their DONE notes.
5. The story's references, READ ONLY (never edit anything there): the design sources under `/Users/gkavanagh/Development/Automatos-AI-Platform/DUMPING AREA/` (`automatos-play-ember/`, `automatos-play-command/` incl. `looks.json`, `design_handoff_automatos_mobile/`); the automatos-ai checkout `/Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/mobile-review-main` — its HEAD moved past the foundation's pin, so read web files AT THE PIN: `git -C <that path> show 630fc1c85:frontend/<path>`; the server files (themes_looks.py, themes_mobile.py, services/themes/*, docs/theme-host/mobile.md) at its HEAD.
6. Your own earlier stories' files: mirror the idiom you already set; never a second pattern.

## Local checks

Allowed (pure Node, the repo's CLAUDE.md rule): `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run check:bundle`, `npm run check:core`, `npm run check:routes`, `bash scripts/ralph/acceptance-prd001-styles.sh --no-ci`; `git -C <automatos-ai checkout> show|cat-file 630fc1c85:<path>` (reading pinned files; US-017a's binary copies with `cat-file blob`); `curl -fsSL` from `raw.githubusercontent.com/google/fonts/<commit>` ONLY for US-016d's documented fallback.
**NEVER:** `npm install`, `npx expo install` or any dependency change; `expo start`, `expo run:*`, `expo prebuild`; any `eas` command; a simulator, Metro's dev server or any server; `gh workflow run`; `git push`; opening a PR; `git merge`. Write the tests each AC names (`src/**/__tests__/*.test.ts`, vitest, node — there is no React renderer: keep components thin and test their pure models). **Pure modules never import `react`, `react-native`, `expo-*` or `@shopify/react-native-skia`**, so vitest can load them. Never claim a check passed that you did not see pass.

## Code rules

- **Tokens only.** Colour literals live only in `src/styles/tokens/` (the lint fails them elsewhere); everything else reads the resolved style. Use the vendored look engine for every colour it already computes (KS5) — never re-implement `lookToStudioTokens`, `safeGlow`, `tripletToHex`, the mascot reducer and the rest.
- **The AI label** (`src/styles/ai-label.tsx`) is never edited and never restyled; it is one small muted caption that opens every thread in every style (the thread's first row; D73), never a pill beside a composer and never a lock on one.
- **Accessibility (D-A11Y):** nothing under 11 pt in any style; Dynamic Type on; every colour status has a word (HUD: glyph + WORD); every animation has a text twin; Reduce Motion stops every loop and shows stills; tap targets 44 pt.
- **No new native module (KS7):** the Slider is ours on gesture-handler + reanimated; no blur, no clipboard; Skia for rings, grid, scanlines and the colour matrix; expo-video for clips; expo-linear-gradient for gradients.
- **Data only from a theme (D-NO-CODE):** never load JS, CSS or HTML from a theme or the server; theme files only from the allowlisted `/api/themes/files/` path.
- **File names the secrets hook blocks** (it matches the path, not the content): never `*.env`, `*.env.*`, `*/credentials*`, `*/secrets/*`, `*/secret/*`, `*.pem`, `*.key`, `*_rsa*`, `*/service-account*.json`, `*/sa-key*.json`. Name an auth-header adapter `auth-headers.ts`, never `credentials.ts`. Never work around the hook.
- HTTP only through the foundation's client with the route table `src/styles/routes.ts`; zod at every boundary; unknown fields ignored. Immutability. Copy in `src/styles/strings.ts`. Files 200–400 lines (never over 800), functions under 50, components under 150, nesting under 4.
- **No pointer to creating an account (D-NO-SIGNUP):** no 'Create an account', 'Sign up' or 'No account?' link, button or copy on any screen in any style (First open and every edge screen included); where a design shows one, say 'Sign in with your Automatos account' or drop it. The app deletes nothing (D63), and a sign-up link would oblige in-app deletion.
- Nothing about plans, credits or prices. No WebView. No second report implementation, no second live connection, no second needs-you number (read `useNeedsYou()`).

## The execution contract

- **This session ends when your turn ends.** Never end it with background work; never ScheduleWakeup; never "pick up later". Wait in the foreground for everything you start.
- **No reviewer agents in build sessions, except** where an AC names the security-reviewer (US-016i): run it in the FOREGROUND and wait for it before committing.
- **One story per session.** Build the first story (by `priority`) whose `phase` is at most the current phase and whose ACs are not all DONE, then STOP (step 5). The priority order is the dependency order.
- **Re-verify every anchor** by reading it before relying on it.

## Commits

- `git commit -s` (DCO) on EVERY commit; `feat(prd-001): <story id> — <title>` (or fix/test/docs/chore), **every story commit ends with ` [skip ci]`**, evidence in the body.
- Stage explicit paths only (`git add <path> …`): NEVER `git add -A`, `.`, `-u` or `-f`; never `git stash`; never amend, rebase, cherry-pick, merge or switch branches. `git status --short` before each commit; account for every line. Binary files (the mascot clips and stills) are staged by their exact paths.

## Hard NOs

- NO file outside KS1's list for the current phase. NO dependency, native, app.json or eas.json change. NO pushing, PRs or merges (the runner pushes `origin feat/a5-styles` as a backup and opens the draft PR when a phase completes).
- NO edit to `src/styles/ai-label.tsx`, `src/core/**`, `assets/fonts/**`. NO breaking change to a foundation primitive's props or to `useTokens()`'s type.
- NO weakening, skipping or deleting a test, lint rule or check; no inline lint disable without a one-line reason.
- NO voice (A6: HOLD TO TALK stays inert, MIC stays off), push (A4), pairing (US-006), chat or Command Centre behaviour (A2, A3: phase 2 mounts and dresses only), the HUD desktop pages.

## Per-iteration protocol

1. Read the current phase (`--print-phase`). Pick the first story (by `priority`) with `phase` <= the current phase and ACs not yet DONE. Read its sources and the foundation files it uses, fresh.
2. Implement it with its tests; run its checks until green.
3. Commit the story (signed, ` [skip ci]`).
4. Mark it in `scripts/ralph/prd-001-styles.json`: APPEND ` → DONE — <evidence>` to each AC, set `passes` to `true`, add one line to `notes` after ' | ' (including every `SEAM EDIT:` and `FOUNDATION GAP:`); `jq . scripts/ralph/prd-001-styles.json >/dev/null`; commit that file alone (signed, ` [skip ci]`).
5. **STOP.** Unless that was the last story of the current phase, end your reply with `STORY_DONE <story id>` as its last line. **RALPH_COMPLETE, RALPH_BLOCKED and STORY_DONE are sentinels the runner reads on your LAST line only (≤ 80 characters): never write them anywhere else.**

## Completion (per phase)

- **Every story of the current phase `passes: true`** (in phase 1 the phase-2 stories stay `passes: false` — that is not a block): run `bash scripts/ralph/acceptance-prd001-styles.sh --no-ci`; fix what is red in signed ` [skip ci]` commits (a gate check that is itself wrong is not yours to loosen: report it and stop with BLOCKED); then ONE signed commit WITHOUT `[skip ci]` — `git commit -s --allow-empty -m "chore(prd-001): A5 styles phase <N> built, run CI"` — and reply with `RALPH_COMPLETE` as the last line.
- **Already built and tested:** every story of the current phase `passes: true` and the last commit touching anything outside `scripts/ralph/` is that CI commit, or a commit without `[skip ci]` whose ci.yml run completed green (`gh run list --branch feat/a5-styles --workflow ci.yml --limit 5 --json headSha,status,conclusion`): make NO commit; reply `RALPH_COMPLETE` and nothing else.
- **A story cannot be built without breaking a Hard NO** (it truly needs a new dependency, a native change, or a foundation edit no adapter can replace): one line of why and the evidence, then `RALPH_BLOCKED` as the last line. The tip must stay green.
