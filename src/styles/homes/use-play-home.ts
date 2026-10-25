// Play's home in React (US-016k): the message box on A2's composerState (send, stop, the viewer's
// copy; Return a newline, only the button sends), the Deliverables this conversation made (shelf.ts)
// and the header's title from A2's check of the chat, read from its cache and never fetched again.

import { skipToken, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { queryKeys } from '../../api/query-keys';
import type { ThreadState } from '../../chat/controller/thread';
import {
  composerState,
  outgoingText,
  type ComposerState,
} from '../../chat/composer/composer-state';
import type { ChatThread } from '../../chat/schemas';
import type { HomeThread } from './use-home-thread';
import { playTitle } from './play-thread';
import { EMPTY_SHELF, fileReports, type ShelfMemory } from './shelf';

export type PlayComposerModel = {
  readonly text: string;
  readonly setText: (text: string) => void;
  readonly state: ComposerState;
  readonly send: () => void;
  readonly stop: () => void;
};

export function usePlayComposer(home: HomeThread): PlayComposerModel {
  const [text, setText] = useState('');
  const { files, sendMessage, thread } = home;
  const state = composerState({
    text,
    streaming: home.working,
    role: home.role,
    uploading: files.uploading,
    attachments: files.ready.length,
    loading: home.holding,
  });
  const mode = state.buttonMode;
  const send = useCallback(() => {
    if (mode !== 'send') return;
    sendMessage(outgoingText(text), files.ready);
    setText('');
    files.sent();
  }, [mode, sendMessage, text, files]);
  const { stop: stopTurn } = thread;
  const stop = useCallback(() => {
    if (mode === 'stop') stopTurn();
  }, [mode, stopTurn]);
  return { text, setText, state, send, stop };
}

/** The Deliverables this conversation made on this visit, filed as the thread moves. */
export function useShelf(state: ThreadState): ShelfMemory {
  const [memory, setMemory] = useState<ShelfMemory>(EMPTY_SHELF);
  useEffect(() => {
    setMemory((current) => fileReports(current, state));
  }, [state]);
  return fileReports(memory, state);
}

/** The header's title: the chat's own once A2's check cached it, never a second fetch. */
export function usePlayTitle(state: Pick<ThreadState, 'chatId'>): string {
  const { chatId } = state;
  const checked = useQuery<ChatThread | null>({
    queryKey: queryKeys.chat.thread(chatId ?? ''),
    queryFn: skipToken,
  });
  return playTitle(state, checked.data);
}
