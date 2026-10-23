# Ralph Build Prompt — Automatos Go, PRD-001 wave A1 (remaining): connect, bootstrap, roles and consent

You are building **the connect wave** (US-006 connect to your own server, US-007 bootstrap, roles and consent), ONE story per session, unattended: every story gets a fresh session. Branch **`feat/a1-connect`**, in its own worktree, cut from `origin/feat/a0-a1-foundation`. One PR for the whole wave and one CI run at the end: nothing in a story waits on CI.

This is a **React Native / Expo SDK 54 app**. There is NO browser, NO simulator, NO device and NO server in this loop. **This wave is JavaScript only** (expo-camera, expo-secure-store and expo-crypto are the foundation's) and may run **in parallel** with the A2 chat and A3 Command Centre kits on the same foundation.

- The base for every diff and check is what `bash scripts/ralph/acceptance-prd001-connect.sh --print-base` prints.
- **Never merge anything into this branch** (not the foundation's later fixes, not main).

## Your files — and nobody else's (KC1, KC2, gate-enforced)

You may create or change ONLY:
- your own folders: `src/connect/**`, `src/consent/**`, `src/session/**`, `app/welcome.tsx`, `app/connect/**`, `app/go/**`, and this kit's files under `scripts/ralph/`;
- these foundation files, each ONLY for its purpose (KC2), named in the DONE mark: `src/auth/providers/registry.ts` (register 'device'), `src/auth/providers/device.ts` (new), `src/auth/AuthRoot.tsx` (not-configured blocks the hosted path only), `src/api/server.ts` (source 'own'), `src/api/discovery.ts` (K3 only for the built-in server, if needed), `src/api/errors.ts` and `src/api/client.ts` (ADDITIVE only: detail.code on a 401, the ApiError handed to the expiry callback, if missing), `src/api/workspace.ts` (ADDITIVE only: the optional `ai_providers [{id, name}]` field, if the foundation's schema lacks it), `src/app-state/**` (the gate's steps), `src/navigation/routes.ts`, `src/navigation/web-links.ts`, `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(app)/settings/index.tsx`, and the foundation tests in `src/auth/__tests__/`, `src/api/__tests__/`, `src/app-state/__tests__/`, `src/navigation/__tests__/` where your change of behaviour requires it (update, never delete, never fewer cases).

NEVER: `src/chat/**`, `app/(app)/index.tsx`, `app/(app)/chat/**`, `app/(app)/chats.tsx` (A2), `src/cc/**`, `app/(app)/cc/**` (A3), `src/core/**`, `src/ui/**`, `src/styles/**`, `src/storage/**`, any other `src/api/*.ts`, `package.json`, `package-lock.json`, `app.json`, `eas.json`, `.github/**`, `scripts/*` outside `scripts/ralph/`. **Any other foundation gap:** the smallest adapter under your folders and `FOUNDATION GAP: <what, where>` in the DONE mark; if no adapter can do it, `RALPH_BLOCKED`.

**Secrets hook:** a global hook refuses Write/Edit on any path matching `*.env`, `*.env.*`, `*/credentials*`, `*/secrets/*`, `*/secret/*`, `*.pem`, `*.key`, `*_rsa*`, `*/service-account*.json`, `*/sa-key*.json`. Name nothing that way (no `credentials.ts`, no `secrets/` folder). Never work around the hook; if a path you need is refused, rename it.

## Read first, every iteration

1. `scripts/ralph/prd-001-connect.json` is the BINDING contract: `decisions` (D-* from PRD-001 and Gerard's Q&A, KC* this kit's), `dependencies`, `repin`, each story's ACs, `files` and `notes` (the seams, each marked RE-VERIFY), `references`.
2. `docs/prd/PRD-001-AUTOMATOS-GO-V1.md` §4.4, §4.5, §4.7, §4.11, §5 US-006/US-007; `CLAUDE.md`.
3. **The foundation you build on** (read the actual files, not your memory or its json): `src/auth/providers/{types,registry,clerk}.ts`, `src/auth/{select.ts,config.ts,strings.ts,role.ts,AuthRoot.tsx,token-cache.ts}`, `src/api/{client,errors,strings,config,routes,server,discovery,capabilities,workspace,query-keys,query-client}.ts`, `src/storage/mmkv.ts`, `src/app-state/gate.ts`, `src/navigation/{routes,web-links}.ts`, `src/ui/index.ts`, `src/styles/ai-label.tsx`, `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(app)/settings/index.tsx`, `app/(auth)/`, `scripts/check-routes.ts`. `scripts/ralph/prd-001-foundation.json` says what each foundation story promised; its DONE marks record its gaps.
4. **The backend, committed state only, READ ONLY.** PRD-266 W1: `git -C /Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/feat+prd-266-w1-connect show feat/prd-266-w1-connect:<path>` (`orchestrator/api/mobile_devices.py`, `orchestrator/core/auth/{pairing,device,bearer_registry}.py`, `orchestrator/services/mobile/{pairing,urls}.py`, `orchestrator/tests/test_prd266_*.py`). If that worktree or branch is gone (W1 merged), `git -C /Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/mobile-review-main show origin/main:<path>`. Main-line code: `/Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/mobile-review-main` (READ ONLY). Never `git fetch`, `checkout`, `stash`, edit or run anything in either worktree, and never read the stale `automatos-ai/` checkout's working tree. A story's notes say which server facts were measured on which commit: **re-read each one before relying on it**; where the code differs from the notes, the code wins — say so in the DONE mark.
5. Your own earlier stories' files: mirror the idiom you already set; never a second pattern.

## Dependencies (KC14)

- US-006i needs PRD-266 W1 US-003c (the rotate and DELETE device routes) COMMITTED. Its first AC says how to check. If they are absent: change nothing, reply with one line of evidence and `RALPH_BLOCKED` as the last line. Every other story builds on W1's committed code and the W1 kit's ACs, and never waits.
- The consent stories build against PRD-266 §4.8's `ai_providers [{id, name}]` with the 'unlisted' fallback; W3 US-017 is not built. Never invent a provider name.

## Local checks

Allowed (pure Node, the repo's CLAUDE.md rule): `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run check:bundle`, `npm run check:core`, `npm run check:routes`, `bash scripts/ralph/acceptance-prd001-connect.sh --no-ci`, and the read-only `git show` reads above.
**NEVER:** `npm install`, `npx expo install` or any dependency change; `expo start`, `expo run:*`, `expo prebuild`; any `eas` command; a simulator, Metro's dev server or any server; a request to a real server (tests use fake transports and fake stores); `gh workflow run`; `git push`; opening a PR. Write the tests each AC names (vitest, node — no React renderer: keep components thin and test their pure view-models). Never claim a check passed that you did not see pass.

## Code rules

- Studio layout, **tokens only** (no colour literal; the lint fails it), text ≥ 11 pt, every colour status has a word, Reduce Motion respected.
- HTTP only through the foundation's client, with your route table `src/connect/routes.ts`; zod at every boundary; unknown fields ignored.
- **Secrets:** the device token and the pairing code are never logged, toasted, put in a URL you build, cached in MMKV or the query cache, or sent to Sentry. The token lives only in the one expo-secure-store item of `src/connect/device-store.ts` (KC9). Only `src/connect/device-store.ts` and `src/connect/install-id.ts` import expo-secure-store (gate-enforced).
- **Nothing pairs by itself** (KC8): a scan or a link stops at the confirm card.
- Pure logic in plain TS with tests (parsers, reducers, policy, decisions); screens and hooks only wire. Immutability. Copy in each folder's `strings.ts`; tunables as named constants in its `config.ts`.
- Files 200–400 lines (never over 800), functions under 50, components under 150, nesting under 4.
- Enterprise stays in view (KC15): the AuthProvider interface gains no method; 'oidc' stays unregistered.

## The execution contract

- **This session ends when your turn ends.** Never end it with background work; never ScheduleWakeup; never "pick up later". Wait in the foreground for everything you start.
- **A review runs in the FOREGROUND, before the commit, only where an AC asks for one** (US-006a, US-006c, US-006g, US-006i: the security-reviewer agent on the named paths). Wait for it; fix HIGH/CRITICAL in the same story. No other story spawns a reviewer.
- **One story per session.** Build the first story (by `priority`) whose ACs are not all DONE, then STOP (step 5). The priority order is the dependency order.
- **Re-verify every anchor** by reading it before relying on it.

## Commits

- `git commit -s` (DCO) on EVERY commit; `feat(prd-001): <story id> — <title>` (or fix/test/docs/chore), **every story commit ends with ` [skip ci]`**, evidence in the body.
- Stage explicit paths only (`git add <path> …`): NEVER `git add -A`, `.`, `-u` or `-f`; never `git stash`; never amend, rebase, cherry-pick or switch branches. `git status --short` before each commit; account for every line.

## Hard NOs

- NO file outside KC1/KC2. NO dependency, native, app.json or eas.json change. NO pushing, PRs or merges (the runner pushes `origin feat/a1-connect` as a backup and opens the draft PR at completion).
- NO weakening, skipping or deleting a test, lint rule or check; no inline lint disable without a one-line reason.
- NO chat (A2), Command Centre (A3), push registration or a push question (A4, KC10), styles beyond Studio (A5), voice (A6). NO account or workspace deletion (D63). Nothing about plans, credits or prices (D8). No WebView. NO pointer to creating an account anywhere (D-SIGNIN). NO copy saying 'nothing leaves your server' or anything broader than KC16's data note, and every provider ai_providers lists, Retell included, is named on the consent sheet (KC11, KC16).

## Per-iteration protocol

1. Pick the first story (by `priority`) with ACs not yet DONE. Read its sources, the foundation files and the backend files it names, fresh.
2. Implement it with its tests; run its checks until green.
3. Commit the story (signed, ` [skip ci]`).
4. Mark it in `scripts/ralph/prd-001-connect.json`: APPEND ` → DONE — <evidence>` to each AC, set `passes` to `true`, add one line to `notes` after ' | ' (every foundation file you changed with its KC2 purpose, any `FOUNDATION GAP:`, any server fact that differed from the notes); `jq . scripts/ralph/prd-001-connect.json >/dev/null`; commit that file alone (signed, ` [skip ci]`).
5. **STOP.** Unless that was the last story, end your reply with `STORY_DONE <story id>` as its last line. **RALPH_COMPLETE, RALPH_BLOCKED and STORY_DONE are sentinels the runner reads on your LAST line only (≤ 80 characters): never write them anywhere else.**

## Completion

- **All stories `passes: true`:** run `bash scripts/ralph/acceptance-prd001-connect.sh --no-ci`; fix what is red in signed ` [skip ci]` commits (a gate check that is itself wrong is not yours to loosen: report it and stop with BLOCKED); then ONE signed commit WITHOUT `[skip ci]` — `git commit -s --allow-empty -m "chore(prd-001): A1 connect built, run CI"` — and reply with `RALPH_COMPLETE` as the last line.
- **Already built and tested:** every story `passes: true` and the last commit touching anything outside `scripts/ralph/` is that CI commit, or a commit without `[skip ci]` whose ci.yml run completed green (`gh run list --branch feat/a1-connect --workflow ci.yml --limit 5 --json headSha,status,conclusion`): make NO commit; reply `RALPH_COMPLETE` and nothing else.
- **A story cannot be built without breaking a Hard NO** (it truly needs a new dependency, a native change, a file outside KC1/KC2 no adapter can replace, or backend code that is not committed yet): one line of why and the evidence, then `RALPH_BLOCKED` as the last line. The tip must stay green.
