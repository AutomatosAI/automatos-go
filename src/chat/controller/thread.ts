// One conversation's state (US-008b, D-STOP, D-STALE-CHAT): the saved messages (GET
// /api/chat/{id}/messages) and, while a turn is on screen, the user's message and that turn folded
// by the foundation's turnReducer. Pure and immutable: threadReducer returns a NEW state and never
// mutates its arguments. A live turn holds back the saved messages from where it started: the
// server saves the user's message before it streams and the reply when it ends, so showing both
// would draw the turn twice. A refetch that brings the reply retires the live turn (merge by id,
// never a duplicate); a turn the server failed (an e: line) stays until the next send, so its
// failure keeps the kit's own words (D-NO-BILLING). The turn runs detached on the server: Stop is a
// cancel as well as an abort (turn-runner.ts), and a chat reopened mid-turn shows Auto working
// until chat_changed or a resume brings the reply (web: frontend/lib/chat/hooks.ts, PRD-237 S7).
// Auto's cards (cards/model.ts) are filed on the thread as frames raise them, with the user's
// outcome, so they outlive the live turn: the saved reply carries none.

import type { Frame } from '../../core/ai-sdk-stream';
import {
  initialTurn,
  turnErrorCode,
  turnReducer,
  type TurnErrorCode,
  type TurnState,
} from '../../core/turn-reducer';
import { completeRunningToolCalls } from '../../core/web/lib/chat/tool-calls';
import { isApiError, type ApiErrorKind } from '../../api/errors';
import {
  fileCards,
  raisedCards,
  rebaseCards,
  settleCard,
  type CardOutcome,
  type FiledCard,
} from '../cards/model';
import type { ChatFile } from '../request';
import type { ChatThread, StoredMessage } from '../schemas';

/** The web gives up waiting for a detached reply after this long (hooks.ts AWAITING_REPLY_GUARD_MS). */
export const AWAITING_REPLY_GUARD_MS = 5 * 60_000;

/**
 * loading: the cached id is being checked; idle: nothing running (a draft has no id); streaming:
 * this phone is reading a turn; working: a turn runs on the server that this phone is not reading
 * (reopened mid-turn, or Stop did not reach the server); stopped: Stop was pressed; failed: the
 * last turn failed.
 */
export type ThreadStatus = 'loading' | 'idle' | 'streaming' | 'working' | 'stopped' | 'failed';

/** The client's taxonomy kind (src/api/errors.ts), or 'turn': the server's e: line, by its code. */
export type ThreadFailure =
  | { readonly kind: ApiErrorKind; readonly code: string | null }
  | { readonly kind: 'turn'; readonly code: TurnErrorCode };

/** What the user sent, drawn as their message until the saved copy replaces it. */
export type ThreadDraft = {
  readonly text: string;
  readonly files: readonly ChatFile[];
  readonly sentAt: string | null;
};

export type LiveTurn = {
  /** null while waiting on a turn this launch did not send (reopened mid-turn). */
  readonly draft: ThreadDraft | null;
  readonly turn: TurnState;
  /** The saved messages before it; the ones from here on are held back until it retires. */
  readonly since: number;
};

export type ThreadState = {
  /** null for a draft: the first message creates the chat and the chat-id frame names it. */
  readonly chatId: string | null;
  readonly status: ThreadStatus;
  readonly messages: readonly StoredMessage[];
  readonly live: LiveTurn | null;
  readonly failure: ThreadFailure | null;
  /** Auto's cards in this conversation, oldest first, each with what the user did with it. */
  readonly cards: readonly FiledCard[];
};

export type ThreadAction =
  | { readonly type: 'opened'; readonly chatId: string | null }
  | {
      readonly type: 'loaded';
      readonly chatId: string | null;
      readonly messages: readonly StoredMessage[];
      readonly turnInFlight: boolean;
    }
  | { readonly type: 'send'; readonly draft: ThreadDraft }
  | { readonly type: 'frame'; readonly frame: Frame; readonly at?: string }
  | { readonly type: 'finished' }
  | { readonly type: 'failed'; readonly error: unknown }
  | { readonly type: 'stopped'; readonly at: string }
  | { readonly type: 'stopFailed'; readonly error: unknown }
  /** A draft stopped before its chat-id frame: the frame came later and names the chat. */
  | { readonly type: 'named'; readonly chatId: string }
  | { readonly type: 'refetched'; readonly messages: readonly StoredMessage[] }
  | { readonly type: 'gaveUp' }
  /** The user acted on a card and the server agreed (or dismissed a suggestion). */
  | { readonly type: 'card'; readonly key: string; readonly outcome: CardOutcome };

type ActionOf<K extends ThreadAction['type']> = Extract<ThreadAction, { type: K }>;
type Handler<K extends ThreadAction['type']> = (
  state: ThreadState,
  action: ActionOf<K>,
) => ThreadState;
type Handlers = { readonly [K in ThreadAction['type']]: Handler<K> };

const SENDABLE: ReadonlySet<ThreadStatus> = new Set(['idle', 'stopped', 'failed']);
const STOPPABLE: ReadonlySet<ThreadStatus> = new Set(['streaming', 'working']);

/** A cached id starts loading (it is checked first); no id is a draft, ready to send. */
export function createThread(chatId: string | null): ThreadState {
  return {
    chatId,
    status: chatId === null ? 'idle' : 'loading',
    messages: [],
    live: null,
    failure: null,
    cards: [],
  };
}

export function canSend(state: ThreadState): boolean {
  return SENDABLE.has(state.status);
}

export function canStop(state: ThreadState): boolean {
  return STOPPABLE.has(state.status);
}

/** The saved messages to draw: those a live turn holds back are left out until it retires. */
export function shownMessages(state: ThreadState): readonly StoredMessage[] {
  return state.live ? state.messages.slice(0, state.live.since) : state.messages;
}

/** A thrown failure in the client's taxonomy; anything else is 'server' (userMessage's rule). */
export function failureOf(error: unknown): ThreadFailure {
  return isApiError(error)
    ? { kind: error.kind, code: error.code ?? null }
    : { kind: 'server', code: null };
}

function uniqueById(messages: readonly StoredMessage[]): StoredMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

/**
 * `known` with each message the server sent again replaced by its fresh copy and the new ones
 * appended in the server's order; never a second copy of an id. The same array when nothing changed.
 */
export function mergeById(
  known: readonly StoredMessage[],
  fetched: readonly StoredMessage[],
): readonly StoredMessage[] {
  const fresh = new Map(fetched.map((message) => [message.id, message] as const));
  const knownIds = new Set(known.map((message) => message.id));
  const updated = known.map((message) => fresh.get(message.id) ?? message);
  const added = uniqueById(fetched.filter((message) => !knownIds.has(message.id)));
  const changed = added.length > 0 || updated.some((message, index) => message !== known[index]);
  return changed ? [...updated, ...added] : known;
}

/**
 * What opening a chat comes to: a draft once the check said the id may not be reused (null), the
 * chat once its saved list is in; null while either answer is still out.
 */
export function loadedAction(
  checked: ChatThread | null | undefined,
  messages: readonly StoredMessage[] | undefined,
): ThreadAction | null {
  if (checked === null) return { type: 'loaded', chatId: null, messages: [], turnInFlight: false };
  if (checked === undefined || messages === undefined) return null;
  return { type: 'loaded', chatId: checked.id, messages, turnInFlight: checked.turnInFlight };
}

function liveTurn(draft: ThreadDraft | null, chatId: string | null, since: number): LiveTurn {
  return { draft, turn: { ...initialTurn, chatId }, since };
}

/** turnInFlight with the user's message newest: the reply has not been saved yet. */
function awaitsReply(messages: readonly StoredMessage[], turnInFlight: boolean): boolean {
  return turnInFlight && messages[messages.length - 1]?.role !== 'assistant';
}

function loaded(state: ThreadState, action: ActionOf<'loaded'>): ThreadState {
  if (state.status !== 'loading')
    return refetched(state, { type: 'refetched', messages: action.messages });
  const waiting = awaitsReply(action.messages, action.turnInFlight);
  return {
    chatId: action.chatId,
    status: waiting ? 'working' : 'idle',
    messages: action.messages,
    live: waiting ? liveTurn(null, action.chatId, action.messages.length) : null,
    failure: null,
    cards: state.cards,
  };
}

function send(state: ThreadState, action: ActionOf<'send'>): ThreadState {
  if (!canSend(state)) return state;
  return {
    ...state,
    status: 'streaming',
    live: liveTurn(action.draft, state.chatId, state.messages.length),
    failure: null,
  };
}

/** The chat-id frame names the chat; another id than ours means the server opened a new one. */
function adoptChatId(state: ThreadState, live: LiveTurn, chatId: string): ThreadState {
  if (state.chatId === null || state.chatId === chatId) return { ...state, chatId, live };
  const cards = rebaseCards(state.cards, live.since, 0);
  return { ...state, chatId, messages: [], live: { ...live, since: 0 }, cards };
}

function frame(state: ThreadState, action: ActionOf<'frame'>): ThreadState {
  if (state.status !== 'streaming' || !state.live) return state;
  const live = { ...state.live, turn: turnReducer(state.live.turn, action.frame, action.at) };
  if (action.frame.kind === 'chat-id') return adoptChatId(state, live, action.frame.chatId);
  const cards = fileCards(state.cards, raisedCards(live.turn), live.since);
  return { ...state, live, cards };
}

function finished(state: ThreadState): ThreadState {
  if (state.status !== 'streaming') return state;
  const error = state.live?.turn.error;
  if (!error) return { ...state, status: 'idle' };
  return { ...state, status: 'failed', failure: { kind: 'turn', code: turnErrorCode(error.code) } };
}

function failed(state: ThreadState, action: ActionOf<'failed'>): ThreadState {
  if (state.status !== 'streaming') return state;
  return { ...state, status: 'failed', failure: failureOf(action.error) };
}

/** Nothing may keep spinning once the turn is stopped (the web's tool-calls.ts rule). */
function stopped(state: ThreadState, action: ActionOf<'stopped'>): ThreadState {
  if (!canStop(state)) return state;
  const live = state.live && {
    ...state.live,
    turn: {
      ...state.live.turn,
      toolCalls:
        completeRunningToolCalls(state.live.turn.toolCalls, action.at) ?? state.live.turn.toolCalls,
    },
  };
  return { ...state, status: 'stopped', live, failure: null };
}

/** The cancel did not reach the server, so the turn is still running there: Auto is working. */
function stopFailed(state: ThreadState, action: ActionOf<'stopFailed'>): ThreadState {
  if (state.status !== 'stopped') return state;
  return { ...state, status: 'working', failure: failureOf(action.error) };
}

/** Only while nothing newer started: a new send's turn will be named by its own frame. */
function named(state: ThreadState, action: ActionOf<'named'>): ThreadState {
  if (state.status !== 'stopped' || state.chatId !== null) return state;
  const live = state.live && { ...state.live, turn: { ...state.live.turn, chatId: action.chatId } };
  return { ...state, chatId: action.chatId, live };
}

/** A turn the server failed keeps its failure on screen; any other settled turn may retire. */
function mayRetire(state: ThreadState): boolean {
  if (state.status === 'failed') return state.failure?.kind !== 'turn';
  return state.status === 'idle' || state.status === 'working' || state.status === 'stopped';
}

function refetched(state: ThreadState, action: ActionOf<'refetched'>): ThreadState {
  if (state.status === 'loading') return state;
  const messages = mergeById(state.messages, action.messages);
  const live = state.live;
  const replied =
    live !== null && messages.slice(live.since).some((message) => message.role === 'assistant');
  if (replied && mayRetire(state))
    return { ...state, status: 'idle', messages, live: null, failure: null };
  return messages === state.messages ? state : { ...state, messages };
}

function gaveUp(state: ThreadState): ThreadState {
  return state.status === 'working' ? { ...state, status: 'idle', live: null } : state;
}

function card(state: ThreadState, action: ActionOf<'card'>): ThreadState {
  const cards = settleCard(state.cards, action.key, action.outcome);
  return cards === state.cards ? state : { ...state, cards };
}

const HANDLERS: Handlers = {
  opened: (_state, action) => createThread(action.chatId),
  loaded,
  send,
  frame,
  finished,
  failed,
  stopped,
  stopFailed,
  named,
  refetched,
  gaveUp,
  card,
};

export function threadReducer(state: ThreadState, action: ThreadAction): ThreadState {
  // TypeScript cannot correlate HANDLERS[type] with the narrowed action; the mapped type checks each entry.
  const handle = HANDLERS[action.type] as Handler<ThreadAction['type']>;
  return handle(state, action);
}
