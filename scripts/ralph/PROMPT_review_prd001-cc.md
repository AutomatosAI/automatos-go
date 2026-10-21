# Ralph Review Prompt — Automatos Go, PRD-001 wave A3: the Command Centre

You are a fresh-context **adversarial reviewer**. The build claims the A3 Command Centre wave is complete (US-010a–d, US-011a–b, US-012a–b, US-013a–b). It ran in parallel with the A2 chat kit on the same foundation. Find where:

- a file outside KX1's list changed, a dependency or app.json changed, or a foundation file was edited instead of adapted (KX1, KX2) — and list every `FOUNDATION GAP:` the DONE marks record, for Gerard;
- a screen file does not sit where the foundation's `src/navigation/routes.ts` builders point (a broken link from the A2 home's needs strip or a receipt);
- a status the server sends is dropped or mislabelled (Failed, Cancelled, closed → Cancelled), the sort differs from the handoff, the lede or a tab recomputes the needs-you number instead of using the server's total, or a second tasks/stream connection or a poll exists (US-010a–c, D26, D-LIVE);
- Approve shows outside Review, Send back can send without feedback, an action shows for a viewer, or 'Ask Auto about' does anything but navigate to `chatWithTicket` (US-010d);
- Pause/Resume appears for any kind but routines and scheduled tasks, calls the wrong route, groups days in a hardcoded timezone, or a paused row has no word (US-011a/b, D27);
- an answer is queued offline, a blank free-text answer is sent, Dismiss lacks the stopped-run copy, a viewer can answer, a 403/409 shows an error page instead of the honest words, or question text is persisted (US-012a);
- a social approval can send a content_hash other than the one on screen, or none; Request changes without a comment; a stale version approved after a 409 (US-012b, D45);
- Deliverables show a review state, Approve/Request changes, Awaiting/Done pills or 'DLV-' ids; a file download leaves without the bearer or opens a browser; downloaded files are left behind; Report this re-implements the call or ignores its gate (US-013a/b, D25);
- a colour literal, a text size under 11, a component over 150 lines or a function over 50; a style decision hard-coded where A5 would need to copy a screen (D-ONE-SET);
- a story's evidence does not exist, or an ownerTest item was claimed as done.

You fix NOTHING in the code yourself.

## Scope

```
BASE=$(bash scripts/ralph/acceptance-prd001-cc.sh --print-base)
git diff --stat $BASE..HEAD
git diff $BASE..HEAD
```

Read beside the diff: `scripts/ralph/prd-001-cc.json` (binding), PRD-001 §4.4/§4.6/§4.7, the foundation files the diff imports, `digests/command-centre-api.md`, and the web's components and hooks (READ ONLY) under `/Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/mobile-review-main/frontend/`. Never file a finding against a line this diff does not touch, except a foundation gap the wave had to work around (list those separately, not as findings).

## Verification

- Run the **code-review** skill (or the code-reviewer agent) on the diff **in the foreground**, and the **security-reviewer** agent in the foreground on `src/cc/deliverables/open-file.ts`, `src/cc/social/` and `src/cc/questions/`. Wait for each.
- Run `bash scripts/ralph/acceptance-prd001-cc.sh` yourself (it reads the wave's one CI run). **Non-zero = automatic CRITICAL.**
- Spot-check four DONE ACs at random against the code and tests; always include one from US-012b and one from US-011a.
- Only pure-Node checks may run on this machine; never `expo start`, `eas`, a simulator or a server; nothing left in the background.

## Verdict

- **No CRITICAL/HIGH/MEDIUM:** a 5-line summary: (a) the shell, live status and the server's numbers; (b) Board and the ticket sheet, role gating; (c) Calendar and pause; (d) Questions and social approvals (the exact version); (e) Deliverables and Report this, every FOUNDATION GAP recorded, the owner's next steps (OT-X1..OT-X7). Then `REVIEW_PASS` as the last line (REVIEW_PASS and REVIEW_FINDINGS appear on your last line only, never in prose).
- **Findings:** append `P001X-RVW-n` stories (n from 1) to `scripts/ralph/prd-001-cc.json` (same shape: id, prdStory 'review', title, description with `file:line` evidence, acceptanceCriteria with the cause, the change, the test and the checks, files — inside KX1 only, priority after the last story, passes false, notes ''), validate with `jq`, commit `git commit -s -m 'chore(prd-001): Command Centre review findings → fix stories [skip ci]' -- scripts/ralph/prd-001-cc.json`. Then `REVIEW_FINDINGS` as the last line. A finding that can only be fixed in a foundation file is NOT a fix story here: list it in your summary for the foundation branch. Do not push.
