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

/**
 * The composer (D-COMPOSER): the handoff's 'Message Auto' pill and its one round button. A viewer's
 * reason and the paused label's are not here: they are ROLE_COPY.viewerReadOnly (D17) and the
 * vendored AI_LABEL_PAUSED_TEXT.
 */
export const COMPOSER_COPY = Object.freeze({
  /** The pill's VoiceOver name and its placeholder (the handoff's aria-label). */
  inputLabel: 'Message Auto',
  placeholder: 'Message Auto',
  /** A viewer's pill: read the thread, never write to it. */
  readOnlyPlaceholder: 'Read only',
  send: 'Send',
  stop: 'Stop',
  stopHint: "Stops Auto's reply",
});

/**
 * The home's header (the handoff's §1 Header): the wordmark beside the brand mark, the mono line
 * under it ('NORTHWIND · 5 AGENTS', 'NORTHWIND · AUTO IS WORKING' while a turn runs) and the
 * avatar chip that opens Settings.
 */
export const HOME_COPY = Object.freeze({
  wordmark: 'automatos',
  brand: 'Automatos',
  agents: Object.freeze({ one: 'agent', other: 'agents' }),
  working: 'Auto is working',
  settings: 'Settings',
  back: 'Back',
  /** The list button (D28): older chats sit behind it. */
  olderChats: 'Older chats',
});

/**
 * Older chats (D28), in the web's words where it has them (Play's Conversations page,
 * frontend/components/play/conversations/play-conversations.tsx and lib/play/conversations.ts).
 */
export const HISTORY_COPY = Object.freeze({
  title: 'Conversations',
  newChat: 'New chat',
  /** A chat with no title yet (the web's UNTITLED_CONVERSATION). */
  untitled: 'New chat',
  loadMore: 'Load more',
  loadingMore: 'Loading more conversations…',
  loadMoreFailed: "More conversations didn't load.",
  emptyTitle: 'No conversations yet',
  emptyMessage: 'Say hello to Auto and your first one starts.',
  /** The word on a chat Auto started unprompted (the web's 'Auto' badge, PRD-205 S7). */
  autoMarker: 'Auto',
  autoMarkerLabel: 'Started by Auto',
  openHint: 'Opens this conversation',
  justNow: 'Just now',
  minutes: (count: number) => `${count} min`,
  hours: (count: number) => `${count} h`,
  yesterday: 'Yesterday',
});

/**
 * The needs strip (the handoff's 2a): 'NEEDS YOU · N' and 'Command Centre →' over one card per
 * row the server listed; each card's status has a word (§4.6) and a mono meta line ('QUESTION ·
 * #0419'). The fallback titles are the web's (needs-you-widget.tsx) where it has one.
 */
export const NEEDS_COPY = Object.freeze({
  heading: (total: number) => `Needs you · ${total}`,
  commandCentre: 'Command Centre →',
  commandCentreLabel: 'Open the Command Centre',
  opensStudio: 'Opens Studio in your browser',
  /** Each kind's mono meta word and the word beside its status dot. */
  kinds: Object.freeze({
    question: Object.freeze({ meta: 'Question', word: 'Needs an answer' }),
    approval: Object.freeze({ meta: 'Approval', word: 'Needs approval' }),
    plan: Object.freeze({ meta: 'Mission plan', word: 'Needs approval' }),
    social: Object.freeze({ meta: 'Social post', word: 'To approve' }),
    review: Object.freeze({ meta: 'Review', word: 'To review' }),
    stuck: Object.freeze({ meta: 'Stuck', word: 'Stuck' }),
    failed: Object.freeze({ meta: 'Failed', word: 'Failed' }),
  }),
  untitledQuestion: 'An agent has a question',
  untitledApproval: 'An approval',
  untitledPlan: 'A mission plan',
  untitledPost: 'A social post',
  untitledTicket: 'A ticket',
});

/**
 * 'Ask Auto about #0419' (D-ASK-AUTO): the bar over a conversation about a ticket and the 'Update
 * ticket and re-queue' sheet, in the web's words (components/chatbot/discussion-bar.tsx and
 * rebrief-dialog.tsx). `ticket` is the vendored ticketCalled: the number as words (#0419), or
 * 'this ticket' for one with no number, never its row id as a number (F414). A ticket that would
 * not load is named by the id the link carried, as the web names it, with no '#'.
 */
export const DISCUSSION_COPY = Object.freeze({
  region: 'Discussion',
  discussing: (number: string | null, title: string) =>
    `Discussing ${number ?? 'this ticket'} — ${title}`,
  /** A ticket the server sent without a title (the web's mapTaskToBoardTask). */
  untitled: 'Untitled',
  openTicketHint: 'Opens the ticket',
  opening: 'Opening the ticket…',
  missing: (ticketId: string) =>
    `Ticket ${ticketId} could not be opened here. It may be in another workspace.`,
  retry: 'Try again',
  rebrief: 'Update ticket and re-queue',
  /** A Mission's ticket: its plan is decided on the Mission's page (PRD-252 D4). */
  decideMission: 'Decide on the mission →',
  end: 'End the discussion',
  sheetTitle: (ticket: string) => `Update ${ticket} and re-queue`,
  sheetIntro: (agent: string) =>
    `This brief replaces the ticket's, and ${agent} redoes the ticket from it. The old brief and the last draft stay on the ticket.`,
  /** A ticket with no agent named. */
  itsAgent: 'its agent',
  briefLabel: 'The agreed brief',
  briefPlaceholder: 'The brief you agreed with Auto.',
  briefRequired: 'Write the brief you agreed.',
  cancel: 'Cancel',
  save: 'Update and re-queue',
  saved: (ticket: string, agent: string) =>
    `${ticket} is back with ${agent}, working from the brief you agreed.`,
});

/**
 * Attachments (D-COMPOSER): the composer's [+], its sheet of Camera, Photo library and Files, the
 * chips above the pill, and why a file did not go. Only the camera has a permission to deny: the
 * photo library and Files are the system's own pickers, which the app reads only what you choose
 * from. A refusal names the file and says why in the kit's words, never the server's internals.
 */
export const ATTACH_COPY = Object.freeze({
  button: 'Attach',
  buttonHint: 'Adds a photo or a file to your message',
  sheetTitle: 'Add to your message',
  camera: 'Camera',
  cameraSummary: 'Take a photo',
  library: 'Photo library',
  librarySummary: 'Choose photos',
  files: 'Files',
  filesSummary: 'Choose a document',
  cameraDeniedTitle: "Automatos Go can't use the camera",
  cameraDenied: 'To take a photo for Auto, open Settings and allow Camera for Automatos Go.',
  openSettings: 'Open Settings',
  notNow: 'Not now',
  chips: 'Attachments',
  uploading: 'Uploading…',
  uploadingLabel: (name: string) => `${name}, uploading`,
  attachedLabel: (name: string) => `${name}, attached`,
  remove: (name: string) => `Remove ${name}`,
  notAttached: (name: string, reason: string) => `${name} wasn't attached. ${reason}`,
  tooBig: (megabytes: number) => `Files can be up to ${megabytes} MB.`,
  wrongType: "Auto can't take this kind of file.",
  empty: 'The file is empty.',
  unreadable: "The image couldn't be prepared to send.",
  pickerFailed: "That couldn't be opened. Try again.",
  full: (max: number) => `A message can carry up to ${max} files.`,
  /** The name of a photo the picker gave none (the camera's, a limited library's). */
  untitledPhoto: 'photo',
  untitledFile: 'file',
});
