# Ralph Build Prompt — Automatos Go, PRD-001 wave A7: Release (store duties and release hardening)

You are building **the A7 release wave**, ONE story per session, unattended: every story gets a fresh session. Branch **`feat/a7-release`**, in its own worktree, cut from **`origin/main` after every earlier app wave merged** (A0+A1 foundation, A1 connect, A2 chat, A3 Command Centre, A4 push, A5 styles, A6 voice). One PR for the wave and one CI run at the end: nothing in a story waits on CI.

This is a **React Native / Expo SDK 54 app**. There is NO browser, NO simulator and NO device in this loop. **Native always: no WebView anywhere.** This wave runs **last and alone**: its job is to AUDIT and HARDEN the whole merged app for internal TestFlight at WebSummit (10–12 Nov) and for App Store / Google Play review afterwards.

- The base for every diff and check is what `bash scripts/ralph/acceptance-prd001-release.sh --print-base` prints.
- **Every seam in the json was written on 21 Oct, before the earlier waves were built: RE-VERIFY ON THE MERGED BASE** — read the real file, export and behaviour before you rely on it, and say in the DONE mark what you found when it differs (KR2).
- **Never merge anything into this branch.**

## Your files (KR1, gate-enforced)

- **Create or change freely:** `src/release/**`, `src/observability/**`, `src/storage/secure-registry.ts` (new), `docs/release/**`, `scripts/release/**`, `scripts/__tests__/release-*.test.ts`, `.github/workflows/push-security.yml` (new), and this kit's own files under `scripts/ralph/`.
- **Seam files** — each edit recorded in that story's DONE notes as `SEAM EDIT: <path> — <why>`: `app/_layout.tsx`, `app/(app)/settings/index.tsx`, the Welcome screen file, `scripts/check-release-env.js`, `scripts/__tests__/check-release-env.test.ts`, `app.json` (KR3 keys only), `src/config/__tests__/app-config.test.ts`, `CLAUDE.md`, `README.md`.
- **Audit fixes** — any OTHER file under `src/` or `app/` may change ONLY to fix a finding of this wave's audits, recorded as `AUDIT FIX: <path> — <finding>`, with a test that would have caught it (KR5). A finding too large for the session becomes an appended story `P001R-AF-n` (KR5's shape), committed with the marks.
- **NEVER:** `src/core/**` (vendored; `scripts/sync-core.ts` only), `core.lock.json`, `scripts/core-manifest.json`, `src/styles/ai-label.tsx`, `assets/**`, `package.json`, `package-lock.json`, `eas.json`, `.github/workflows/{ci,testflight,malware-scan}.yml`.
- **app.json (KR3):** only `expo.ios.privacyManifests` and `expo.android.allowBackup`, only in US-021f, only where the merged base lacks them. That commit's body starts `NATIVE CHANGE:` — the merge costs one iOS build.

## Read first, every iteration

1. `scripts/ralph/prd-001-release.json` is the BINDING contract: `decisions` (D-* from PRD-001 and Gerard's decisions, KR* this kit's), `references.requirements` (R01–R23), each story's ACs, `files`, `seams` and `notes`, `ownerTest`.
2. `docs/prd/PRD-001-AUTOMATOS-GO-V1.md` §4.1, §4.4, §4.5, §4.7, §4.10, §4.11, US-021, §8; `CLAUDE.md`.
3. **The merged app — read the actual files, not the json's memory of them:** the files each story's `seams` name, and the earlier waves' kit json files in `scripts/ralph/` (`prd-001-{foundation,connect,chat,cc,push,styles,voice}.json`) for what each story promised and its DONE notes (FOUNDATION GAP, SEAM EDIT, judgement calls).
4. The story's references, READ ONLY (never edit anything there): `/Users/gkavanagh/Development/Automatos-AI-Platform/reports/mobile-review-2026-10-20/decisions.md`, `…/drafts/privacy-policy-automatos-go.md` (Appendix A), `…/drafts/terms-automatos-go.md`, `…/critic-store-policy.md`, `…/critic-security-privacy.md`, `…/critic-ops-release.md`; the backend W3 kit `/Users/gkavanagh/Development/Automatos-AI-Platform/automatos-ai/scripts/ralph/prd-266w3.json`; the automatos-ai worktree `/Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/mobile-review-main` through `git -C <path> fetch -q origin` and `git -C <path> show origin/main:<file>` only.
5. Your own earlier stories' files: mirror the idiom you already set; never a second pattern.

## Local checks

Allowed (pure Node, the repo's CLAUDE.md rule): `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run check:bundle`, `npm run check:core`, `npm run check:routes`, `npx --yes expo-doctor`, `npx --no-install expo config --type introspect`, `node scripts/release/*.mjs` against fixtures (never against a real service), `bash scripts/ralph/acceptance-prd001-release.sh --no-ci`. In US-021n ONLY: one `curl -fsSL https://raw.githubusercontent.com/expo/eas-cli/main/packages/eas-cli/graphql.schema.json -o <scratch file>` (never committed).
**NEVER:** `npm install`, `npx expo install` or any dependency change; `expo start`, `expo run:*`, `expo prebuild`; any `eas` command, eas-cli included; a simulator, an emulator, Metro's dev server or any server; any request to Sentry, Expo, App Store Connect, Play Console or Clerk; `gh workflow run`; `git push`; opening a PR; `git merge`. Never claim a check passed that you did not see pass.

## Code rules

- **Audits are tests (KR4).** Every store requirement the code can prove is a vitest test that reads the repository (`src/release/__tests__/*.test.ts`, `scripts/__tests__/release-*.test.ts`), so CI enforces it on every later PR. App-wide audits read the WHOLE product tree (src/ and app/, excluding `src/core/web/**`, tests and fixtures) through `src/release/__tests__/support/tree.ts`. They may be red on the base: making them green is the story. **Never weaken an audit to pass**; a true negative is an `ALLOWED` entry with file, text and reason.
- **Pure modules never import `react`, `react-native`, `expo-*` or `@sentry/react-native`** (type-only imports excepted), so vitest can load them. `src/observability/index.ts` is the only importer of `@sentry/react-native`. Inject dependencies; test with fakes; `vi.mock` only for native modules.
- **Crash reporting (KR7) is fixed policy:** EU DSN only, the user's switch (default on), `sendDefaultPii: false`, never `setUser`, no tracing, no screenshots, view hierarchy or replays, no `Sentry.wrap`, scrubbed events and breadcrumbs.
- **Secrets:** no password, token, key or real account in any file — the review notes use placeholders that say 'in App Store Connect only'. **File names the secrets hook blocks** (it matches the path, not the content): never `*.env`, `*.env.*`, `*/credentials*`, `*/secrets/*`, `*/secret/*`, `*.pem`, `*.key`, `*_rsa*`, `*/service-account*.json`, `*/sa-key*.json`. Never work around the hook; a story that seems to need such a path stops `RALPH_BLOCKED`.
- **Copy:** in `src/release/strings.ts`; nothing about plans, credits or prices (D8); no pointer to creating an account (D64); no deletion (D63); never 'nothing leaves your server' or anything as broad (D70); one minimum age, 16 (D12). Plain words, no hype.
- **Scripts** (`scripts/release/*.mjs`) are Node 22 with no dependency; they write through `process.stdout` / `process.stderr` (the foundation's no-console rule holds everywhere but `src/lib/logger.ts`); if its no-fetch rule lints `scripts/`, use `node:https`. `eslint.config.js`, `tsconfig.json` and `vitest.config.ts` are not this kit's files.
- Tokens only (no colour literal outside `src/styles/tokens/`), text ≥ 11 pt with Dynamic Type, every colour status has a word, Reduce Motion respected. HTTP only through the foundation's client (scripts excepted); zod at every boundary. Immutability. Files 200–400 lines (never over 800), functions under 50, components under 150, nesting under 4.
- **Owner steps (KR6):** an AC that starts `OWNER —` is a human step: write the exact text or values it needs under `docs/release/` and mark it `→ OWNER — <doc path> (OT-Rn)`, never DONE.

## The execution contract

- **This session ends when your turn ends.** Never end it with background work; never ScheduleWakeup; never "pick up later". Wait in the foreground for everything you start.
- **No reviewer agents in build sessions, except** where an AC names the security-reviewer (US-021b, US-021j, US-021n): run it in the FOREGROUND and wait for it before committing.
- **One story per session.** Build the first story (by `priority`) whose ACs are not all marked, then STOP (step 5). The priority order is the dependency order; appended `P001R-AF-n` stories come after the story that found them.
- **Re-verify every anchor** by reading it before relying on it.

## Commits

- `git commit -s` (DCO) on EVERY commit; `feat(prd-001): <story id> — <title>` (or fix/test/docs/chore), **every story commit ends with ` [skip ci]`**, evidence in the body. US-021f's commit body starts `NATIVE CHANGE:` when app.json changed.
- Stage explicit paths only (`git add <path> …`): NEVER `git add -A`, `.`, `-u` or `-f`; never `git stash`; never amend, rebase, cherry-pick, merge or switch branches. `git status --short` before each commit; account for every line.

## Hard NOs

- NO file outside KR1's lists; NO seam or audit-fix edit without its note. NO dependency change. NO app.json change outside KR3. NO pushing, PRs or merges (the runner pushes `origin feat/a7-release` as a backup and opens the draft PR at completion).
- NO edit to `src/core/**`, `src/styles/ai-label.tsx`, `assets/**`, `eas.json` or the three foundation workflows.
- NO weakening, skipping or deleting a test, lint rule or check (an earlier wave's included); no inline lint disable without a one-line reason.
- NO new feature: push, voice, styles, chat and Command Centre behaviour belong to their waves; this wave audits them and fixes findings. NO store submission, EAS build or update, Sentry or Expo dashboard change, backend change (KR16).

## Per-iteration protocol

1. Pick the first story (by `priority`) with ACs not yet marked. Read its sources and RE-VERIFY its seams on the merged base, fresh.
2. Implement it with its tests; run its checks until green.
3. Commit the story (signed, ` [skip ci]`).
4. Mark it in `scripts/ralph/prd-001-release.json`: APPEND ` → DONE — <evidence>` to each AC (or ` → OWNER — <doc path> (OT-Rn)` to each `OWNER —` AC), set `passes` to `true`, add one line to `notes` after ' | ' (every `SEAM EDIT:`, every `AUDIT FIX:`, every RE-VERIFY difference, every appended `P001R-AF-n`); `jq . scripts/ralph/prd-001-release.json >/dev/null`; commit that file alone (signed, ` [skip ci]`).
5. **STOP.** Unless that was the last story, end your reply with `STORY_DONE <story id>` as its last line. **RALPH_COMPLETE, RALPH_BLOCKED and STORY_DONE are sentinels the runner reads on your LAST line only (≤ 80 characters): never write them anywhere else.**

## Completion

- **All stories `passes: true`:** run `bash scripts/ralph/acceptance-prd001-release.sh --no-ci`; fix what is red in signed ` [skip ci]` commits (a gate check that is itself wrong is not yours to loosen: report it and stop with BLOCKED); then ONE signed commit WITHOUT `[skip ci]` — `git commit -s --allow-empty -m "chore(prd-001): A7 release built, run CI"` — and reply with `RALPH_COMPLETE` as the last line.
- **Already built and tested:** every story `passes: true` and the last commit touching anything outside `scripts/ralph/` is that CI commit, or a commit without `[skip ci]` whose ci.yml run completed green (`gh run list --branch feat/a7-release --workflow ci.yml --limit 5 --json headSha,status,conclusion`): make NO commit; reply `RALPH_COMPLETE` and nothing else.
- **A story cannot be built without breaking a Hard NO** (it truly needs a dependency, a native change outside KR3, a forbidden file, or a path the secrets hook blocks): one line of why and the evidence, then `RALPH_BLOCKED` as the last line. The tip must stay green.
