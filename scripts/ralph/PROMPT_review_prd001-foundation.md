# Ralph Review Prompt — Automatos Go, PRD-001 wave A0+A1: the foundation

You are a fresh-context **adversarial reviewer**. The build claims the foundation is complete (US-001, US-002a–e, US-003a–d, US-004a–c, FND-1..FND-3, US-005a–c, FND-4, FND-5). Two parallel kits (A2 chat, A3 Command Centre) start from this branch next, and every native module must be in THIS build. Find where:

- the scaffold drifted from the academy template where §4.1 says lift verbatim (the react-dom shims, the import.meta transform, the extraPods, legacy-peer-deps), or carries academy leftovers (academy names, the academy's ascAppId, academy feature code); app.json identity is wrong (bundle id, scheme, supportsTablet, runtimeVersion fingerprint); a Clerk key, token or any secret got committed, or the committed EAS link is wrong (owner `gerard161`, `extra.eas.projectId`, `updates.url`, the `ascAppId`: public identifiers, committed since 24 Oct) (US-001, D-NO-SECRETS);
- the EAS Workflows delivery (`.eas/workflows/testflight.yml`; 24 Oct, replaces the GitHub `testflight.yml`, no EXPO_TOKEN) builds when a same-fingerprint testflight build exists or updates when none does, lets a run that is no longer `main`'s head publish an update, or `pr-check.yml` builds or publishes (US-001, D48; two native builds from two merges before the first build starts is documented in CLAUDE.md, not a finding);
- a §4.2 module or a K11 addition is missing, a config plugin is not wired, a usage key a bundled framework needs is missing or dishonest, `NSAllowsArbitraryLoads` crept in, UIBackgroundModes carries `audio`, or react-native-webview / expo-apple-authentication is anywhere in the lockfile — anything that would force a SECOND native build later (US-002a–c);
- a font is not a valid sfnt, two faces share a PostScript name, a licence is missing, the icon has an alpha channel (US-002d/e);
- sync-core's purity check reads raw text instead of the AST, follows an import into React/DOM/fetch code without failing, `--check` misses an edit or an extra file, the lock does not match the files, a vendored file was edited by hand, or the pinned SHA differs from `630fc1c85af06c5c76e70c74e9653ee1804fdf41` (US-003a/b);
- `parseLine` can throw, a frame in the catalogue (digests/chat-api.md lines 6–12) is unhandled or mishandled (narration retraction, waiting tool-end drawn as failed, the malformed agent-info shape), `turnReducer` mutates its input, or a corpus file is labelled `recorded` without being one (US-003c/d, K10);
- a request can leave without the bearer or with a stale workspace header, a 409 loses the server's words, an error message leaks a status code, URL or stack, `fetch` is reachable outside `src/api/`, a JSON response is used without zod, the discovery 404 fallback (K3) applies to anything but a 404, or chat/question data reaches the persisted cache (US-004a–c, D-CACHE);
- the AuthProvider can hand out a token not minted from the 'mobile' template, an unknown auth mode does anything but say 'This server needs a newer Automatos Go', a sign-up or social path exists, a second factor can be skipped, `finalize` runs before 'complete', tokens are stored outside SecureStore (US-005a–c);
- a shared contract the parallel kits need is missing or misplaced (K5): route builders incl. `chatWithTicket`, web-link mapping, ALL query-key families, the single live connection with board_changed invalidation and chat_changed fan-out, `useNeedsYou`, `CommandCentreButton` (HUD's since D73; Studio's header carries the number on its menu button), `ReportSheet` gated on `report_content` + role, the AI label as one muted caption line in the tokens' muted text colour (`aiLabelWords`, D73: no fixed colours, nothing holds the composer), Sheet, Toast, the UI primitives;
- a colour literal sits outside `src/styles/tokens/` and the AI label, a type size is under 11, a component is over 150 lines or a function over 50;
- a story's evidence does not exist, or an ownerTest item was claimed as done.

You fix NOTHING in the code yourself.

## Scope

```
BASE=$(bash scripts/ralph/acceptance-prd001-foundation.sh --print-base)
git diff --stat $BASE..HEAD
git diff $BASE..HEAD -- . ':!package-lock.json' ':!assets/fonts' ':!assets/brand' ':!src/core/web' ':!src/core/route-manifest.json'
```

`src/core/web/**` is generated: review `scripts/sync-core.ts`, `scripts/core-manifest.json`, `core.lock.json` and `src/core/shims/`, then spot-check three vendored files against their source at `/Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/core-pin-630fc1c85/frontend/` (header + alias rewrite only). Read beside the diff: `scripts/ralph/prd-001-foundation.json` (binding: decisions, ACs, notes, ownerTest), `docs/prd/PRD-001-AUTOMATOS-GO-V1.md` §4, and the academy template (READ ONLY) for US-001's lift. Never file a finding against a line this diff does not touch.

## Verification

- Run the **code-review** skill (or the code-reviewer agent) on the diff **in the foreground**, and the **security-reviewer** agent in the foreground on `src/auth/`, `src/storage/`, `src/api/client.ts`, `src/api/query-client.ts`, `scripts/record-turn.ts` and `.eas/workflows/testflight.yml`. Wait for each.
- Run `bash scripts/ralph/acceptance-prd001-foundation.sh` yourself (it reads the wave's one CI run on the tested commit). **Non-zero = automatic CRITICAL.**
- Spot-check five DONE acceptance criteria at random against the code and the tests; always include one from US-002c, one from US-003c and one from US-005a.
- Only pure-Node checks may run on this machine (see the build prompt); never `expo start`, `eas`, a simulator or a server. Never end your turn with anything running in the background.

## Verdict

- **No CRITICAL/HIGH/MEDIUM:** a 6-line summary: (a) scaffold and release plumbing (identity, the EAS link, eas.json, the EAS Workflows delivery and PR check, CI jobs, CLAUDE.md rule); (b) the native set: modules, plugins, usage keys, entitlements — confidence that no second build is needed for A1–A7; (c) fonts and brand; (d) the vendored core: lock, purity, stream parser, reducer, corpus provenance; (e) client, discovery, cache, auth: the token path end to end; (f) the shared contracts the A2/A3 kits rely on, and the owner's next steps (OT-1..OT-11). Then `REVIEW_PASS` as the last line (the words REVIEW_PASS and REVIEW_FINDINGS appear on your last line only, never in prose).
- **Findings:** append `P001F-RVW-n` stories (n from 1) to `scripts/ralph/prd-001-foundation.json` (same shape: id, prdStory 'review', title, description with `file:line` evidence, acceptanceCriteria with the cause, the change, the test and the checks, files, priority after the last story, passes false, notes ''), validate with `jq`, commit `git commit -s -m 'chore(prd-001): foundation review findings → fix stories [skip ci]' -- scripts/ralph/prd-001-foundation.json`. Then `REVIEW_FINDINGS` as the last line. Do not push.
