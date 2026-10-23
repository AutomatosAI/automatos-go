// The thread as rows (US-008c), pure: what MessageList draws for a ThreadState. A saved message is
// one row (the user's bubble, or Auto's message with its receipts); a live turn is the user's draft
// and Auto's reply so far (text with narration already taken out by turnReducer, tool lines, the
// receipts, the limit and attachment notices); then 'Auto is working…' while a turn runs and one
// notice for a turn that failed, stopped or could not be stopped. Receipts and tool lines are built
// by lines.ts; every notice's mark has a word for screen readers (§4.6). Every failure says the
// kit's own words (strings.ts): the server's may name a plan (D-NO-BILLING). Auto's cards sit inside
// the reply that raised them (cards/view.ts places them), and the tickets a reply filed or checked
// are its own (a saved task_card part, or the live turn's). The components only draw these rows.

import { ApiError } from '../api/errors';
import {
  TURN_ERROR_CODES,
  turnErrorCode,
  type TurnErrorCode,
  type TurnState,
} from '../core/turn-reducer';
import { MARK_FAILED, MARK_MUTED, type LineTone } from '../core/web/components/play/chat/labels';
import { messageText, savedTurnError } from '../core/web/lib/chat/message-text';
import { receiptsOf } from '../core/web/lib/chat/receipts';
import { lastTurn } from '../core/web/lib/chat/retry';
import { joinLabel } from '../ui/paint';
import { errorCopy } from '../ui/variants';
import { placedCards, type CardRow, type PlacedCards, type TicketRow } from './cards/view';
import { ticketRows } from './cards/view-tools';
import { canSend, shownMessages, type ThreadFailure, type ThreadState } from './controller/thread';
import {
  receiptsView,
  toolLineRows,
  type LineOptions,
  type ReceiptsView,
  type ToolLineRow,
} from './lines';
import type { ChatFile } from './request';
import type { StoredMessage } from './schemas';
import { CHAT_COPY, NOTICE_WORDS, TURN_ERROR_COPY, type FailureCopy } from './strings';

export {
  MARK_COLOURS,
  receiptBadge,
  receiptsView,
  toolLineRows,
  type ReceiptRow,
  type ReceiptsView,
  type ToolLineRow,
} from './lines';

export type NoticeKind = keyof typeof NOTICE_WORDS;

export type Notice = {
  readonly key: string;
  readonly kind: NoticeKind;
  readonly mark: string;
  readonly tone: LineTone;
  readonly text: string;
  readonly accessibilityLabel: string;
  /** Only the newest failure the user can ask again offers Try again. */
  readonly retry: boolean;
};

export type UserRow = {
  readonly type: 'user';
  readonly key: string;
  readonly text: string;
  readonly files: readonly string[];
  readonly accessibilityLabel: string;
};

export type AutoRow = {
  readonly type: 'auto';
  readonly key: string;
  /** The saved message's id (Report this); null for the reply still being written. */
  readonly messageId: string | null;
  readonly paragraphs: readonly string[];
  readonly toolLines: readonly ToolLineRow[];
  readonly receipts: ReceiptsView | null;
  readonly notices: readonly Notice[];
  /** The tickets this reply filed or checked ('#0431: filed to Inbox'). */
  readonly tickets: readonly TicketRow[];
  /** Auto's cards this reply raised (a Mission suggestion, a plan or a tool to approve, …). */
  readonly cards: readonly CardRow[];
};

export type ChatRow =
  | UserRow
  | AutoRow
  | { readonly type: 'working'; readonly key: string }
  | { readonly type: 'notice'; readonly key: string; readonly notice: Notice }
  /** Cards whose reply was never saved (a stopped or failed turn): after the saved messages. */
  | { readonly type: 'cards'; readonly key: string; readonly cards: readonly CardRow[] };

export type ViewOptions = LineOptions;

export const LIVE_USER_KEY = 'live-user';
export const LIVE_AUTO_KEY = 'live-auto';
export const WORKING_KEY = 'working';
export const TURN_NOTICE_KEY = 'turn-notice';
export const LOOSE_CARDS_KEY = 'loose-cards';

const PARAGRAPH_BREAK = /\n{2,}/;
const KNOWN_TURN_CODES: ReadonlySet<string> = new Set(TURN_ERROR_CODES);

/** Auto's answer as the handoff draws it: plain paragraphs (KC5). */
export function paragraphs(text: string): string[] {
  return text
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** A failure is marked ✕; a limit, a file Auto could not open and a stop are muted. */
const NOTICE_LOOK: Readonly<
  Record<NoticeKind, { readonly mark: string; readonly tone: LineTone }>
> = Object.freeze({
  failed: { mark: MARK_FAILED, tone: 'failed' },
  stopFailed: { mark: MARK_FAILED, tone: 'failed' },
  limit: { mark: MARK_MUTED, tone: 'muted' },
  attachment: { mark: MARK_MUTED, tone: 'muted' },
  stopped: { mark: MARK_MUTED, tone: 'muted' },
});

function notice(key: string, kind: NoticeKind, text: string, retry = false): Notice {
  const label = joinLabel(NOTICE_WORDS[kind], text);
  return { key, kind, ...NOTICE_LOOK[kind], text, accessibilityLabel: label, retry };
}

/** A failed turn in the kit's words: by its turn code, else by the client's error kind. */
export function failureCopy(failure: ThreadFailure): FailureCopy {
  if (failure.kind === 'turn') return TURN_ERROR_COPY[failure.code];
  if (failure.code !== null && KNOWN_TURN_CODES.has(failure.code))
    return TURN_ERROR_COPY[failure.code as TurnErrorCode];
  // never the server's words: the error carries the kind and code only
  const copy = errorCopy(new ApiError(failure.kind, failure.code ? { code: failure.code } : {}));
  return { text: copy.message, canRetry: copy.canRetry };
}

/** A saved failure by its code, as a turn's (an unknown or missing one is turn_failed). */
function savedFailureCopy(message: StoredMessage): FailureCopy {
  return failureCopy({ kind: 'turn', code: turnErrorCode(message.source?.code ?? null) });
}

function filesOf(message: StoredMessage): string[] {
  const named = [
    ...message.parts.flatMap((part) => (part.type === 'file' ? [part.filename] : [])),
    ...message.attachments.map((attachment) => attachment.filename),
  ].filter(Boolean);
  return [...new Set(named)];
}

function userRow(key: string, text: string, files: readonly string[]): UserRow | null {
  const words = text.trim();
  if (!words && files.length === 0) return null;
  const attached = files.length > 0 ? `${CHAT_COPY.attached}: ${files.join(', ')}` : null;
  return {
    type: 'user',
    key,
    text: words,
    files,
    accessibilityLabel: joinLabel(CHAT_COPY.youSaid, words, attached),
  };
}

function autoRow(row: Omit<AutoRow, 'type'>): AutoRow | null {
  const empty =
    row.paragraphs.length === 0 &&
    row.toolLines.length === 0 &&
    row.receipts === null &&
    row.notices.length === 0 &&
    row.tickets.length === 0 &&
    row.cards.length === 0;
  return empty ? null : { type: 'auto', ...row };
}

/** A saved message; `newest`: the thread's last, which alone may offer Try again. */
function storedRow(
  message: StoredMessage,
  newest: boolean,
  cards: readonly CardRow[],
  options: ViewOptions,
): ChatRow | null {
  if (message.role === 'user') return userRow(message.id, messageText(message), filesOf(message));
  const base = { key: message.id, messageId: message.id, toolLines: [], receipts: null, cards };
  if (savedTurnError(message) !== null) {
    const copy = savedFailureCopy(message);
    const failed = notice(`${message.id}-failed`, 'failed', copy.text, newest && copy.canRetry);
    return autoRow({ ...base, paragraphs: [], notices: [failed], tickets: [] });
  }
  return autoRow({
    ...base,
    tickets: ticketRows(
      message.parts.flatMap((part) => (part.type === 'task_card' ? [part.card] : [])),
    ),
    paragraphs: paragraphs(messageText(message)),
    receipts: receiptsView(receiptsOf(message), options),
    notices: [],
  });
}

function turnNotices(turn: TurnState): Notice[] {
  const limit = turn.limitReached ? [notice('limit', 'limit', CHAT_COPY.limit)] : [];
  const files = turn.attachmentsUnavailable.map((file, index) =>
    notice(`attachment-${index}`, 'attachment', CHAT_COPY.attachmentUnavailable(file.filename)),
  );
  return [...limit, ...files];
}

/** The reply being written (or the one a stopped or failed turn left). */
function liveAutoRow(
  turn: TurnState,
  streaming: boolean,
  cards: readonly CardRow[],
  options: ViewOptions,
): AutoRow | null {
  return autoRow({
    key: LIVE_AUTO_KEY,
    messageId: null,
    paragraphs: [...(turn.receiptsAbove ?? []), ...paragraphs(turn.text)],
    toolLines: toolLineRows(turn.toolCalls, streaming),
    receipts: receiptsView(turn.receipts, options),
    notices: turnNotices(turn),
    tickets: ticketRows(turn.taskCards),
    cards,
  });
}

function isRow(row: ChatRow | null): row is ChatRow {
  return row !== null;
}

function liveRows(state: ThreadState, cards: PlacedCards, options: ViewOptions): ChatRow[] {
  const { live } = state;
  if (!live) return [];
  const { draft } = live;
  const user = draft
    ? userRow(
        LIVE_USER_KEY,
        draft.text,
        draft.files.map((file) => file.filename),
      )
    : null;
  const rows: (ChatRow | null)[] = [
    user,
    liveAutoRow(live.turn, state.status === 'streaming', cards.live, options),
  ];
  return rows.filter(isRow);
}

/** 'Auto is working…' while a turn runs and its answer has not started. */
export function isWorking(state: ThreadState): boolean {
  const running = state.status === 'streaming' || state.status === 'working';
  return running && !state.live?.turn.text.trim();
}

/** The one notice under the thread: a stop, a stop that did not reach the server, or a failure. */
export function turnNotice(state: ThreadState): Notice | null {
  if (state.status === 'stopped') return notice(TURN_NOTICE_KEY, 'stopped', CHAT_COPY.stopped);
  if (!state.failure) return null;
  if (state.status === 'working')
    return notice(TURN_NOTICE_KEY, 'stopFailed', CHAT_COPY.stopFailed);
  if (state.status !== 'failed') return null;
  const copy = failureCopy(state.failure);
  const retry = copy.canRetry && canSend(state) && retryInput(state) !== null;
  return notice(TURN_NOTICE_KEY, 'failed', copy.text, retry);
}

function looseRow(cards: readonly CardRow[]): ChatRow {
  return { type: 'cards', key: LOOSE_CARDS_KEY, cards };
}

/** Every row of the thread, oldest first; nothing while the chat is still being checked. */
export function threadRows(state: ThreadState, options: ViewOptions = {}): ChatRow[] {
  if (state.status === 'loading') return [];
  const messages = shownMessages(state);
  const askable = state.live === null && canSend(state) && retryInput(state) !== null;
  const cards = placedCards(state, options.webUrl);
  const saved = messages.map((message, index) =>
    storedRow(message, askable && index === messages.length - 1, cards.at(index), options),
  );
  const loose = cards.loose.length > 0 ? [looseRow(cards.loose)] : [];
  const pending = turnNotice(state);
  return [
    ...saved.filter(isRow),
    ...loose,
    ...liveRows(state, cards, options),
    ...(isWorking(state) ? [{ type: 'working' as const, key: WORKING_KEY }] : []),
    ...(pending ? [{ type: 'notice' as const, key: pending.key, notice: pending }] : []),
  ];
}

/** What Try again sends: the failed message's words and files (files only: blank words). */
export type RetryInput = { readonly text: string; readonly files: readonly ChatFile[] };

/**
 * Try again's message (the vendored retry.ts rule: the user's last message, asked anew): the live
 * turn's draft whenever it has one, its words AND its files (each keeps its attachment_id, which
 * the server resolves, so nothing uploads again); with no live draft (a saved turn_error), the
 * newest saved message of the user's, its words only. null when there is nothing to ask again.
 */
export function retryInput(state: ThreadState): RetryInput | null {
  const draft = state.live?.draft;
  if (draft) {
    const text = draft.text.trim();
    return text || draft.files.length > 0 ? { text, files: draft.files } : null;
  }
  const words = lastTurn(state.messages)?.content.trim();
  return words ? { text: words, files: [] } : null;
}

/** MessageList scrolls to the end only when a row is added, never as a reply grows. */
export function shouldScrollToEnd(previousCount: number, nextCount: number): boolean {
  return nextCount > previousCount;
}

/** The handoff's pulse (opacity 1 → 0.35 → 1 over 1.4 s); none under Reduce Motion (§4.6). */
export const WORKING_PULSE = Object.freeze({ dimmest: 0.35, periodMs: 1400 });

export function workingMotion(reduceMotion: boolean): { readonly pulse: boolean } {
  return { pulse: !reduceMotion };
}
