# Ralph Review Prompt — Automatos Go, PRD-001 wave A2: Studio layout and chat

You are a fresh-context **adversarial reviewer**. The build claims the A2 chat wave is complete (US-008a–h, US-009a–c). It ran in parallel with the A3 Command Centre kit on the same foundation. Find where:

- a file outside KC1's list changed, a dependency or app.json changed, or a foundation file was edited instead of adapted (KC1, KC2) — and list every `FOUNDATION GAP:` the DONE marks record, for Gerard;
- a turn can be sent with `planMode`/`missionMode`, a stale cached chat id is reused without the GET /api/chat/{id} check, Stop only aborts the read and never calls POST /api/chat/{id}/cancel, a reopened in-flight turn does not show 'Auto is working…' or never refetches on chat_changed, or messages duplicate on refetch (US-008a/b, D-STOP, D-STALE-CHAT);
- the thread diverges from the frame catalogue (narration not removed, a waiting tool drawn as failed, receipts marks/words wrong, a limit or trial frame echoing server text that could name a plan) or a receipt link opens a web page for a core flow (US-008c, D8);
- a card can act for a viewer, sends the wrong payload (context_messages not capped at 5; approve with a body; reject without a reason; withdraw doing anything but deny), or hides the server's honest 'already answered' (US-008d/e);
- the composer submits on Return, sends blank, stays enabled while the AI label is off screen or for a viewer, or the AI label is restyled, moved off the composer or not on every chat screen (US-009a, D-AI-LABEL);
- the needs strip recomputes the number instead of using the server's total, or routes a row anywhere but the foundation's route builders (US-008f);
- history paging loops forever when the server ignores starting_after (US-008g);
- 'Ask Auto about' starts in an existing conversation, omits the ticket selection from any message of the discussion, or rebriefs without the role gate or over MAX_BRIEF_CHARS (US-008h);
- a HEIC file reaches the upload unconverted, a permission is asked before the tap, or an upload bypasses the client (US-009b);
- Report this exists anywhere but on Auto's messages, ignores the capability/role gate, or re-implements the report call (US-009c);
- a colour literal, a text size under 11, a component over 150 lines or a function over 50; data persisted outside the foundation's cache rules;
- a story's evidence does not exist, or an ownerTest item was claimed as done.

You fix NOTHING in the code yourself.

## Scope

```
BASE=$(bash scripts/ralph/acceptance-prd001-chat.sh --print-base)
git diff --stat $BASE..HEAD
git diff $BASE..HEAD
```

Read beside the diff: `scripts/ralph/prd-001-chat.json` (binding), PRD-001 §4.4/§4.6/§4.7, the foundation files the diff imports, and the web's behavioural references (READ ONLY) `/Users/gkavanagh/Development/Automatos-AI-Platform/.worktrees/automatos-ai/mobile-review-main/frontend/components/chatbot/`. Never file a finding against a line this diff does not touch, except a foundation gap the wave had to work around (list those separately, not as findings).

## Verification

- Run the **code-review** skill (or the code-reviewer agent) on the diff **in the foreground**, and the **security-reviewer** agent in the foreground on `src/chat/attachments/`, `src/chat/api.ts` and `src/chat/request.ts`. Wait for each.
- Run `bash scripts/ralph/acceptance-prd001-chat.sh` yourself (it reads the wave's one CI run). **Non-zero = automatic CRITICAL.**
- Spot-check four DONE ACs at random against the code and tests; always include one from US-008b and one from US-009a.
- Only pure-Node checks may run on this machine; never `expo start`, `eas`, a simulator or a server; nothing left in the background.

## Verdict

- **No CRITICAL/HIGH/MEDIUM:** a 5-line summary: (a) the turn: send, stream, Stop, stale id, in-flight resume; (b) the thread and Auto's cards, role gating; (c) the composer and the AI label; (d) home, needs strip, older chats, Ask Auto about, attachments, Report this; (e) every FOUNDATION GAP recorded and the owner's next steps (OT-C1..OT-C8). Then `REVIEW_PASS` as the last line (REVIEW_PASS and REVIEW_FINDINGS appear on your last line only, never in prose).
- **Findings:** append `P001C-RVW-n` stories (n from 1) to `scripts/ralph/prd-001-chat.json` (same shape: id, prdStory 'review', title, description with `file:line` evidence, acceptanceCriteria with the cause, the change, the test and the checks, files — inside KC1 only, priority after the last story, passes false, notes ''), validate with `jq`, commit `git commit -s -m 'chore(prd-001): chat review findings → fix stories [skip ci]' -- scripts/ralph/prd-001-chat.json`. Then `REVIEW_FINDINGS` as the last line. A finding that can only be fixed in a foundation file is NOT a fix story here: list it in your summary for the foundation branch. Do not push.
