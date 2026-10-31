// Opening a thread at one of its messages (PRD-268 US-G03: the Auto thread at the day's brief),
// pure and layout-neutral. A thread view takes a focus message id (the chat route's `focus` param,
// routes.chatAt, or a request from the brief on open) and scrolls once to the row of that message,
// its top at the list's top; Studio's MessageList and Play's PlayThread do (use-focus-scroll.ts),
// and any other thread view can, with the same two props. The rows are the view-model's: a saved
// message's row is keyed by its id.
//   The store says which chats a thread view shows now. The brief on open asks it first: a thread
// that shows the brief's chat holds the request until it has scrolled there (settle); none, and the
// caller decides whether to open the chat at the message (briefOpenStep). Memory only.

/** A message of a conversation. */
export type FocusTarget = { readonly chatId: string; readonly messageId: string };

/** The row of `messageId` among a thread's rows, or -1 while it is not there. */
export function focusIndex(rows: readonly { readonly key: string }[], messageId: string): number {
  return rows.findIndex((row) => row.key === messageId);
}

/** Scroll now: there is a focus not scrolled to yet, and its row is drawn. */
export function shouldFocus(focus: string | null, done: string | null, index: number): boolean {
  return focus !== null && focus !== done && index >= 0;
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
        set({ ...state, shown: withCount(state.shown, chatId, -1) });
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
      set({ ...state, pending: new Map([...state.pending].filter(([id]) => id !== chatId)) });
    },
    subscribe: (listener: () => void) => {
      listeners = new Set([...listeners, listener]);
      return () => {
        listeners = new Set([...listeners].filter((each) => each !== listener));
      };
    },
  });
}

/** The app's one store: the thread views and the brief on open share it. */
export const threadFocus: ThreadFocusStore = createThreadFocus();
