# Ralph Review Prompt — Automatos Go, PRD-001 wave A1 (remaining): connect, bootstrap, roles and consent

You are a fresh-context **adversarial reviewer**. The build claims the connect wave is complete (US-006a–i, US-007a–c). It may have run in parallel with the A2 chat and A3 Command Centre kits on the same foundation. This wave handles a credential, a trust boundary (addresses, QR codes, links) and a consent duty: review it as security-sensitive. Find where:

- a file outside KC1 changed, a KC2 foundation file was changed for anything but its stated purpose, a foundation test lost a case or was deleted, or a dependency, app.json or eas.json changed — and list every `FOUNDATION GAP:` and every KC2 edit the DONE marks record, for Gerard;
- http:// is accepted for a host that is not private (KC6), a strict-IPv4 trick (leading zeros, integer or hex forms) passes as private, localhost reaches a request, or a typed path/query/userinfo is kept (US-006a);
- the code is sent without its hyphen or accepts characters outside the alphabet (KC7), or a QR or link with another scheme, a repeated parameter or an http public `api` is accepted (US-006a);
- POST /pair carries an Authorization or X-Workspace-ID header, or its 401 reaches the signed-in session's expiry path (US-006b);
- the device token or a pairing code reaches a log, a toast, MMKV, the query cache, Sentry or a URL; the SecureStore item is not AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY; a corrupt item crashes instead of clearing; the reinstall wipe is missing or wipes the install id; any file but `src/connect/device-store.ts` and `src/connect/install-id.ts` imports expo-secure-store (US-006b, US-006c, KC9);
- the AuthProvider interface gained a method, 'oidc' was registered, or an unknown mode does anything but 'unsupported' (KC15);
- concurrent 401s fire the expiry more than once, or a revoked token is told anything but the revoked copy (US-006c);
- one server's token, workspace id, cached query data or consent record can reach or show for another server; switching or forgetting misses a store; K3's hosted defaults apply to an own server; the Clerk not-configured state blocks an own server (US-006d);
- a scan, a link or a prefill can reach POST /pair without the confirm card, or a link silently replaces the current server (KC8, US-006e, US-006g);
- the API address kept is the document's api_url instead of the origin that answered (KC5);
- the camera permission is asked before the scanner opens, or a denied permission leaves no way forward (US-006g);
- the unencrypted note is missing from any signed-in screen while the server is http, Not running does not name the server, or Forget this server deletes anything beyond this phone's own device row (US-006h, D63);
- a role is derived from the auth mode or edition instead of the bootstrap, the forbidden refresh can loop, or the paused refusal shows anything that names a plan (US-007a, KC12, D8);
- a write surface (the home thread, a chat, a Command Centre answer, note or rebrief) can send before consent; a viewer is asked; the record is not per server and workspace; a changed provider list does not ask again; a provider name is invented; a 'Not now' exists (US-007b, US-007c, KC11);
- rotation uses the new token before it is stored, runs twice for one rotate_after, runs per request, or a failed rotation drops the working token; Remove this phone does not forget locally when offline (US-006i);
- the consent sheet hides, filters or groups away any provider ai_providers lists (Retell for Auto Live voice included) (KC11);
- any copy says 'nothing leaves your server' or anything broader than KC16's data note, or the own-server confirm card lacks that note word for word (KC16);
- any screen or string points to creating an account ('Create an account', 'Sign up', 'No account?', a Studio sign-up link) (D-SIGNIN);
- a colour literal, a text size under 11, a component over 150 lines or a function over 50;
- a story's evidence does not exist, or an ownerTest item was claimed as done.

You fix NOTHING in the code yourself.

## Scope

```
BASE=$(bash scripts/ralph/acceptance-prd001-connect.sh --print-base)
git diff --stat $BASE..HEAD
git diff $BASE..HEAD
```

Read beside the diff: `scripts/ralph/prd-001-connect.json` (binding), PRD-001 §4.4/§4.5/§4.7/§4.11, the foundation files the diff imports or edits, and the backend's committed code READ ONLY (`git -C /Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/feat+prd-266-w1-connect show feat/prd-266-w1-connect:<path>`, or `git -C /Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/mobile-review-main show origin/main:<path>` once W1 merged): `orchestrator/api/mobile_devices.py`, `orchestrator/core/auth/{pairing,device}.py`, `orchestrator/services/mobile/{pairing,urls}.py`. Never edit, fetch or check out there. Never file a finding against a line this diff does not touch, except a foundation gap the wave had to work around (list those separately, not as findings).

## Verification

- Run the **code-review** skill (or the code-reviewer agent) on the diff **in the foreground**, and the **security-reviewer** agent in the foreground on `src/connect/`, `src/auth/providers/device.ts`, `src/consent/store.ts`, `app/go/pair.tsx` and every KC2 change to `src/api/`. Wait for each.
- Run `bash scripts/ralph/acceptance-prd001-connect.sh` yourself (it reads the wave's one CI run). **Non-zero = automatic CRITICAL.**
- Spot-check four DONE ACs at random against the code and tests; always include one from US-006a, one from US-006c and one from US-007c.
- Check each server fact the code relies on against the committed backend file (the code wins over the json's notes): the code format and alphabet, the /pair body, answer and refusals, the device lane's 401 bodies, and (if US-006i is done) the rotate answer.
- Only pure-Node checks may run on this machine; never `expo start`, `eas`, a simulator or a server; nothing left in the background.

## Verdict

- **No CRITICAL/HIGH/MEDIUM:** a 5-line summary: (a) addresses, codes, links and the HTTPS rule; (b) pairing, the device provider, token storage, rotation and revoke; (c) the shell: switching, Welcome, Not running, the unencrypted note; (d) role freshness and consent; (e) every FOUNDATION GAP and KC2 edit recorded, every RE-VERIFY still open, and the owner's next steps (OT-N1..OT-N11). Then `REVIEW_PASS` as the last line (REVIEW_PASS and REVIEW_FINDINGS appear on your last line only, never in prose).
- **Findings:** append `P001N-RVW-n` stories (n from 1) to `scripts/ralph/prd-001-connect.json` (same shape: id, prdStory 'review', title, description with `file:line` evidence, acceptanceCriteria with the cause, the change, the test and the checks, files — inside KC1/KC2 only, priority after the last story, passes false, notes ''), validate with `jq`, commit `git commit -s -m 'chore(prd-001): connect review findings → fix stories [skip ci]' -- scripts/ralph/prd-001-connect.json`. Then `REVIEW_FINDINGS` as the last line. A finding that can only be fixed in a foundation file outside KC2, or in the A2/A3 kits' files, is NOT a fix story here: list it in your summary for that branch. Do not push.
