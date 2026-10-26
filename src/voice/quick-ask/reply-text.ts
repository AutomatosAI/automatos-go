// Auto's reply to the turn quick-ask sent (KV6, US-019g), read from A2's thread state. Pure: no
// React, React Native or Expo.
//   Which turn: the voice screen's thread may also carry typed turns (TYPE) and a turn reopened
//   mid-flight, so quick-ask follows its own by identity. trackTurn() waits for the live turn whose
//   draft is new since the send ('awaiting'), then follows it while it stays the live turn
//   ('following'), keeping where it started (since) and the turn as last seen.
//   The reply: while the turn is live, Auto's text as A2's view-model shows it (turnReducer has taken
//   narration out, streamingText holds back a lone list marker), never the receipts or the lines
//   above them, the tool lines or the cards. Once the thread retires the live turn (its saved reply
//   arrived), the reply is that saved message's text without the platform's lines above it, so a
//   reply that finished and was saved in one step is still heard to its end.
//   toolCaption: the running call's words while the turn streams ('Searching the web'), else the
//   call waiting on the owner ('Waiting for you'): the vendored toolLineLabel, without the detail or
//   the summary (the state chip shows them in capitals). hasCards and hasReceipts say the chat holds
//   more than the voice says ('See it in the chat').

import { raisedCards } from '../../chat/cards/model';
import type { LiveTurn, ThreadDraft, ThreadState } from '../../chat/controller/thread';
import type { StoredMessage } from '../../chat/schemas';
import { streamingText } from '../../chat/view-model';
import type { TurnState } from '../../core/turn-reducer';
import { toolLineLabel } from '../../core/web/components/play/chat/labels';
import { messageText, savedTurnError } from '../../core/web/lib/chat/message-text';
import { receiptsOf } from '../../core/web/lib/chat/receipts';
import type { ToolCall } from '../../core/web/types';
import type { TurnFailureKind } from '../machine/voice-state';

/** The turn quick-ask sent: its draft (by identity), where it started, and the turn as last seen. */
export type QuickAskTurn = {
  readonly draft: ThreadDraft;
  readonly since: number;
  readonly last: TurnState;
};

export type TurnTracking =
  /** Sent: the next new live draft is quick-ask's (`before`: the live draft at the send). */
  | { readonly kind: 'awaiting'; readonly before: ThreadDraft | null }
  | { readonly kind: 'following'; readonly turn: QuickAskTurn };

export type QuickAskReply = {
  /** Auto's text parts only, as markdown (toSpeakable makes them speakable). */
  readonly text: string;
  readonly streaming: boolean;
  /** The turn ended as it should: the rest of the text may be spoken. */
  readonly finished: boolean;
  /** A2's Stop ended it (from anywhere): nothing more is spoken. */
  readonly stopped: boolean;
  readonly failedKind?: TurnFailureKind;
  readonly toolCaption?: string;
  /** Auto's cards or tickets came with the reply. */
  readonly hasCards: boolean;
  /** The reply lists what Auto did (receipts). */
  readonly hasReceipts: boolean;
  /** The answering agent's name when the turn named one (agent-info). */
  readonly agentName?: string;
};

/** A2's thread is reading the turn, or the turn runs on the server while it is not. */
const RUNNING: ReadonlySet<ThreadState['status']> = new Set(['streaming', 'working']);

export function awaitingTurn(state: ThreadState): TurnTracking {
  return Object.freeze({ kind: 'awaiting', before: state.live?.draft ?? null });
}

function following(draft: ThreadDraft, live: LiveTurn): TurnTracking {
  return Object.freeze({
    kind: 'following',
    turn: Object.freeze({ draft, since: live.since, last: live.turn }),
  });
}

/** The tracking after this thread state: the same object when nothing about the turn changed. */
export function trackTurn(tracking: TurnTracking, state: ThreadState): TurnTracking {
  const live = state.live;
  const draft = live?.draft ?? null;
  if (live === null || draft === null) return tracking;
  if (tracking.kind === 'awaiting')
    return draft !== tracking.before ? following(draft, live) : tracking;
  const { turn } = tracking;
  if (draft !== turn.draft) return tracking;
  if (live.since === turn.since && live.turn === turn.last) return tracking;
  return following(draft, live);
}

/** A call as the vendored labels read it, without the input's detail or the summary. */
function bareCall(call: ToolCall) {
  return {
    toolCallId: call.toolCallId,
    toolName: call.toolName,
    state: call.state,
    skipped: call.skipped ?? false,
    waiting: call.waiting ?? false,
  };
}

function newestRunning(calls: readonly ToolCall[]): ToolCall | undefined {
  return [...calls].reverse().find((call) => call.state === 'running');
}

function waitingCall(turn: TurnState): ToolCall | undefined {
  const id = turn.waitingToolCallId;
  return id === null ? undefined : turn.toolCalls.find((call) => call.toolCallId === id);
}

export function toolCaption(turn: TurnState, streaming: boolean): string | undefined {
  const call = (streaming ? newestRunning(turn.toolCalls) : undefined) ?? waitingCall(turn);
  return call ? toolLineLabel(bareCall(call), streaming).text : undefined;
}

function agentOf(turn: TurnState): { readonly agentName?: string } {
  const name = turn.agent?.name?.trim();
  return name ? { agentName: name } : {};
}

/** The saved text without the platform's lines above the reply (receipts.ts: saved at its top). */
export function withoutAbove(text: string, above: readonly string[] | undefined): string {
  if (!above || above.length === 0) return text;
  const lines = new Set(above.map((line) => line.trim()));
  const rows = text.split('\n');
  const first = rows.findIndex((row) => row.trim() !== '' && !lines.has(row.trim()));
  return first < 0 ? '' : rows.slice(first).join('\n');
}

/** How the live turn stands: read as it streams (or running on), finished, stopped or failed. */
function liveStatus(state: ThreadState) {
  const streaming = RUNNING.has(state.status);
  const failed = state.status === 'failed';
  const stopped = state.status === 'stopped';
  return {
    streaming,
    finished: !streaming && !failed && !stopped,
    stopped,
    ...(failed ? { failedKind: state.failure?.kind ?? 'turn' } : {}),
  };
}

function fromLive(state: ThreadState, turn: TurnState): QuickAskReply {
  const status = liveStatus(state);
  const caption = toolCaption(turn, status.streaming);
  return Object.freeze({
    text: status.streaming ? streamingText(turn.text) : turn.text,
    ...status,
    ...(caption === undefined ? {} : { toolCaption: caption }),
    hasCards: raisedCards(turn).length > 0 || turn.taskCards.length > 0,
    hasReceipts: (turn.receipts?.length ?? 0) > 0,
    ...agentOf(turn),
  });
}

/** Auto's saved reply to the turn: the first assistant message from where the turn started. */
function savedReply(state: ThreadState, turn: QuickAskTurn): StoredMessage | undefined {
  return state.messages.slice(turn.since).find((message) => message.role === 'assistant');
}

function fromSaved(state: ThreadState, turn: QuickAskTurn): QuickAskReply | null {
  const message = savedReply(state, turn);
  if (message === undefined) return null;
  const failed = savedTurnError(message) !== null;
  const cards =
    state.cards.some((card) => card.since === turn.since) ||
    message.parts.some((part) => part.type === 'task_card');
  return Object.freeze({
    text: failed ? '' : withoutAbove(messageText(message), turn.last.receiptsAbove),
    streaming: false,
    finished: !failed,
    stopped: false,
    ...(failed ? { failedKind: 'turn' as const } : {}),
    hasCards: cards,
    hasReceipts: (receiptsOf(message)?.length ?? 0) > 0,
    ...agentOf(turn.last),
  });
}

/** The reply to quick-ask's turn; null while it has not shown up, or once it can no longer be read. */
export function quickAskReply(state: ThreadState, tracking: TurnTracking): QuickAskReply | null {
  if (tracking.kind === 'awaiting') return null;
  const { turn } = tracking;
  if (state.live !== null && state.live.draft === turn.draft)
    return fromLive(state, state.live.turn);
  return fromSaved(state, turn);
}
