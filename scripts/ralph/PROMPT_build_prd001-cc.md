# Ralph Build Prompt — Automatos Go, PRD-001 wave A3: the Command Centre

You are building **the A3 Command Centre wave**, ONE story per session, unattended: every story gets a fresh session. Branch **`feat/a3-command-centre`**, in its own worktree, cut from `origin/feat/a0-a1-foundation`. One PR for the whole wave and one CI run at the end: nothing in a story waits on CI.

This is a **React Native / Expo SDK 54 app**. There is NO browser, NO simulator and NO device in this loop. **This wave is JavaScript only** and runs **in parallel** with the A2 chat kit on the same foundation.

- The base for every diff and check is what `bash scripts/ralph/acceptance-prd001-cc.sh --print-base` prints.
- **Never merge anything into this branch** (not the foundation's later fixes, not main).

## Your files — and nobody else's (KX1, gate-enforced)

You may create or change ONLY: `src/cc/**`, `app/(app)/cc/**` (replace the foundation's placeholders) and this kit's own files under `scripts/ralph/`. Everything else belongs to the foundation or to the A2 kit: `src/api`, `src/auth`, `src/core`, `src/styles`, `src/ui`, `src/navigation`, `src/storage`, `src/app-state`, `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(app)/index.tsx`, `app/(app)/chat/**`, `app/(app)/chats.tsx`, `app/(app)/settings/**`, `src/chat/**`, `package.json`, `package-lock.json`, `app.json`, `eas.json`, `.github/**`, `scripts/*` outside `scripts/ralph/`. **A foundation contract that is missing or wrong:** build the smallest adapter under `src/cc/` and write `FOUNDATION GAP: <what, where>` in the DONE mark (KX2). Never edit a foundation file.

## Read first, every iteration

1. `scripts/ralph/prd-001-cc.json` is the BINDING contract: `decisions` (D-* from PRD-001 and Gerard's Q&A, KX* this kit's), each story's ACs, `files` and `notes`, `references`.
2. `docs/prd/PRD-001-AUTOMATOS-GO-V1.md` §4.4, §4.6, §4.7, §4.11; `CLAUDE.md`.
3. **The foundation you build on** (read the actual files): `src/api/` (client, errors, strings, query-keys, live, needs-you, reports, workspace), `src/auth/role.ts`, `src/navigation/{routes,web-links}.ts` (the `cc.*` builders and `chatWithTicket` — your screen files must sit where the builders point), `src/ui/` (index.ts lists the primitives), `src/styles/`, and the vendored `src/core/web/` modules your story names (ticket-number, grant-owner, ticket-links, ticket-stage, ticket-kind, calendar-kinds, calendar-actions). `scripts/ralph/prd-001-foundation.json` says what each foundation story promised.
4. The story's references, READ ONLY: the digest `/Users/gkavanagh/Development/Automatos-AI-Platform/reports/mobile-review-2026-10-20/digests/command-centre-api.md` (endpoints, bodies, auth), the web's components and hooks under `/Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/mobile-review-main/frontend/` (behaviour reference), the Studio handoff `/Users/gkavanagh/Development/Automatos-AI-Platform/DUMPING AREA/design_handoff_automatos_mobile/README.md` §2 and `AutomatosApp.dc.html` — with the decisions overriding it (D25 Deliverables, D26, D27, D38). Never edit anything there.
5. Your own earlier stories' files: mirror the idiom you already set.

## Local checks

Allowed (pure Node, the repo's CLAUDE.md rule): `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run check:bundle`, `npm run check:core`, `npm run check:routes`, `bash scripts/ralph/acceptance-prd001-cc.sh --no-ci`.
**NEVER:** `npm install`, `npx expo install` or any dependency change; `expo start`, `expo run:*`, `expo prebuild`; any `eas` command; a simulator, Metro's dev server or any server; `gh workflow run`; `git push`; opening a PR. Write the tests each AC names (`src/cc/__tests__/*.test.ts`, vitest, node — keep components thin and test their pure view-models). Never claim a check passed that you did not see pass.

## Code rules

- **One set of screens** dressed by tokens (D-ONE-SET): no literal colour (the lint fails it; the vendored calendar-kinds colours are data), no style decision hard-coded in a screen, text ≥ 11 pt, every colour status has a word, Reduce Motion respected.
- HTTP only through the foundation's client with your route table `src/cc/routes.ts`; zod at every boundary; unknown fields and statuses kept with their own word, never a crash.
- Pure logic in plain TS with tests; screens and hooks only wire. Immutability. Copy in `src/cc/strings.ts`.
- Files 200–400 lines (never over 800), functions under 50, components under 150, nesting under 4.
- Writes are never queued offline; the server's answer is the truth (409s show their words). Nothing about plans, credits or prices. No WebView. No second live connection, no second needs-you number, no second report implementation. Deliverables have no review state, no Approve/Request changes and no 'DLV-' ids (D25).

## The execution contract

- **This session ends when your turn ends.** Never end it with background work; never ScheduleWakeup; never "pick up later". Wait in the foreground for everything you start.
- **No reviewer agents in build sessions** (the wave's adversarial review runs after the build).
- **One story per session.** Build the first story (by `priority`) whose ACs are not all DONE, then STOP (step 5). The priority order is the dependency order.
- **Re-verify every anchor** by reading it before relying on it.

## Commits

- `git commit -s` (DCO) on EVERY commit; `feat(prd-001): <story id> — <title>` (or fix/test/docs/chore), **every story commit ends with ` [skip ci]`**, evidence in the body.
- Stage explicit paths only (`git add <path> …`): NEVER `git add -A`, `.`, `-u` or `-f`; never `git stash`; never amend, rebase, cherry-pick or switch branches. `git status --short` before each commit; account for every line.

## Hard NOs

- NO file outside KX1's list. NO dependency, native, app.json or eas.json change. NO pushing, PRs or merges (the runner pushes `origin feat/a3-command-centre` as a backup and opens the draft PR at completion).
- NO weakening, skipping or deleting a test, lint rule or check; no inline lint disable without a one-line reason.
- NO chat screens (A2: 'Ask Auto about' only navigates to the foundation's `chatWithTicket`), push (A4), styles beyond Studio (A5), voice (A6), pairing (US-006), deletion of anything (D63), the HUD desktop pages.

## Per-iteration protocol

1. Pick the first story (by `priority`) with ACs not yet DONE. Read its sources and the foundation files it uses, fresh.
2. Implement it with its tests; run its checks until green.
3. Commit the story (signed, ` [skip ci]`).
4. Mark it in `scripts/ralph/prd-001-cc.json`: APPEND ` → DONE — <evidence>` to each AC, set `passes` to `true`, add one line to `notes` after ' | ' (including any `FOUNDATION GAP:`); `jq . scripts/ralph/prd-001-cc.json >/dev/null`; commit that file alone (signed, ` [skip ci]`).
5. **STOP.** Unless that was the last story, end your reply with `STORY_DONE <story id>` as its last line. **RALPH_COMPLETE, RALPH_BLOCKED and STORY_DONE are sentinels the runner reads on your LAST line only (≤ 80 characters): never write them anywhere else.**

## Completion

- **All stories `passes: true`:** run `bash scripts/ralph/acceptance-prd001-cc.sh --no-ci`; fix what is red in signed ` [skip ci]` commits (a gate check that is itself wrong is not yours to loosen: report it and stop with BLOCKED); then ONE signed commit WITHOUT `[skip ci]` — `git commit -s --allow-empty -m "chore(prd-001): A3 Command Centre built, run CI"` — and reply with `RALPH_COMPLETE` as the last line.
- **Already built and tested:** every story `passes: true` and the last commit touching anything outside `scripts/ralph/` is that CI commit, or a commit without `[skip ci]` whose ci.yml run completed green (`gh run list --branch feat/a3-command-centre --workflow ci.yml --limit 5 --json headSha,status,conclusion`): make NO commit; reply `RALPH_COMPLETE` and nothing else.
- **A story cannot be built without breaking a Hard NO** (it truly needs a new dependency, a native change, or a foundation edit no adapter can replace): one line of why and the evidence, then `RALPH_BLOCKED` as the last line. The tip must stay green.
