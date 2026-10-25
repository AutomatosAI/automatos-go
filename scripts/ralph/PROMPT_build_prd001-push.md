# Ralph Build Prompt — Automatos Go, PRD-001 wave A4: Push

You are building **the A4 push wave** (US-014 registration and settings, US-015 actions from the notification), ONE story per session, unattended: every story gets a fresh session. Branch **`feat/a4-push`**, in its own worktree, cut from `origin/feat/a0-a1-foundation`. One PR for the wave and one CI run per phase at the end: nothing in a story waits on CI.

This is a **React Native / Expo SDK 54 app**. There is NO browser, NO simulator, NO device and NO push service in this loop. **This wave is JavaScript only** (no dependency, no native module, no app.json change) and **native always: no WebView anywhere**. It builds against the **PRD-266 W2 kit's contract** (W2 is written, not built): every W2 seam in the json is marked RE-VERIFY after W2.

- The base for every diff and check is what `bash scripts/ralph/acceptance-prd001-push.sh --print-base` prints.
- **The current phase** is what `bash scripts/ralph/acceptance-prd001-push.sh --print-phase` prints (KP3): `1` while the A1 connect, A2 chat and A3 Command Centre code is not in this branch, `2` once it is.
- **Never merge anything into this branch.** The phase-2 base move is the launcher's (`RALPH_BASE_MOVE=1`) or the lead's, never a build session's.

## Your files — and nobody else's (KP1, gate-enforced)

**Phase 1** may create or change ONLY: `src/push/**`, `src/step-up/**`, `app/(app)/settings/notifications.tsx`, and this kit's own files under `scripts/ralph/`. It runs beside the A1 connect, A2 chat, A3 Command Centre and A5 styles kits and never touches a file they own or edit: `src/api/**`, `src/auth/**`, `src/core/**`, `src/ui/**`, `src/styles/**` (never `src/styles/ai-label.tsx`), `src/storage/**`, `src/navigation/**`, `src/app-state/**`, `src/lib/**`, `src/connect/**`, `src/consent/**`, `src/session/**`, `src/chat/**`, `src/cc/**`, `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(app)/index.tsx`, `app/(app)/chat/**`, `app/(app)/chats.tsx`, `app/(app)/cc/**`, `app/(app)/settings/index.tsx`, `app/(app)/settings/style.tsx`, `app/(app)/settings/look/**`.
**Phase 2** adds, for mounting and wiring only: `app/(app)/_layout.tsx`, `app/(app)/settings/index.tsx`, `src/lib/secure-keys.ts` (only if the registry takes a static list) (US-014h); `src/connect/components/ServerSection.tsx`, `src/connect/switch.ts` (US-014i); `src/chat/cards/**`, `src/cc/questions/**`, `src/cc/ticket/**`, `src/cc/social/**`, `src/chat/__tests__/`, `src/cc/__tests__/` (US-015e).
Never: `package.json`, `package-lock.json`, `app.json`, `eas.json`, `.github/**`, `scripts/*` outside `scripts/ralph/`, `src/core/**`, `src/navigation/routes.ts` (this wave's own path lives in `src/push/nav.ts`).

**Seams (KP2):** a foundation contract that is missing or wrong → the smallest adapter under `src/push/` and `FOUNDATION GAP: <what, where>` in the DONE notes; never edit a foundation file. Every phase-2 edit of another kit's file is recorded in that story's DONE notes as `SEAM EDIT: <path> — <why>` (the gate checks it), touches only the lines the story names, and keeps that kit's tests passing unchanged (an extended test file never has fewer cases).

## Read first, every iteration

1. `scripts/ralph/prd-001-push.json` is the BINDING contract: `decisions` (D-* from PRD-001 and Gerard's Q&A, KP* this kit's), each story's ACs, `files`, `phase` and `notes`, `references`, `dependencies`, `openQuestions`.
2. `docs/prd/PRD-001-AUTOMATOS-GO-V1.md` §4.4, §4.6, §4.7 (Settings), §4.8, §4.11 and Wave A4; `CLAUDE.md`.
3. **The foundation you build on — read the actual files, not your memory; every contract marked RE-VERIFY was written before the foundation was built:** `src/api/` (client, errors, strings, config, routes, discovery, capabilities, workspace, query-keys, query-client, needs-you, live, auth-headers), `src/auth/role.ts`, `src/auth/strings.ts`, `src/auth/providers/types.ts`, `src/auth/token-cache.ts` and `src/lib/secure-keys.ts` (the ONE secure-storage key registry), `src/storage/mmkv.ts`, `src/lib/logger.ts`, `src/navigation/routes.ts`, `src/ui/` (index.ts; Sheet, Toast), `src/styles/` (tokens, theme, type), `app/(app)/_layout.tsx`, `app/(app)/settings/index.tsx`, `scripts/check-routes.ts`, `eslint.config.js`. `scripts/ralph/prd-001-foundation.json` says what each foundation story promised and its DONE notes record any gap.
4. **The installed module typings are the API** (never assume a newer one): `node_modules/expo-notifications/build/*.d.ts` (0.32.17), `node_modules/expo-local-authentication/build/*.d.ts`, `node_modules/expo-crypto/build/Crypto.d.ts`, `node_modules/expo-secure-store`, `expo-localization`, `expo-constants`.
5. **The backend contract, READ ONLY** (never edit, check out, stash or fetch there): the W2 kit `/Users/gkavanagh/Development/Automatos-AI-Platform/automatos-ai/scripts/ralph/prd-266w2.json` (K7, K8, K9, K12–K15; US-009, US-010c, US-011a, US-013, US-014a, US-014b); W1's committed code with `git -C /Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/feat+prd-266-w1-connect show feat/prd-266-w1-connect:<path>` (`orchestrator/api/mobile_devices.py`, `orchestrator/services/mobile/devices.py`, `orchestrator/core/models/mobile_devices.py`); main's server files at `/Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/mobile-review-main` (`orchestrator/api/approval_grants.py`, `orchestrator/api/notifications.py`, `orchestrator/api/workspaces.py`, `frontend/components/notifications/notification-bell.tsx`). W2's own code, when it exists: `git -C <mobile-review-main> show <ref>:<path>` for ref `feat/prd-266-w2-push`, then `origin/feat/prd-266-w2-push`, then `origin/main` (KP5). Never the stale `automatos-ai/` checkout's working tree.
6. **Phase 2 only:** the merged A1 connect, A2 chat and A3 Command Centre code in this branch (`src/connect/**`, `src/chat/**`, `src/cc/**`, `app/(app)/_layout.tsx`, `app/(app)/settings/index.tsx`) and their kit json files (`scripts/ralph/prd-001-connect.json`, `prd-001-chat.json`, `prd-001-cc.json`) with their DONE notes.
7. Your own earlier stories' files: mirror the idiom you already set; never a second pattern.

## Local checks

Allowed (pure Node, the repo's CLAUDE.md rule): `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run check:bundle`, `npm run check:core`, `npm run check:routes`, `bash scripts/ralph/acceptance-prd001-push.sh --no-ci`; `node -e` with `node:crypto` to cross-check US-015a's published v2 cases; read-only `git show` on the automatos-ai worktrees named above.
**NEVER:** `npm install`, `npx expo install` or any dependency change; `expo start`, `expo run:*`, `expo prebuild`; any `eas` command; a simulator, Metro's dev server or any server; a request to a real server or to Expo's push service; `gh workflow run`; `git push`; opening a PR; `git merge`. Write the tests each AC names (`src/push/__tests__/*.test.ts`, `src/step-up/__tests__/*.test.ts`, vitest, node — there is no React renderer: keep components thin and test their pure models). **Pure modules never import `react`, `react-native` or `expo-*`**: each native module has ONE adapter file (expo-notifications → `src/push/platform/expo.ts`; expo-crypto → `src/push/signature/sha256-native.ts`; expo-secure-store → `src/push/registration/key-store.ts`; expo-local-authentication → `src/step-up/step-up.ts`) and every other module takes a port that tests fake. Never claim a check passed that you did not see pass.

## Code rules

- **Verify before acting (D-SIGNATURE, KP6: signature v2).** Nothing posts, navigates into a link or marks anything read for a push whose sig does not verify with this phone's push_key over the canonical v2 message (every payload field but sig), whose v is not 2, or whose iat is more than PUSH_SIG_MAX_AGE_SECONDS (7 days) old or PUSH_SIG_MAX_FUTURE_SECONDS (5 minutes) ahead. The app still acts only in its current workspace and still checks a link for staleness (KP9). ONE shared vector file, W2's, copied byte for byte (US-015a); never a second one.
- **The lock screen (D-LOCK-SCREEN, KP7):** categories offer 'Reply…' (unlock required) and 'Open' only; every action opens the app; no Approve or option button; no local notification (`scheduleNotificationAsync`), no background task (`registerTaskAsync`).
- **Secrets (KP18):** the push key and the Expo token live in ONE expo-secure-store item, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, under a key declared in the ONE secure-storage key registry (`src/lib/secure-keys.ts`); never in MMKV, the query cache, a log, a toast, Sentry or a breadcrumb. **Logs carry kinds and counts only**: never a notification's title, body, question, options or sig, a reply, the push key or the token (the logger-spy tests prove it); nothing in the wave imports `@sentry/react-native`.
- **Honest copy (KP8, D-DATA-CLAIMS, D-NO-SIGNUP, D-NO-BILLING):** the answer result never says 'resuming'; no 'nothing leaves your server' or anything broader; no pointer to creating an account; nothing about plans, credits or prices. Copy lives in `src/push/strings.ts` and `src/step-up/strings.ts`.
- **Permission in context (KP11):** `requestPermissionsAsync` is called only from `src/push/registration/permission.ts`, and only from a person's tap.
- **The AI label (D-AI-LABEL):** never edited, never restyled; this wave adds no composer.
- **File names the secrets hook blocks** (it matches the path, not the content): never `*.env`, `*.env.*`, `*/credentials*`, `*/secrets/*`, `*/secret/*`, `*.pem`, `*.key`, `*_rsa*`, `*/service-account*.json`, `*/sa-key*.json`. The push key's store is `key-store.ts`; never name a file `credentials.ts` or a folder `secrets/`. Never work around the hook.
- HTTP only through the foundation's client with the route table `src/push/routes.ts`; zod at every boundary; unknown fields ignored. Immutability. Tokens only, text ≥ 11 pt, every state in words. Files 200–400 lines (never over 800), functions under 50, components under 150, nesting under 4. No second needs-you number (read `useNeedsYou()`), no second live connection, no second install id.

## The execution contract

- **This session ends when your turn ends.** Never end it with background work; never ScheduleWakeup; never "pick up later". Wait in the foreground for everything you start.
- **No reviewer agents in build sessions, except** where an AC names the security-reviewer (US-015a, US-014c, US-015d, US-014i): run it in the FOREGROUND and wait for it before committing.
- **One story per session.** Build the first story (by `priority`) whose `phase` is at most the current phase and whose ACs are not all DONE, then STOP (step 5). The priority order is the dependency order.
- **Re-verify every anchor** (a foundation export, a W1 line, a W2 AC) by reading it before relying on it; when it differs from the json, follow the code and say what changed in the DONE mark.

## Commits

- `git commit -s` (DCO) on EVERY commit; `feat(prd-001): <story id> — <title>` (or fix/test/docs/chore), **every story commit ends with ` [skip ci]`**, evidence in the body.
- Stage explicit paths only (`git add <path> …`): NEVER `git add -A`, `.`, `-u` or `-f`; never `git stash`; never amend, rebase, cherry-pick, merge or switch branches. `git status --short` before each commit; account for every line.

## Hard NOs

- NO file outside KP1's list for the current phase. NO dependency, native, app.json or eas.json change: option buttons on the lock screen, Android FCM and a notification icon are native and are open questions, never built here.
- NO pushing, PRs or merges (the runner pushes `origin feat/a4-push` as a backup and opens the draft PR when a phase completes).
- NO weakening, skipping or deleting a test, lint rule or check; no inline lint disable without a one-line reason.
- NO chat or Command Centre behaviour (A2, A3: phase 2 wraps their gated writes with the step-up gate and nothing else), no styles (A5), no voice (A6), no pairing or consent (A1).

## Per-iteration protocol

1. Read the current phase (`--print-phase`). Pick the first story (by `priority`) with `phase` <= the current phase and ACs not yet DONE. Read its sources and the files it uses, fresh.
2. Implement it with its tests; run its checks until green.
3. Commit the story (signed, ` [skip ci]`).
4. Mark it in `scripts/ralph/prd-001-push.json`: APPEND ` → DONE — <evidence>` to each AC (the one `[W2-PENDING-OK]` criterion of US-015a takes the OWNER mark its text gives when W2's fixture is not committed), set `passes` to `true`, add one line to `notes` after ' | ' (including every `SEAM EDIT:`, `FOUNDATION GAP:` and every W2/W1 contract that differed); `jq . scripts/ralph/prd-001-push.json >/dev/null`; commit that file alone (signed, ` [skip ci]`).
5. **STOP.** Unless that was the last story of the current phase, end your reply with `STORY_DONE <story id>` as its last line. **RALPH_COMPLETE, RALPH_BLOCKED and STORY_DONE are sentinels the runner reads on your LAST line only (≤ 80 characters): never write them anywhere else.**

## Completion (per phase)

- **Every story of the current phase `passes: true`** (in phase 1 the phase-2 stories stay `passes: false` — that is not a block): run `bash scripts/ralph/acceptance-prd001-push.sh --no-ci`; fix what is red in signed ` [skip ci]` commits (a gate check that is itself wrong is not yours to loosen: report it and stop with BLOCKED); then ONE signed commit WITHOUT `[skip ci]` — `git commit -s --allow-empty -m "chore(prd-001): A4 push phase <N> built, run CI"` — and reply with `RALPH_COMPLETE` as the last line.
- **Already built and tested:** every story of the current phase `passes: true` and the last commit touching anything outside `scripts/ralph/` is that CI commit, or a commit without `[skip ci]` whose ci.yml run completed green (`gh run list --branch feat/a4-push --workflow ci.yml --limit 5 --json headSha,status,conclusion`): make NO commit; reply `RALPH_COMPLETE` and nothing else.
- **A story cannot be built without breaking a Hard NO** (it truly needs a new dependency, a native change, a foundation edit no adapter can replace, or W2's vector fails against K9's algorithm): one line of why and the evidence, then `RALPH_BLOCKED` as the last line. The tip must stay green.
