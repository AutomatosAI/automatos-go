// The chat's copy (one strings module per feature, §4.11). Receipts and tool lines use the web's own
// words (the vendored receipts.ts and Play's labels.ts); these are the frames around them, the word
// each status mark carries for screen readers (§4.6), and the kit's fixed copy for every failed turn
// and limit: the server's words for those may name a plan or an account, so they never reach the
// screen (D-NO-BILLING, D8).

import type { TurnErrorCode } from '../core/turn-reducer';
import { WAITING_FOR_YOU, type ToolStatus } from '../core/web/components/play/chat/labels';
import type { Receipt } from '../core/web/types';

/** Words a failed turn shows, and whether asking again can help. */
export type FailureCopy = { readonly text: string; readonly canRetry: boolean };

/** D-NO-BILLING's fixed copy: a limit_reached frame and a trial_exhausted error both say this. */
const LIMIT_TEXT = 'Auto has reached a limit for now. Ask your workspace owner.';

export const CHAT_COPY = Object.freeze({
  /** The label beside Auto's mark (the handoff's mono 'AUTO'). */
  autoLabel: 'Auto',
  autoMark: 'A',
  /** VoiceOver's name for one of Auto's messages, and for one of the user's. */
  autoSaid: 'Auto said',
  youSaid: 'You said',
  /** A file the user sent with a message ('Attached: plan.pdf'). */
  attached: 'Attached',
  /** The working indicator (the handoff's italic 'Auto is working…'). */
  working: 'Auto is working…',
  /** components/play/chat/receipts.tsx RECEIPTS_TITLE and its tags. */
  receiptsTitle: 'What Auto did',
  /** components/play/chat/tool-lines.tsx TOOL_LINES_LABEL. */
  toolLinesLabel: 'Tools Auto used',
  limit: LIMIT_TEXT,
  /** attachment_unavailable: Auto answered without the file. */
  attachmentUnavailable: (filename: string | null) =>
    filename
      ? `Auto couldn't open ${filename}, so it answered without it.`
      : "Auto couldn't open an attachment, so it answered without it.",
  /** Stop was pressed (the turn is cancelled on the server). */
  stopped: 'You stopped this reply.',
  /** The cancel did not reach the server: the turn still runs there. */
  stopFailed: "Auto couldn't be stopped. It is still working on this.",
  retry: 'Try again',
});

/** Play's receiptBadge tags: a done write says Done, a refused call Not done, a skipped one Skipped. */
export const RECEIPT_BADGES = Object.freeze({
  done: 'Done',
  refused: 'Not done',
  skipped: 'Skipped',
});

/** The word every receipt mark carries for screen readers, whether or not it has a badge (§4.6). */
export const RECEIPT_STATUS_WORDS: Readonly<Record<Receipt['status'], string>> = Object.freeze({
  done: 'Done',
  waiting: 'Waiting for you',
  refused: 'Not done',
  skipped: 'Skipped',
});

/** The word a tool line's mark or spinner carries for screen readers, by its status (§4.6). */
export const TOOL_STATUS_WORDS: Readonly<Record<ToolStatus, string>> = Object.freeze({
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
  waiting: 'Waiting for you',
  skipped: 'Skipped',
  stopped: 'Stopped',
});

/** The word a notice carries for screen readers, by its kind. */
export const NOTICE_WORDS = Object.freeze({
  limit: 'Limit reached',
  attachment: 'Attachment unavailable',
  failed: 'Failed',
  stopped: 'Stopped',
  stopFailed: 'Still working',
});

/** A failed turn by its e: code, in the kit's words (consumers/chatbot/turn_errors.py codes). */
export const TURN_ERROR_COPY: Readonly<Record<TurnErrorCode, FailureCopy>> = Object.freeze({
  rate_limited: { text: 'Auto is rate-limited right now. Try again in a minute.', canRetry: true },
  trial_exhausted: { text: LIMIT_TEXT, canRetry: false },
  model_unavailable: {
    text: "The model Auto uses isn't available right now. Try again later.",
    canRetry: true,
  },
  no_api_key: {
    text: 'Auto has no AI provider key in this workspace. Ask your workspace owner.',
    canRetry: false,
  },
  runtime_mismatch: {
    text: 'This agent runs as a Claude Code session, not in chat. File a ticket for it instead.',
    canRetry: false,
  },
  activation_failed: { text: "Auto couldn't start the agent for this reply.", canRetry: true },
  provider_failed: { text: "The AI provider couldn't finish this reply.", canRetry: true },
  turn_failed: { text: "Auto couldn't answer that.", canRetry: true },
  session_agent_terminal: {
    text: 'This agent works in its terminal session, not in chat. Talk to it in Studio.',
    canRetry: false,
  },
});

/**
 * Auto's cards (D-CARDS): the Mission suggestion (the web's MissionSuggestionCard) and the plan
 * approval (MissionApprovalWidget, with its OversightNote words). A Mission's plan is the work's
 * plan, never a billing one; no cost or ceiling is ever shown (D8).
 */
export const CARD_COPY = Object.freeze({
  suggestionEyebrow: 'Mission · Suggested',
  suggestionBody:
    'Auto suggests running this as a Mission: several agents working on it together, each step checked.',
  /** AutoBrain's complexity tiers as the web names them; any other tier shows no chip. */
  complexity: Object.freeze({ organ: 'Multi-step', organism: 'Complex multi-agent' }) as Readonly<
    Record<string, string>
  >,
  fileIt: 'File it',
  filing: 'Filing…',
  noThanks: 'No thanks',
  filed: '✓ Filed as a Mission',
  openMission: 'Open it in Studio',
  planEyebrow: 'Mission · Plan to approve',
  tasks: Object.freeze({ one: 'task', other: 'tasks' }),
  approve: 'Approve & run',
  reject: 'Reject',
  rejectReasonLabel: 'Why are you rejecting this plan?',
  rejectReasonPlaceholder: 'Tell Auto what to change',
  sendReject: 'Reject plan',
  cancel: 'Cancel',
  approved: 'Plan approved. The Mission is running.',
  rejected: 'Plan rejected.',
  reasonRequired: 'Say why you are rejecting this plan.',
  reasonTooLong: (max: number) => `Keep the reason to ${max.toLocaleString('en')} characters.`,
  /** components/widgets/oversight-note.tsx: the note's name, and each tier's words. */
  oversight: 'Human oversight',
  /** The agent the plan matched to a task, and when the owner picked it. */
  matchedAgent: (agent: string) => `→ ${agent}`,
  yourPick: '(your pick)',
});

/** oversightTierLabel: an unknown or missing tier reads as the strictest. */
export const OVERSIGHT_TIERS = Object.freeze({
  monitor: 'Monitored',
  human_on_the_loop: 'Human on the loop',
  human_in_the_loop: 'Human approval required',
});

/**
 * The tool approval (the web's ToolApprovalWidget, with lib/grant-outcome.ts's honest line for what
 * the click ran) and the withdraw offer (withdraw-offer-card.tsx), in the web's words. A click on a
 * card someone already decided says what it was decided as (the server's 'Grant is not pending').
 */
export const GRANT_COPY = Object.freeze({
  toolEyebrow: 'Action · Approval needed',
  approve: 'Approve & run',
  deny: 'Deny',
  /** The open card, as its tool line and receipt say it: waiting, never failed. */
  waiting: `${WAITING_FOR_YOU}.`,
  paramsLabel: 'What it will run with',
  approved: 'Approved.',
  ran: 'Approved — the action ran.',
  requeued: 'Approved — the blocked ticket was re-queued.',
  askedAgain: 'Approved, but the action asked for approval again.',
  failed: 'Approved, but the action failed.',
  failedBecause: (reason: string) => `Approved, but the action failed: ${reason}`,
  denied: 'Denied — the action will not run.',
  withdrawEyebrow: 'Withdraw request',
  withdraw: 'Withdraw',
  keep: 'Keep it',
  withdrawn: 'Withdrawn.',
  kept: 'Kept — it still waits for your yes.',
  /** A request with no reason or action of its own (the web's 'Request #N'). */
  request: (grantId: number) => `Request #${grantId}`,
  /** By the decided grant's status; any other status reads as alreadyAnswered. */
  alreadyDecided: Object.freeze({
    granted: 'This request was already approved.',
    denied: 'This request was already denied.',
    expired: 'This request expired before anyone answered it.',
    revoked: 'This request was already withdrawn.',
  }) as Readonly<Record<string, string>>,
  alreadyAnswered: 'This request was already answered.',
});

/** A ticket the reply filed or checked (the web's TaskCard; the handoff's '#0431: filed to Inbox'). */
export const TICKET_COPY = Object.freeze({
  /** The headline of a ticket with no number: a row id is never shown as one. */
  unnumbered: 'Ticket',
  filedToInbox: 'filed to Inbox',
  openOnBoard: 'Open on the board',
  lastTool: (tool: string) => `last tool: ${tool}`,
  filesTouched: Object.freeze({ one: 'file touched', other: 'files touched' }),
  exit: (reason: string) => `exit: ${reason}`,
  /** The web hides an unassigned ticket's agent. */
  unassigned: 'unassigned',
});
