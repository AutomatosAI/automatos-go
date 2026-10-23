# Ralph Build Prompt — Automatos Go, PRD-001 wave A0+A1: the foundation

You are building **the Automatos Go foundation**, ONE story per session, unattended: every story gets a fresh session. Branch **`feat/a0-a1-foundation`**, in its own worktree, cut from `origin/docs/prd-001-automatos-go-v1` (the PRD's branch, PR #2). One PR for the whole wave and one CI run at the end: nothing in a story waits on CI.

This is a **React Native / Expo SDK 54 app**. There is NO browser, NO simulator and NO device in this loop.

- The base for every diff and check is what `bash scripts/ralph/acceptance-prd001-foundation.sh --print-base` prints.
- **Never merge anything into this branch.** Integration is the owner's job.
- Two other kits (A2 chat, A3 Command Centre) will start from this branch and run **in parallel, file-disjoint**. That only works if THIS wave builds every shared piece exactly where the JSON says (decision K5). A shared contract that is missing here forces them into workarounds.

## Read first, every iteration

1. `scripts/ralph/prd-001-foundation.json` is the BINDING contract: its `decisions` (D-* from PRD-001, K-* this kit's), each story's `acceptanceCriteria`, `files` and `notes`, and `references` (absolute paths to everything below).
2. `docs/prd/PRD-001-AUTOMATOS-GO-V1.md` — §4.1–§4.6 and §4.11 at least; the section your story names.
3. `CLAUDE.md` once US-001 has written it.
4. The story's sources, READ ONLY:
   - the academy template `/Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-academy-app/testflight-main`;
   - automatos-ai `/Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/core-pin-630fc1c85` @ `630fc1c85` (vendoring source, route manifest, fonts, brand mark, the server code the digests cite);
   - the digests `/Users/gkavanagh/Development/Automatos-AI-Platform/reports/mobile-review-2026-10-20/digests/*.md` (wire formats and endpoint shapes, verified 20 Oct);
   - the Studio design handoff `/Users/gkavanagh/Development/Automatos-AI-Platform/DUMPING AREA/design_handoff_automatos_mobile/README.md` (and `_ds/…/tokens/`).
   Never edit, copy a file into, run anything in, or `git` anything inside those paths. Copy FROM them into this worktree only.
5. The neighbours of whatever you touch (they may have changed in an earlier iteration). **Mirror the house idiom**: once a pattern exists here (the client, a schema, a test style), follow it — never a second pattern for a solved problem.

## Local checks: what may run on this machine

CI is the gate (once per wave). Locally, ONLY pure-Node checks run — the academy's practice, written into CLAUDE.md by US-001:
`npm install --ignore-scripts` / `npm ci --ignore-scripts` and `npx expo install <pkg>` (dependency stories only), `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run check:bundle` (expo export --platform ios — compiles the JS bundle, no native build), `npx expo-doctor`, `npx expo config --type introspect`, `npm run check:core`, `npm run check:routes`, `npx tsx scripts/sync-core.ts …` (US-003a/b/US-004c), `uvx --from 'fonttools[woff]' fonttools …` (US-002d), `sips` / `uvx --with pillow python …` (US-002e), `npm view <pkg>@<v> peerDependencies`, and `bash scripts/ralph/acceptance-prd001-foundation.sh --no-ci`.

**NEVER:** `expo start`, `expo run:*`, `expo prebuild` (it writes ios/ and android/), ANY `eas` command (init, build, update, env, credentials, submit), a simulator or emulator, Metro's dev server, any server, `gh workflow run`, `git push`, opening a PR, `pip install`/`brew install` (ephemeral `uvx` only). Use Node 22 (`node -v`); never change the machine's global setup.

Write the tests each AC names (`__tests__/` beside the module, vitest, `.test.ts`, node environment — no React renderer: keep components thin and test their pure helpers). Run the checks your story lists and fix what is red BEFORE committing. Never claim a check passed that you did not see pass in this session.

## Code rules (PRD-001 §4.11; the lint config enforces them from US-004c on)

- One way in: HTTP only through `src/api/` (`expo/fetch` only in `src/api/transport.ts`); zod at every boundary; unknown fields and frames ignored, never a crash.
- Files 200–400 lines (never over 800); functions under 50 lines, components under 150; nesting under 4; complexity under 10.
- Pure logic outside React with tests; screens and hooks only wire. Immutability: return new objects; never mutate props, query data or arguments.
- No hardcoded values: EAS env (`EXPO_PUBLIC_*`) or the discovery document for URLs and keys; named constants for tunables; copy in one `strings.ts` per feature.
- Tokens only, never literal colours (outside `src/styles/tokens/`; the AI label has no colours of its own since D73). 11 pt minimum; Dynamic Type stays on.
- Errors never swallowed: the taxonomy in `src/api/errors.ts` and user copy that leaks no internals; `src/lib/logger.ts` is the only console user.
- `src/core/web/**` is written ONLY by `scripts/sync-core.ts`. If vendored code does not typecheck, fix the shims or the manifest, never the copy.
- No WebView. No sign-up, no social sign-in, no Sign in with Apple. Nothing about plans, credits or prices. Nothing that deletes an account or a workspace.
- No secrets anywhere: no Clerk key, no token, no EAS project id in any file. `.env.example` has names and empty values only.

## The execution contract

- **This session ends when your turn ends.** Never end it with background work; never ScheduleWakeup; never "pick up later". Wait in the foreground for everything you start (npm install, expo export, expo-doctor, a reviewer agent).
- **A review runs in the FOREGROUND, before the commit, only where an AC asks for one** (US-004b, US-005a, US-005c: the security-reviewer agent on the named paths). Wait for it; fix HIGH/CRITICAL in the same story. No other story spawns a reviewer.
- **One story per session.** Build the first story (by `priority`) whose ACs are not all DONE, then STOP (step 4), even if time remains. The JSON's priority order is the dependency order.
- **Re-verify every anchor** (a file, an export, a line the notes name) by reading it before you rely on it: notes were measured on 20 Oct and code moves.
- **Dependencies:** only US-001, US-002a, US-003a (tsx) and US-004b (the TanStack persister packages) add dependencies. Every other story leaves package.json and package-lock.json alone; if a story truly needs a package, take the smaller path without it, or stop with BLOCKED and say which package and why.

## Commits

- `git commit -s` (DCO) on EVERY commit; message `feat(prd-001): <story id> — <title>` (or `fix(prd-001):`, `test(prd-001):`, `docs(prd-001):`, `chore(prd-001):`), and **every story commit ends with ` [skip ci]`**. Put the evidence in the body (test names added, checks run and their result).
- Stage explicit paths only (`git add <path> …`). NEVER `git add -A`, `git add .`, `git add -u` or `git add -f`; never `git stash`; never amend or rebase; never `git checkout`/`switch` away from this branch. Run `git status --short` before each commit and account for every line (node_modules, .expo/ and coverage/ must never be staged).
- Binary files (fonts, PNGs) are produced by the commands in their story and copied with `cp`, never opened and rewritten by an editor.

## Hard NOs

- NO pushing, NO PRs, NO merges (the runner pushes `origin feat/a0-a1-foundation` as a backup and opens the draft PR at completion). Never touch `main` or any other branch.
- NO edit to `.github/workflows/malware-scan.yml`. NO weakening, skipping or deleting a test, a lint rule or a CI step to get green (an inline disable needs a one-line reason and is a last resort).
- NO EAS (`eas *`), NO `expo prebuild`, NO committed `ios/` or `android/` directory, NO credentials, NO `.env` file.
- NO building US-006 (pairing / Connect to your own server), US-007's consent sheet, push (A4), styles beyond Studio (A5) or voice (A6): leave the seams the JSON names, nothing more.
- NO edit inside the READ ONLY reference paths. NO invented "recorded" corpus file (K10).

## Per-iteration protocol

1. Pick the first story (by `priority`) with ACs not yet DONE. Read its sources and neighbours fresh.
2. Implement it with its tests; run the story's checks until green.
3. Commit the story (signed, ` [skip ci]`).
4. Mark it in `scripts/ralph/prd-001-foundation.json`: APPEND to each AC string ` → DONE — <evidence: files, test names, check results>`, set `passes` to `true` and write one line in `notes` (keep the original notes text, add yours after ' | '). Validate with `jq . scripts/ralph/prd-001-foundation.json >/dev/null`. Commit that file alone (signed, ` [skip ci]`).
5. **STOP.** Unless that was the last story, end your reply with `STORY_DONE <story id>` as its last line. **The words RALPH_COMPLETE, RALPH_BLOCKED and STORY_DONE are sentinels the runner reads on your LAST line only (≤ 80 characters): never write them anywhere else in a reply, not even in a sentence about them.**

## Completion

- **All stories `passes: true`:** run `bash scripts/ralph/acceptance-prd001-foundation.sh --no-ci`; fix what is red in signed ` [skip ci]` commits (a gate check that is itself wrong is NOT yours to loosen: report it and stop with BLOCKED); then make ONE signed commit WITHOUT `[skip ci]` — `git commit -s --allow-empty -m "chore(prd-001): A0+A1 foundation built, run CI"` — and reply with `RALPH_COMPLETE` as the last line.
- **Already built and tested:** if every story is `passes: true` and the last commit that touches anything outside `scripts/ralph/` is that CI commit, OR is a commit without `[skip ci]` whose ci.yml run completed green (`gh run list --branch feat/a0-a1-foundation --workflow ci.yml --limit 5 --json headSha,status,conclusion`), make NO commit at all: reply `RALPH_COMPLETE` and nothing else.
- **A story cannot be built without breaking a Hard NO or a decision** (a native module that cannot be installed for SDK 54, a package with no compatible version, a check that cannot pass without EAS): reply with one line of why and the evidence, then `RALPH_BLOCKED` as the last line. The tip must stay green. Use it for a real contradiction only; a judgement call takes the smaller change and says so in the DONE mark.
