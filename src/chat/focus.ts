// Opening a thread at one of its messages (PRD-268 US-G03: the Auto thread at the day's brief),
// pure and layout-neutral. A thread view takes a focus message id (the chat route's `focus` param,
// routes.chatAt, or a request from the brief on open) and scrolls once to the row of that message,
// its top at the list's top; Studio's MessageList and Play's PlayThread do (use-focus-scroll.ts),
// and any other thread view can, with the same two props. The rows are the view-model's: a saved
// message's row is keyed by its id.
//   The store says which chats a thread view shows now. The brief on open asks it first: a thread
// that shows the brief's chat holds the request until it has scrolled there (settle), or until the
// last view of that chat goes; none, and the caller decides whether to open the chat at the message
// (briefOpenStep). While home is still choosing its thread (no view shows any chat yet), the caller
// waits for the first one, a little while at most (whenAThreadShows), so it never opens a second
// copy of the thread home is about to draw. Memory only.

/** A message of a conversation. */
export type FocusTarget = { readonly chatId: string; readonly messageId: string };

/** The row of `messageId` among a thread's rows, or -1 while it is not there. */
export function focusIndex(rows: readonly { readonly key: string }[], messageId: string): number {
  return rows.findIndex((row) => row.key === messageId);
}

/**
 * Scroll now: there is a focus this list has not scrolled to yet, and its row is drawn. Every id
 * scrolled to counts, so a route's focus never pulls the list back after a later one.
 */
export function shouldFocus(
  focus: string | null,
  done: ReadonlySet<string>,
  index: number,
): boolean {
  return focus !== null && !done.has(focus) && index >= 0;
}

/** How many times a scroll to a row not yet laid out is tried again (FlatList measures as it goes). */
export const FOCUS_RETRIES = 3;

/** Where to jump while the row is not laid out: its place at the average row height so far. */
export function approximateOffset(info: {
  readonly index: number;
  readonly averageItemLength: number;
}): number {
  const offset = info.index * info.averageItemLength;
  return Number.isFinite(offset) && offset > 0 ? offset : 0;
}

/** The answer of the brief on open names the day's message; null when it does not. */
export function focusTargetOf(answer: {
  readonly chat_id: string | null;
  readonly message_id: string | null;
}): FocusTarget | null {
  const chatId = answer.chat_id?.trim();
  const messageId = answer.message_id?.trim();
  return chatId && messageId ? Object.freeze({ chatId, messageId }) : null;
}

export type BriefOpenStep = 'focus' | 'open' | 'none';

export type BriefOpenFacts = {
  /** A thread view shows the brief's chat now (it scrolls there itself). */
  readonly shown: boolean;
  /** The person is on home (the app came to the front there). */
  readonly onHome: boolean;
  /** The style's layout draws a thread (Studio's and Play's homes; HUD and Arcade draw none). */
  readonly threadLayout: boolean;
};

/**
 * What the brief on open does: scroll the thread on screen to it; else, from home in a layout with
 * a thread, open the Auto thread at it; anywhere else nothing (a person in the Command Centre is
 * never taken away; the brief waits in the thread).
 */
export function briefOpenStep({ shown, onHome, threadLayout }: BriefOpenFacts): BriefOpenStep {
  if (shown) return 'focus';
  return onHome && threadLayout ? 'open' : 'none';
}

export type ThreadFocusStore = {
  /** A thread view shows `chatId` until the returned remove. */
  readonly show: (chatId: string) => () => void;
  /** True when a thread view shows the chat: it holds the request and scrolls there. */
  readonly request: (target: FocusTarget) => boolean;
  /** The message a thread view of `chatId` is asked to scroll to; null when none. */
  readonly pending: (chatId: string | null) => string | null;
  /** The view scrolled there: the request is done. */
  readonly settle: (chatId: string, messageId: string) => void;
  /** Some thread view shows a chat now. */
  readonly anyShown: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
};

type FocusState = {
  /** How many thread views show each chat. */
  readonly shown: ReadonlyMap<string, number>;
  readonly pending: ReadonlyMap<string, string>;
};

function withCount(shown: ReadonlyMap<string, number>, chatId: string, by: number) {
  const count = (shown.get(chatId) ?? 0) + by;
  const others = [...shown].filter(([id]) => id !== chatId);
  return new Map(count > 0 ? [...others, [chatId, count] as const] : others);
}

function without(pending: ReadonlyMap<string, string>, chatId: string) {
  return new Map([...pending].filter(([id]) => id !== chatId));
}

export function createThreadFocus(): ThreadFocusStore {
  let state: FocusState = { shown: new Map(), pending: new Map() };
  let listeners: ReadonlySet<() => void> = new Set();
  const set = (next: FocusState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  return Object.freeze({
    show: (chatId: string) => {
      set({ ...state, shown: withCount(state.shown, chatId, 1) });
      let shown = true;
      return () => {
        if (!shown) return;
        shown = false;
        const next = withCount(state.shown, chatId, -1);
        // the last view of the chat went: a request it never scrolled to goes with it
        const pending = next.has(chatId) ? state.pending : without(state.pending, chatId);
        set({ shown: next, pending });
      };
    },
    request: (target: FocusTarget) => {
      if (!state.shown.has(target.chatId)) return false;
      set({ ...state, pending: new Map([...state.pending, [target.chatId, target.messageId]]) });
      return true;
    },
    pending: (chatId: string | null) => (chatId ? (state.pending.get(chatId) ?? null) : null),
    settle: (chatId: string, messageId: string) => {
      if (state.pending.get(chatId) !== messageId) return;
      set({ ...state, pending: without(state.pending, chatId) });
    },
    anyShown: () => state.shown.size > 0,
    subscribe: (listener: () => void) => {
      listeners = new Set([...listeners, listener]);
      return () => {
        listeners = new Set([...listeners].filter((each) => each !== listener));
      };
    },
  });
}

/** How long the brief on open waits for home to draw its thread before it decides anyway. */
export const HOME_THREAD_WAIT_MS = 3_000;

/**
 * Runs `decide` once some thread view shows a chat, or after `waitMs` when none does (home's draft,
 * a layout without a thread); at once when one already does. Returns the cancel.
 */
export function whenAThreadShows(
  store: Pick<ThreadFocusStore, 'anyShown' | 'subscribe'>,
  decide: () => void,
  later: (run: () => void, ms: number) => () => void,
  waitMs: number = HOME_THREAD_WAIT_MS,
): () => void {
  if (store.anyShown()) {
    decide();
    return () => undefined;
  }
  let pending = true;
  const once = () => {
    if (!pending) return;
    pending = false;
    unsubscribe();
    cancelTimer();
    decide();
  };
  const unsubscribe = store.subscribe(() => {
    if (store.anyShown()) once();
  });
  const cancelTimer = later(once, waitMs);
  return () => {
    pending = false;
    unsubscribe();
    cancelTimer();
  };
}

/** The app's one store: the thread views and the brief on open share it. */
export const threadFocus: ThreadFocusStore = createThreadFocus();
