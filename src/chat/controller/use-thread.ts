// The hook behind a chat screen (US-008b): it only wires. threadReducer (thread.ts) holds the state;
// the turn runner reads turns and stops them; GET /api/chat/{id} (chat.thread) is the stale-id
// check and says whether a turn is in flight; GET /api/chat/{id}/messages (chat.messages) is the
// saved list, refetched after every turn, on chat_changed for this chat (the foundation's one live
// stream, useLiveEvent) and when the app comes back to the foreground (the stream replays nothing).
// The after-turn refetch's answer settles the turn (thread.ts settled), a failed refetch included.
// A read that broke mid-turn asks GET /api/chat/{id} again whether the turn runs on (D-STOP).
// Both families stay in memory (D-CACHE, query-keys.ts); nothing here writes to the phone.
// `onFrame` hears each frame of the thread's own read as it reaches the reducer (A5's homes feed
// Auto's mascot from them); it changes nothing the thread does.

import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useReducer, useRef, type Dispatch } from 'react';
import { AppState } from 'react-native';

import type { ApiClient } from '../../api/client';
import { isForeground } from '../../api/live-connection';
import { useLiveEvent } from '../../api/live';
import { queryKeys } from '../../api/query-keys';
import { useApiClient } from '../../app-state/session';
import type { Frame } from '../../core/ai-sdk-stream';
import { logger } from '../../lib/logger';
import { fetchMessages } from '../api';
import type { CardOutcome } from '../cards/model';
import { buildChatRequest, type ChatRequestInput } from '../request';
import type { StoredMessage } from '../schemas';
import { checkChat, isChatChangedFor } from './live-chat';
import {
  AWAITING_REPLY_GUARD_MS,
  awaitsDetachedCheck,
  canSend,
  canStop,
  createThread,
  loadedAction,
  openingList,
  threadReducer,
  type ThreadAction,
  type ThreadState,
} from './thread';
import { createTurnRunner, type TurnRunner } from './turn-runner';

/** One message; spokenMode is quick-ask's (A6) and passes through to buildChatRequest as it is. */
export type ThreadSendInput = Omit<ChatRequestInput, 'chatId'>;

export type ThreadView = {
  readonly state: ThreadState;
  /** The check or the first load failed (404 and 403 are not failures: they start a draft). */
  readonly loadError: unknown;
  readonly send: (input: ThreadSendInput) => void;
  readonly stop: () => void;
  /** 'New chat' (KC4): lets go of any read and starts a draft. */
  readonly newChat: () => void;
  readonly retry: () => void;
  /** Records what the user did with one of Auto's cards, once the server agreed. */
  readonly settleCard: (key: string, outcome: CardOutcome) => void;
};

type Queries = { readonly loadError: unknown; readonly retry: () => void };

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** GET /api/chat/{id} for the id being opened; `checked` only once this visit's answer is in. */
function useCheck(client: ApiClient, checking: string | null) {
  const thread = useQuery({
    queryKey: queryKeys.chat.thread(checking ?? ''),
    queryFn: checking ? ({ signal }) => checkChat(client, checking, signal) : skipToken,
    // the answer must come from this visit: turnInFlight is read once, at open
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const fresh = thread.isFetchedAfterMount && thread.isSuccess;
  return { checked: fresh ? thread.data : undefined, error: thread.error, refetch: thread.refetch };
}

/** The saved list; refetched on every open, since a reply may have landed while it was closed. */
function useSaved(client: ApiClient, chatId: string | null) {
  return useQuery({
    queryKey: queryKeys.chat.messages(chatId ?? ''),
    queryFn: chatId ? ({ signal }) => fetchMessages(client, chatId, signal) : skipToken,
    // the key switches to the id once the check answers, and a switch fetches only a stale query:
    // the open waits on this visit's list (openingList), so the cached one must never count as fresh
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** The check, then the saved list; each answer reaches the reducer as loaded or refetched. */
function useThreadQueries(
  client: ApiClient,
  state: ThreadState,
  dispatch: Dispatch<ThreadAction>,
): Queries {
  const loading = state.status === 'loading';
  const check = useCheck(client, loading ? state.chatId : null);
  const { checked } = check;
  const messagesId = loading ? (checked?.id ?? null) : state.chatId;
  const saved = useSaved(client, messagesId);
  const opening = openingList(saved);
  useEffect(() => {
    const action = loading ? loadedAction(checked, opening) : null;
    if (action) dispatch(action);
  }, [loading, checked, opening, dispatch]);
  useEffect(() => {
    if (saved.data) dispatch({ type: 'refetched', messages: saved.data });
  }, [saved.data, dispatch]);
  const { refetch: refetchCheck } = check;
  const { refetch: refetchSaved } = saved;
  const retry = useCallback(() => {
    if (loading) void refetchCheck();
    if (messagesId) void refetchSaved();
  }, [loading, messagesId, refetchCheck, refetchSaved]);
  return { loadError: loading ? (check.error ?? saved.error ?? null) : null, retry };
}

/** Calls `onReturn` each time the app comes back to the foreground; returns the unsubscribe. */
function onForegroundReturn(onReturn: () => void): () => void {
  let wasForeground = isForeground(AppState.currentState);
  const subscription = AppState.addEventListener('change', (next) => {
    const foreground = isForeground(next);
    if (foreground && !wasForeground) onReturn();
    wasForeground = foreground;
  });
  return () => subscription.remove();
}

/** chat_changed for this chat, or a return to the foreground, refetches the saved list. */
function useThreadRefresh(chatId: string | null, refresh: () => Promise<void>): void {
  useLiveEvent('chat_changed', (data) => {
    if (isChatChangedFor(chatId, data)) void refresh();
  });
  useEffect(() => onForegroundReturn(() => void refresh()), [refresh]);
}

/**
 * A read that broke mid-turn (awaitsDetachedCheck; iOS suspends the app) asks GET /api/chat/{id}
 * whether the turn runs on, once and again on each return to the foreground. No answer (404, 403)
 * or a failed check leaves the failure as it is.
 */
function useDetachedCheck(
  client: ApiClient,
  chatId: string | null,
  dispatch: Dispatch<ThreadAction>,
): void {
  useEffect(() => {
    if (!chatId) return;
    const controller = new AbortController();
    const ask = () => {
      checkChat(client, chatId, controller.signal).then(
        (thread) => {
          if (thread && !controller.signal.aborted)
            dispatch({ type: 'detached', turnInFlight: thread.turnInFlight });
        },
        (error: unknown) => logger.debug('[chat] could not ask whether the turn runs on', error),
      );
    };
    ask();
    const unsubscribe = onForegroundReturn(ask);
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [client, chatId, dispatch]);
}

/** The web's guard: a detached reply that has not come after five minutes is no longer awaited. */
function useAwaitGuard(status: ThreadState['status'], dispatch: Dispatch<ThreadAction>): void {
  useEffect(() => {
    if (status !== 'working') return;
    const timer = setTimeout(() => dispatch({ type: 'gaveUp' }), AWAITING_REPLY_GUARD_MS);
    return () => clearTimeout(timer);
  }, [status, dispatch]);
}

/**
 * After a turn: the saved list is refetched and, once that has answered (a failure included), its
 * cached copy settles the turn. Not when another chat opened meanwhile: the answer is not its.
 */
function useSettle(
  latest: { readonly current: ThreadState },
  refresh: () => Promise<void>,
  dispatch: Dispatch<ThreadAction>,
): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    const chatId = latest.current.chatId;
    await refresh();
    if (latest.current.chatId !== chatId) return;
    const cached = chatId
      ? queryClient.getQueryData<readonly StoredMessage[]>(queryKeys.chat.messages(chatId))
      : undefined;
    dispatch({ type: 'settled', messages: cached ?? [] });
  }, [latest, refresh, dispatch, queryClient]);
}

/** One runner per screen; leaving the screen lets go of the read and never cancels the turn. */
function useTurnRunner(client: ApiClient, dispatch: Dispatch<ThreadAction>): TurnRunner {
  const runner = useMemo(() => createTurnRunner({ client, dispatch }), [client, dispatch]);
  useEffect(() => () => runner.release(), [runner]);
  return runner;
}

/** The reducer's dispatch, telling `onFrame` (the newest one) of each frame first; stable. */
function useFrameTap(
  dispatch: Dispatch<ThreadAction>,
  onFrame: ((frame: Frame) => void) | undefined,
): Dispatch<ThreadAction> {
  const listener = useLatest(onFrame);
  return useCallback(
    (action: ThreadAction) => {
      if (action.type === 'frame') listener.current?.(action.frame);
      dispatch(action);
    },
    [listener, dispatch],
  );
}

/** Another chat in the route opens it; the draft's own new id arriving in the route does not. */
function useOpenedChat(
  cachedId: string | null,
  latest: { readonly current: ThreadState },
  open: (chatId: string | null) => void,
): void {
  const opened = useRef(cachedId);
  useEffect(() => {
    if (cachedId === opened.current) return;
    opened.current = cachedId;
    if (cachedId === null || cachedId !== latest.current.chatId) open(cachedId);
  }, [cachedId, latest, open]);
}

/**
 * The conversation `cachedId` names (checked before reuse), or a draft for null; `onFrame` hears
 * each frame of this thread's read.
 */
export function useThread(cachedId: string | null, onFrame?: (frame: Frame) => void): ThreadView {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(threadReducer, cachedId, createThread);
  const latest = useLatest(state);
  const runner = useTurnRunner(client, useFrameTap(dispatch, onFrame));
  const { loadError, retry } = useThreadQueries(client, state, dispatch);
  const refresh = useCallback(() => {
    const chatId = latest.current.chatId;
    if (!chatId) return Promise.resolve();
    return queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(chatId) });
  }, [latest, queryClient]);
  useThreadRefresh(state.chatId, refresh);
  const settle = useSettle(latest, refresh, dispatch);
  useDetachedCheck(client, awaitsDetachedCheck(state) ? state.chatId : null, dispatch);
  useAwaitGuard(state.status, dispatch);
  const open = useCallback(
    (chatId: string | null) => {
      runner.release();
      dispatch({ type: 'opened', chatId });
    },
    [runner],
  );
  useOpenedChat(cachedId, latest, open);
  const send = useCallback(
    (input: ThreadSendInput) => {
      const current = latest.current;
      if (!canSend(current)) return;
      const body = buildChatRequest({ ...input, chatId: current.chatId });
      const draft = {
        text: input.text.trim(),
        files: input.files ?? [],
        sentAt: new Date().toISOString(),
      };
      void runner.send(body, draft).then(settle);
    },
    [latest, runner, settle],
  );
  const stop = useCallback(() => {
    if (!canStop(latest.current)) return;
    void runner.stop(latest.current.chatId).then(settle);
  }, [latest, runner, settle]);
  const newChat = useCallback(() => open(null), [open]);
  const settleCard = useCallback(
    (key: string, outcome: CardOutcome) => dispatch({ type: 'card', key, outcome }),
    [],
  );
  return { state, loadError, send, stop, newChat, retry, settleCard };
}
