# Ralph Build Prompt — Automatos Go, PRD-001 wave A8: Arcade, the fourth style

You are building **the A8 Arcade wave**, ONE story per session, unattended: every story gets a fresh session. Branch **`feat/a8-arcade`**, in its own worktree, on `origin/main`; its first commit is Gerard's PRD-001 addendum (§4.6.1, US-022). One PR and one CI run for the whole wave at the end: nothing in a story waits on CI.

This is a **React Native / Expo SDK 54 app**. There is NO browser, NO simulator and NO device in this loop. Arcade is a fourth built-in style beside Studio, Play and HUD, **built the way HUD was** (D-ARC-1). The wave is JavaScript and bundled assets, plus ONE native change: US-022d adds three fonts to `app.json`'s expo-font list (D-ARC-4), so the merge is a native build. No dependency change (KA4). **Native always: no WebView, no downloaded code.**

- **`<workspace>`** in the json is the folder that holds the automatos-go main checkout (the repo's parent folder). The runner exports it as **`$RALPH_WORKSPACE`**: `echo "$RALPH_WORKSPACE"`, and build every reference path from it (`"$RALPH_WORKSPACE/.worktrees/automatos-design-kit/kit-arcade-official"`, `"$RALPH_WORKSPACE/DUMPING AREA/automatos-arcade/"`). Without it: `dirname "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"`. **This repo is public: never write that absolute path, or any `/Users/…` path, into any file here** (source, test, doc, comment, kit json, commit message). The gate checks every added line.
- The base for every diff and check is what `bash scripts/ralph/acceptance-prd001-arcade.sh --print-base` prints.
- **Never merge anything into this branch.** Before US-022k's session the runner merges `origin/main` in when it has moved (a commit `chore(prd-001): A8 base move — merge origin/main [skip ci]`), and the launcher does the same with `RALPH_BASE_MOVE=1`. Never a build session.

## Your files — and nobody else's (KA1-FILES, gate-enforced)

You may create or change ONLY: `src/styles/**` (never `src/styles/ai-label.tsx`); `src/ui/Slider.tsx` and `src/ui/dressed.ts` (additive); `src/voice/home/use-arcade-home-voice.ts` and `src/voice/home/arcade-home-voice.ts`; `src/voice/screen/**`; `src/voice/nav.ts`; `app/(app)/settings/look/arcade.tsx`; `assets/fonts/press-start-2p/**`, `assets/fonts/pixelify-sans/**`, `assets/fonts/SOURCES.md` and `app.json`'s expo-font `fonts` list (US-022d only); `docs/styles-and-themes.md`; `docs/prd/PRD-001-AUTOMATOS-GO-V1.md` (US-022's boxes); `CLAUDE.md` (the styles count); PRD-268's home files in US-022k only (`src/brief/**`, `src/suggestions/**`, `src/approvals/**`, and only where main already brought them); the tests beside each (`__tests__/` beside the file, and `src/voice/__tests__/`, `src/ui/__tests__/` where those modules' tests live); and this kit's own files under `scripts/ralph/`.
**Never:** `src/core/**` (vendored, `scripts/sync-core.ts` only), `core.lock.json`, `src/api/**`, `src/navigation/routes.ts`, `package.json`, `package-lock.json`, `eas.json`, `.eas/**`, `.github/**`, any other `assets/fonts/**` family, any other key of `app.json` (the gate compares it with jq: only new `./assets/fonts/press-start-2p/…` and `./assets/fonts/pixelify-sans/…` entries, existing entries kept in order), any other file under `scripts/`.

**Seams (KA5-SEAMS):** every edit outside `src/styles/` is ADDITIVE (no prop, export or type renamed or removed) and recorded in that story's DONE note as `SEAM EDIT: <path> — <why>`, one per path, the exact repo path. The gate wants one for **every changed path outside `src/styles/`** except tests (`__tests__/`, `*.test.ts(x)`) and this kit's files. That includes `app/(app)/settings/look/arcade.tsx` (US-022a), `app.json`, `assets/fonts/SOURCES.md` and each new font and `OFL.txt` file (US-022d), `src/voice/home/use-arcade-home-voice.ts` and `arcade-home-voice.ts` if made (US-022g), `src/ui/Slider.tsx` and `src/ui/dressed.ts` (US-022h), every `src/voice/**` file (US-022i), `docs/styles-and-themes.md`, `CLAUDE.md` and `docs/prd/PRD-001-AUTOMATOS-GO-V1.md` (US-022k; the addendum commit changed the PRD too, and US-022k's note covers both), and any PRD-268 file. A foundation contract that is missing or wrong: build the smallest adapter inside `src/styles/` and write `FOUNDATION GAP: <what, where>` in the DONE mark.

**Stand-ins (KA2-STAND-IN):** US-022a puts `'arcade'` in every exhaustive map with Studio's value, each line marked `// ARCADE_STAND_IN <owner story>`; each later story removes its own; after US-022k `grep -rn ARCADE_STAND_IN src app` finds nothing (gate-enforced). typecheck, lint and vitest stay green at every commit.

**Vendoring (KA3-VENDOR-PIN):** Arcade's data and drawing come from the design kit at `034fa629c` (`034fa629c8ba79cff042559ca2d132f6d38f6d23`), `themes/arcade/`: `git -C "$RALPH_WORKSPACE/.worktrees/automatos-design-kit/kit-arcade-official" show 034fa629c:themes/arcade/<path>` (or `gh api 'repos/AutomatosAI/automatos-design-kit/contents/themes/arcade/<path>?ref=034fa629c8ba79cff042559ca2d132f6d38f6d23'`). Each vendored file carries a header naming the kit path, the commit and the source's sha256 exactly as `git -C … show 034fa629c:themes/arcade/<path> | shasum -a 256` prints it: the gate recomputes it for `tokens/arcade-catalogue.ts` (`src/looks/catalogue.ts`), `arcade/sprite/{grid,auto-sprite,states}.ts` (`src/art/…`) and `arcade/look-schema.ts` (`looks/schema.json`; name each preset's sha256 too). Colour data goes under `src/styles/tokens/`. Never copy the kit's React/DOM code (its `.tsx`, CSS modules): port the behaviour.

## Read first, every iteration

1. `scripts/ralph/prd-001-arcade.json` is the BINDING contract: `decisions` (D-ARC-1..7, D-* from PRD-001, KA1..KA5 this kit's), each story's ACs, `files` and `notes`, `references`, `localChecks`.
2. `docs/prd/PRD-001-AUTOMATOS-GO-V1.md` §4.3, §4.6, §4.6.1, §4.7, §4.11 and Wave A8 (US-022); `CLAUDE.md`; `docs/styles-and-themes.md`.
3. **HUD is the model for every wiring point** (`references.hudModel`): read the actual files, not your memory; `scripts/ralph/prd-001-styles.json` says how each was built and its DONE notes name the pitfalls. The json's file and line anchors were written from origin/main on 30 Oct: re-verify each before relying on it.
4. The design kit at the pin (`references.kitArcade`), READ ONLY: never edit or commit anything there.
5. The Arcade handoff (`references.designArcade`), READ ONLY: `README.md`, `looks.json`, `Automatos Arcade.dc.html` (the 390×844 phone after the 'PHONE · 390 × 844' label, `data-screen-label="Phone 390"`). `support.js` is Claude Design's runtime, not a source.
6. **US-022k only:** PRD-268's code if it is on the branch (`src/brief/`, `src/suggestions/`, `src/approvals/`) and how `HudHome.tsx` and `PlayHome.tsx` wire it (`references.prd268`).
7. Your own earlier stories' files: mirror the idiom you already set; never a second pattern.

## Local checks (`localChecks.allowed`)

Allowed (pure Node, the repo's CLAUDE.md rule): `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run check:bundle`, `npm run check:core`, `npm run check:routes`, `npx expo-doctor`, `npx expo config --type introspect`, `bash scripts/ralph/acceptance-prd001-arcade.sh --no-ci | --print-base`; reading the kit at the pin with `git -C … show` or `gh api` as above; `curl -fsSL` from `raw.githubusercontent.com/google/fonts` and `raw.githubusercontent.com/eifetx/Pixelify-Sans` at pinned commits, ONLY in US-022d (google/fonts `dbd72d6ef9ebea750d33c02c7189633e972d6a40` `ofl/pressstart2p/PressStart2P-Regular.ttf` has the pinned sha256 `034c77f1…017d`, checked 30 Oct; Pixelify Sans at `39df74aba80df8157546034b878e8be1eb565ced`, `fonts/ttf/` and the root `OFL.txt`). node_modules comes from setup-worktree.sh.
**NEVER** (`localChecks.never`): `npm install`, `npx expo install` or any dependency change; `expo start`, `expo run:*`, `expo prebuild`; any `eas` command; a simulator, Metro's dev server or any server; `gh workflow run`; `git push`; opening a PR; `git merge`. Write the tests each AC names (`__tests__/*.test.ts`, vitest, node: there is no React renderer, so keep components thin and test their pure models). **Pure modules never import `react`, `react-native`, `expo-*` or `@shopify/react-native-skia`** (the gate checks the ones the stories call pure). Never claim a check passed that you did not see pass.

## Code rules

- **Tokens only (D-TOKENS).** Colour literals live only in `src/styles/tokens/` (the lint fails them elsewhere), including the vendored catalogue and the sprite's colours; everything else reads the resolved style. Use the vendored engine for what it already computes (`contrastRatio`, `validateLook`, `validateLookSchema`, the mascot state names): never re-implement it.
- **The AI label (D-AI-LABEL)** (`src/styles/ai-label.tsx`) is never edited and never restyled: one small muted caption, the story window's first row and on the voice screen; never a pill, never a lock. Scanlines are never drawn over it.
- **Accessibility (D-A11Y):** nothing under 11 pt (the design's small pixel labels are raised to 11); Dynamic Type with layouts that wrap; every colour status has a word (glyph + WORD); every animated signal has a text twin; Reduce Motion AND the pause control stop every loop and show stills (frame 1); tap targets 44 pt, the D-pad's 64.
- **One set of screens (D-ONE-SET, D-ONE-VOICE):** the Command Centre, sheets, settings and the voice screen are dressed through the dress, never copied per style.
- **No new dependency (KA4):** Skia, reanimated, react-native-svg and expo-font are already there. No blur, no clipboard, no web-only widget.
- **Data only from a theme (D-NO-CODE):** never load JS, CSS or HTML from a theme or the server; Arcade's drawing is vendored source.
- **File names the secrets hook blocks** (it matches the path, not the content): never `*.env`, `*.env.*`, `*/credentials*`, `*/secrets/*`, `*/secret/*`, `*.pem`, `*.key`, `*_rsa*`, `*/service-account*.json`, `*/sa-key*.json`. Never work around the hook.
- HTTP only through the foundation's client and the existing route tables (the looks API is Play's and HUD's, `src/styles/routes.ts`); no new endpoint (D-ARC-6); zod at every boundary, unknown fields ignored. Immutability. Copy in `src/styles/strings.ts`. Files 200–400 lines (never over 800), functions under 50, components under 150, nesting under 4 (D-SHAPE).
- **No pointer to creating an account (D-NO-SIGNUP)** on any screen; nothing about plans, credits or prices. No second report implementation, live connection or needs-you number (read `useNeedsYou()`).

## The execution contract

- **This session ends when your turn ends.** Never end it with background work; never ScheduleWakeup; never "pick up later". Wait in the foreground for everything you start.
- **No reviewer agents in build sessions.**
- **One story per session.** Build the first story by `priority` whose `passes` is not `true` (`jq -r '[.userStories[] | select(.passes != true)] | sort_by(.priority) | .[0].id' scripts/ralph/prd-001-arcade.json`), then STOP (step 5). The priority order is the dependency order; review fix stories (`P001A-RVW-n`) come after US-022k.
- **Re-verify every anchor** by reading it before relying on it.

## Commits

- `git commit -s` (DCO) on EVERY commit; `feat(prd-001): <story id> — <title>` (or fix/test/docs/chore), **every story commit ends with ` [skip ci]`**, evidence in the body.
- **No commit message ever contains `[eas skip]`, `[skip eas]` or `[no eas]`** (they skip delivery, and GitHub's squash message lists every commit; the gate checks each one).
- Stage explicit paths only (`git add <path> …`): NEVER `git add -A`, `.`, `-u` or `-f`; never `git stash`; never amend, rebase, cherry-pick, merge or switch branches. `git status --short` before each commit; account for every line. Binary files (the fonts) are staged by their exact paths.

## Hard NOs

- NO file outside KA1-FILES. NO dependency, `package*.json`, `eas.json` or `.eas` change; NO `app.json` change but US-022d's three font entries. NO pushing, PRs or merges (the runner pushes `origin feat/a8-arcade` as a backup and opens the draft PR when the wave completes).
- NO edit to `src/styles/ai-label.tsx`, `src/core/**`, `src/api/**`, `src/navigation/routes.ts`, another font family. NO breaking change to a primitive's props, to `useTokens()`'s type or to any export outside `src/styles/`.
- NO weakening, skipping or deleting a test, lint rule or check (a style-list test that loops over the styles gains Arcade; it never loses an assertion); no inline lint disable without a one-line reason.
- NO behaviour change to chat, the Command Centre, voice or push: Arcade reuses A2's thread, cards, composer and `sendMessage`, A3's screens and A6's `useQuickAsk`, and dresses them.

## Per-iteration protocol

1. Pick the story (the jq line above). Read its sources (HUD's files, the kit at the pin, the handoff) and the files it changes, fresh.
2. Implement it with its tests; run its checks until green (typecheck, lint, vitest at least; US-022d adds `npx expo config --type introspect`; US-022k all of `localChecks.allowed`).
3. Commit the story (signed, ` [skip ci]`).
4. Mark it in `scripts/ralph/prd-001-arcade.json`: APPEND ` → DONE — <evidence>` to each AC, set `passes` to `true`, add one line to `notes` after ' | ' (every `SEAM EDIT: <path> — <why>`, every `FOUNDATION GAP:`, the `ARCADE_STAND_IN` lines left and their owner stories (US-022a), the counters that show (US-022g), every `PRD-268 SEAM OPEN: <brief|suggestions|approvals>` (US-022k)); `jq . scripts/ralph/prd-001-arcade.json >/dev/null`; commit that file alone (signed, ` [skip ci]`).
5. **STOP.** Unless that was the wave's last story, end your reply with `STORY_DONE <story id>` as its last line. **RALPH_COMPLETE, RALPH_BLOCKED and STORY_DONE are sentinels the runner reads on your LAST line only (≤ 80 characters): never write them anywhere else.**

## Completion

- **Every story `passes: true`:** run `bash scripts/ralph/acceptance-prd001-arcade.sh --no-ci`; fix what is red in signed ` [skip ci]` commits (a gate check that is itself wrong is not yours to loosen: report it and stop with BLOCKED); then ONE signed commit WITHOUT `[skip ci]`, the wave's CI commit: `git commit -s --allow-empty -m "chore(prd-001): A8 Arcade built, run CI"`, and reply with `RALPH_COMPLETE` as the last line.
- **Already built and tested:** every story `passes: true` and the last commit touching anything outside `scripts/ralph/` is that CI commit, or a commit without `[skip ci]` whose ci.yml run completed green (`gh run list --branch feat/a8-arcade --workflow ci.yml --limit 5 --json headSha,status,conclusion`): make NO commit; reply `RALPH_COMPLETE` and nothing else.
- **A story cannot be built without breaking a Hard NO** (it truly needs a dependency, a native change beyond US-022d's fonts, an edit outside KA1-FILES no adapter can replace), or **the base move left a conflict or a broken tip**: one line of why and the evidence, then `RALPH_BLOCKED` as the last line. The tip must stay green.
