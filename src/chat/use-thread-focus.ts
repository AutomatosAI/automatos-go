// A thread view's focus message, wired (PRD-268 US-G03; the rules are focus.ts's): while it shows a
// chat it tells the one store so (the brief on open then asks it to scroll rather than opening the
// chat again), and its focus is the store's request for that chat, else the chat route's `focus`
// param. Hand `focus` and `settle` to the list (MessageList's or PlayThread's focusMessageId and
// onFocused); Arcade's story can take the same two.

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { threadFocus } from './focus';

export type ThreadFocus = {
  /** The message to open the thread at; null for none. */
  readonly focus: string | null;
  /** The list scrolled there. */
  readonly settle: (messageId: string) => void;
};

export function useThreadFocus(
  chatId: string | null,
  routeFocus: string | null = null,
): ThreadFocus {
  useEffect(() => (chatId ? threadFocus.show(chatId) : undefined), [chatId]);
  const requested = useSyncExternalStore(threadFocus.subscribe, () => threadFocus.pending(chatId));
  const settle = useCallback(
    (messageId: string) => {
      if (chatId) threadFocus.settle(chatId, messageId);
    },
    [chatId],
  );
  return { focus: requested ?? routeFocus, settle };
}
