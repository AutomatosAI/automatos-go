// HUD's transcript over A2's thread (US-016k, US-018b's HudTurn), pure: the newest turn as the core
// shows it. YOU is the user's last message (the draft being answered, else the newest saved one);
// AUTO is Auto's reply to it as plain text (A2's markdown lexed by its own markdownBlocks and read
// back as words, so the transcript never shows '**' or '#'): the live turn's words as they stream
// (a half-written list marker held back, as A2's thread holds it), else the saved reply after the
// user's message. A turn that failed or stopped says A2's notice in its words (D-NO-BILLING: never
// the server's). The clock runs from the user's message to Auto's reply. The agent answering is
// the live turn's (agent-info), else Auto. The saved reply carries its id where A2's thread offers
// Report this on that message (reportTarget on A2's own row: never a failure, never an id the
// server would refuse); the reply being written carries none (P001R-AF-1).
// HUD has no thread, so the day's brief (PRD-268 US-G06) fills the transcript slot while it is the
// newest message and no turn is live (hudBrief); OPEN BRIEF then opens its numbered rows.

import { briefOf } from '../../brief/model';
import type { Brief } from '../../brief/schema';
import { canStop, shownMessages, type ThreadState } from '../../chat/controller/thread';
import { markdownBlocks, type Block } from '../../chat/markdown/blocks';
import { spansText } from '../../chat/markdown/inline';
import { reportTarget } from '../../chat/report/report';
import type { StoredMessage } from '../../chat/schemas';
import { failureCopy, streamingText, threadRows, turnNotice } from '../../chat/view-model';
import { turnErrorCode } from '../../core/turn-reducer';
import { messageText, savedTurnError } from '../../core/web/lib/chat/message-text';
import { EMPTY_TURN, type HudTurn } from '../hud/core/model';

const LINE = '\n';

function blockWords(block: Block): string[] {
  switch (block.kind) {
    case 'paragraph':
    case 'heading':
      return [spansText(block.spans)];
    case 'list':
      return block.items.flatMap((item) => item.blocks.flatMap(blockWords));
    case 'code':
      return [block.text];
    case 'table':
      return [block.header, ...block.rows].map((row) => row.map(spansText).join(' · '));
    case 'quote':
      return block.blocks.flatMap(blockWords);
    case 'rule':
      return [];
  }
}

/** Auto's markdown as its words, one block a line; '' for none. */
export function plainText(markdown: string): string {
  return markdownBlocks(markdown)
    .flatMap(blockWords)
    .map((words) => words.trim())
    .filter(Boolean)
    .join(LINE);
}

function timeOf(iso: string | null | undefined): number | null {
  const at = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(at) ? at : null;
}

function lastIndexWhere(messages: readonly StoredMessage[], role: StoredMessage['role']): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === role) return index;
  }
  return -1;
}

/** A saved reply's words; a saved failure is A2's words for its code, as the thread says it. */
function savedReplyWords(reply: StoredMessage | undefined): string | null {
  if (!reply) return null;
  if (savedTurnError(reply) === null) return plainText(messageText(reply)) || null;
  return failureCopy({ kind: 'turn', code: turnErrorCode(reply.source?.code ?? null) }).text;
}

/**
 * The id Report this names for this saved message, where A2's thread offers it: A2's own row for
 * it through reportTarget (an Auto message, not a failure, an id the server takes); null otherwise.
 * The gate (canReport) is the caller's ThreadReport.
 */
export function reportableId(
  state: ThreadState,
  messageId: string | null | undefined,
): string | null {
  if (!messageId) return null;
  const rows = threadRows(state);
  const row = rows.find((each) => each.type === 'auto' && each.messageId === messageId);
  return row ? (reportTarget(row, true)?.target_id ?? null) : null;
}

type SavedExchange = { readonly turn: HudTurn; readonly replyId: string | null };

/** The newest saved exchange: the user's last message and the reply after it. */
function savedExchange(messages: readonly StoredMessage[]): SavedExchange {
  const asked = lastIndexWhere(messages, 'user');
  const question = asked >= 0 ? messages[asked] : undefined;
  const reply = messages.slice(asked + 1).find((message) => message.role === 'assistant');
  const turn = {
    you: question ? messageText(question) : null,
    auto: savedReplyWords(reply),
    streaming: false,
    startedAt: timeOf(question?.createdAt),
    endedAt: timeOf(reply?.createdAt),
  };
  return { turn, replyId: reply?.id ?? null };
}

/** The newest saved exchange as the core draws it, naming the reply for Report this. */
function savedTurn(state: ThreadState): HudTurn {
  const { turn, replyId } = savedExchange(shownMessages(state));
  return { ...turn, autoMessageId: turn.auto === null ? null : reportableId(state, replyId) };
}

/** The turn on screen: the draft (or the saved question a reopened turn answers) and the reply so far. */
function liveTurn(state: ThreadState): HudTurn {
  const { live } = state;
  if (!live) return EMPTY_TURN;
  const before = savedExchange(shownMessages(state)).turn;
  const streaming = canStop(state);
  const words = plainText(streaming ? streamingText(live.turn.text) : live.turn.text);
  return {
    you: live.draft ? live.draft.text : before.you,
    auto: words || null,
    streaming,
    // not saved yet, or a stop or failure A2 says in its own words
    autoMessageId: null,
    agent: live.turn.agent ?? undefined,
    startedAt: live.draft ? timeOf(live.draft.sentAt) : before.startedAt,
    endedAt: null,
  };
}

/** The newest turn as HUD's core draws it; EMPTY_TURN for a blank draft (First open's hint). */
export function hudTurn(state: ThreadState): HudTurn {
  if (state.status === 'loading') return EMPTY_TURN;
  const turn = state.live ? liveTurn(state) : savedTurn(state);
  const notice = turnNotice(state);
  const auto = turn.auto ?? (notice ? notice.text : null);
  if (turn.you === null && auto === null && !turn.streaming) return EMPTY_TURN;
  return { ...turn, auto };
}

export type HudBrief = { readonly brief: Brief; readonly messageId: string };

/**
 * Today's brief while it is the newest message and no turn is live (yesterday's never fills the
 * slot), with its message for Report this; null otherwise.
 */
export function hudBrief(state: ThreadState, today: string): HudBrief | null {
  if (state.status === 'loading' || state.live) return null;
  const messages = shownMessages(state);
  const newest = messages[messages.length - 1];
  const brief = newest?.role === 'assistant' ? briefOf(newest) : null;
  return newest && brief && brief.date === today ? { brief, messageId: newest.id } : null;
}
