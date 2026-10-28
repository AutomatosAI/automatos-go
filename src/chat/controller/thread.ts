// One conversation's state (US-008b, D-STOP, D-STALE-CHAT): the saved messages (GET
// /api/chat/{id}/messages) and, while a turn is on screen, the user's message and that turn folded
// by the foundation's turnReducer. Pure and immutable: threadReducer returns a NEW state and never
// mutates its arguments. A live turn holds back the saved messages from where it started: the
// server saves the user's message before it streams and the reply when it ends, so showing both
// would draw the turn twice. A refetch that brings the reply retires the live turn (merge by id,
// never a duplicate); a reply saved before the read ends (the server's memory step runs with the
// stream still open) is held back while it streams and retires the turn when the read settles
// (finished, failed, stopped); a turn the server failed (an e: line) stays until the next send, so
// its failure keeps the kit's own words (D-NO-BILLING). A turn that ended in a named chat without
// retiring is settling until the after-turn refetch answers (settled): no send before it, since the
// next turn would start ahead of this one's saved messages and its reply would retire that turn.
// The turn runs detached on the server: Stop is a cancel as well as an abort (turn-runner.ts) and
// leaves the turn's tool calls as they are, so one it cut off reads 'Stopped: …', never done; a
// chat reopened mid-turn shows Auto working until chat_changed or a resume brings the reply (web:
// frontend/lib/chat/hooks.ts, PRD-237 S7); and a read that broke (iOS suspends the app mid-turn)
// is a failure only until GET /api/chat/{id} says the turn runs on: then Auto is working, never
// 'interrupted, Try again' (a second turn).
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
  /** A turn ended unretired: no send until the after-turn refetch has answered (settled). */
  readonly settling: boolean;
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
  /** The after-turn refetch answered (or failed): `messages`, the saved list left in the cache. */
  | { readonly type: 'settled'; readonly messages: readonly StoredMessage[] }
  | { readonly type: 'gaveUp' }
  /** GET /api/chat/{id}'s answer after a read broke mid-turn (awaitsDetachedCheck). */
  | { readonly type: 'detached'; readonly turnInFlight: boolean }
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
/** A read that broke: the turn may run on without it. Never 'turn': an e: line is the server's. */
const DETACHABLE: ReadonlySet<ThreadFailure['kind']> = new Set(['stream', 'network']);

/** A cached id starts loading (it is checked first); no id is a draft, ready to send. */
export function createThread(chatId: string | null): ThreadState {
  return {
    chatId,
    status: chatId === null ? 'idle' : 'loading',
    messages: [],
    live: null,
    failure: null,
    cards: [],
    settling: false,
  };
}

export function canSend(state: ThreadState): boolean {
  return SENDABLE.has(state.status) && !state.settling;
}

export function canStop(state: ThreadState): boolean {
  return STOPPABLE.has(state.status);
}

/** A failure of the read only (the network, the stream): the turn itself may run on (D-STOP). */
export function readBroke(kind: ThreadFailure['kind']): boolean {
  return DETACHABLE.has(kind);
}

/**
 * The read of a named chat's turn broke (the network, the stream) and the turn is a detached
 * producer (D-STOP): until GET /api/chat/{id} answers, it may still be running on the server.
 */
export function awaitsDetachedCheck(state: ThreadState): boolean {
  return (
    state.status === 'failed' &&
    state.chatId !== null &&
    state.failure !== null &&
    readBroke(state.failure.kind)
  );
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

/** The saved-list query as TanStack reports it: only what the opening gate reads. */
export type SavedListQuery = {
  readonly isFetchedAfterMount: boolean;
  readonly isSuccess: boolean;
  readonly data: readonly StoredMessage[] | undefined;
};

/**
 * The saved list a chat may open on: only one fetched since this visit began, as the check is. A
 * cached list may predate the turn the check reports in flight (it ends on Auto's earlier reply),
 * and judged against it that turn would never show as working (D-STALE-CHAT).
 */
export function openingList(query: SavedListQuery): readonly StoredMessage[] | undefined {
  return query.isFetchedAfterMount && query.isSuccess ? query.data : undefined;
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
    settling: false,
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

/** A turn the server failed keeps its failure on screen; any other settled turn may retire. */
function mayRetire(state: ThreadState): boolean {
  if (state.status === 'failed') return state.failure?.kind !== 'turn';
  return state.status === 'idle' || state.status === 'working' || state.status === 'stopped';
}

/**
 * The live turn retires once Auto's reply is saved from where it started and the turn has settled.
 * Never mid-read ('streaming'): a second send would go through while the read runs.
 */
function retireIfReplied(state: ThreadState): ThreadState {
  const live = state.live;
  const replied =
    live !== null &&
    state.messages.slice(live.since).some((message) => message.role === 'assistant');
  return replied && mayRetire(state)
    ? { ...state, status: 'idle', live: null, failure: null, settling: false }
    : state;
}

/**
 * A turn's end (finished, failed, stopped): retired by a reply already saved, or settling until the
 * after-turn refetch answers. A draft never named has nothing saved to wait for.
 */
function ended(state: ThreadState): ThreadState {
  const next = retireIfReplied(state);
  return next.live !== null && next.chatId !== null ? { ...next, settling: true } : next;
}

function finished(state: ThreadState): ThreadState {
  if (state.status !== 'streaming') return state;
  const error = state.live?.turn.error;
  if (!error) return ended({ ...state, status: 'idle' });
  const failure = { kind: 'turn', code: turnErrorCode(error.code) } as const;
  return ended({ ...state, status: 'failed', failure });
}

function failed(state: ThreadState, action: ActionOf<'failed'>): ThreadState {
  if (state.status !== 'streaming') return state;
  return ended({ ...state, status: 'failed', failure: failureOf(action.error) });
}

/**
 * The live turn is kept as it is: a call Stop cut off stays running and, the reply no longer being
 * written, reads 'Stopped: …' without a spinner (the web's stop, hooks.ts; only the finish frame
 * completes running calls).
 */
function stopped(state: ThreadState): ThreadState {
  if (!canStop(state)) return state;
  return ended({ ...state, status: 'stopped', failure: null });
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

function refetched(state: ThreadState, action: ActionOf<'refetched'>): ThreadState {
  if (state.status === 'loading') return state;
  const messages = mergeById(state.messages, action.messages);
  return retireIfReplied(messages === state.messages ? state : { ...state, messages });
}

/** The after-turn refetch's answer: merged as a refetch is, and the thread may send again. */
function settled(state: ThreadState, action: ActionOf<'settled'>): ThreadState {
  if (!state.settling) return state;
  const messages = mergeById(state.messages, action.messages);
  return retireIfReplied({ ...state, messages, settling: false });
}

function gaveUp(state: ThreadState): ThreadState {
  return state.status === 'working' ? { ...state, status: 'idle', live: null } : state;
}

/**
 * The turn whose read broke runs on: Auto is working, the live turn (the draft, the reply so far)
 * kept until the saved reply retires it. Not in flight: the failure stays, with Try again.
 */
function detached(state: ThreadState, action: ActionOf<'detached'>): ThreadState {
  if (!action.turnInFlight || !awaitsDetachedCheck(state)) return state;
  return retireIfReplied({ ...state, status: 'working', failure: null });
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
  settled,
  gaveUp,
  detached,
  card,
};

export function threadReducer(state: ThreadState, action: ThreadAction): ThreadState {
  // TypeScript cannot correlate HANDLERS[type] with the narrowed action; the mapped type checks each entry.
  const handle = HANDLERS[action.type] as Handler<ThreadAction['type']>;
  return handle(state, action);
}
