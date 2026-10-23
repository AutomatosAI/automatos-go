import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import {
  createLiveHub,
  invalidateFamilies,
  LIVE_INVALIDATIONS,
  parseLiveEvent,
  RESUME_INVALIDATIONS,
  type LiveEvent,
} from '../live-events';
import { queryKeys, type KeyFamilyName } from '../query-keys';

const WS = '7f1c2a54-0000-4000-8000-000000000001';

/** One key per family, built the way the kits will build them. */
const SAMPLES: Readonly<Record<KeyFamilyName, readonly unknown[]>> = {
  workspace: queryKeys.workspace(),
  discovery: queryKeys.discovery('https://api.example.test'),
  needsYou: queryKeys.needsYou(),
  board: queryKeys.board({ finished_limit: 200 }),
  ticket: queryKeys.ticket('42'),
  schedule: queryKeys.schedule('7d'),
  questions: queryKeys.questions('pending', 'question'),
  socialPost: queryKeys.socialPost(WS, 'post-1'),
  deliverables: queryKeys.deliverables(WS),
  deliverable: queryKeys.deliverable(WS, 'd-1', true),
  'chat.thread': queryKeys.chat.thread('chat-1'),
  'chat.messages': queryKeys.chat.messages('chat-1'),
  'chat.history': queryKeys.chat.history(50),
  'chat.agents': queryKeys.chat.agents(),
};
const FAMILIES = Object.keys(SAMPLES) as KeyFamilyName[];

/** A cache holding one answered query per family. */
function seededCache(): QueryClient {
  const queryClient = new QueryClient();
  for (const name of FAMILIES) queryClient.setQueryData(SAMPLES[name], { family: name });
  return queryClient;
}

function invalidated(queryClient: QueryClient): KeyFamilyName[] {
  return FAMILIES.filter((name) => queryClient.getQueryState(SAMPLES[name])?.isInvalidated);
}

const boardChanged = (data: unknown): LiveEvent | null =>
  parseLiveEvent({ event: 'board_changed', data });

describe('live frames (zod; unknown events ignored)', () => {
  it("reads the connect frame and a ticket's change", () => {
    expect(boardChanged({ workspace_id: WS })).toEqual({
      type: 'board_changed',
      data: { workspace_id: WS },
    });
    expect(
      boardChanged({ workspace_id: WS, task_id: 7, status: 'review', event: 'task_changed' }),
    ).toEqual({
      type: 'board_changed',
      data: { workspace_id: WS, task_id: 7, status: 'review', event: 'task_changed' },
    });
  });

  it('drops unknown fields and reads a mistyped optional field as absent', () => {
    const event = boardChanged({ workspace_id: WS, task_id: 'seven', extra: { deep: true } });
    expect(event).toEqual({ type: 'board_changed', data: { workspace_id: WS } });
  });

  it('reads chat_changed with its chat and user', () => {
    const data = { workspace_id: WS, chat_id: 'c-1', user_id: 12, event: 'chat_changed' };
    expect(parseLiveEvent({ event: 'chat_changed', data })).toEqual({ type: 'chat_changed', data });
  });

  it('ignores an unknown event and a frame that does not fit', () => {
    expect(parseLiveEvent({ event: 'agent_moved', data: { workspace_id: WS } })).toBeNull();
    expect(parseLiveEvent({ event: 'message', data: 'hello' })).toBeNull();
    expect(parseLiveEvent({ event: 'chat_changed', data: { workspace_id: WS } })).toBeNull();
    expect(boardChanged(null)).toBeNull();
    expect(boardChanged('not json')).toBeNull();
  });
});

describe('the event → invalidation map', () => {
  it('board_changed refetches the board, the ticket, needs-you and the questions', () => {
    expect([...LIVE_INVALIDATIONS.board_changed].sort()).toEqual(
      ['board', 'needsYou', 'questions', 'ticket'].sort(),
    );
  });

  it('chat_changed refetches nothing (it only reaches subscribers)', () => {
    expect(LIVE_INVALIDATIONS.chat_changed).toEqual([]);
  });

  it('a resume refetches every family any event would have', () => {
    expect([...RESUME_INVALIDATIONS].sort()).toEqual(['board', 'needsYou', 'questions', 'ticket']);
  });

  it("marks exactly those families' queries stale, and no other", async () => {
    const queryClient = seededCache();
    await invalidateFamilies(queryClient, LIVE_INVALIDATIONS.board_changed);
    expect(invalidated(queryClient).sort()).toEqual(['board', 'needsYou', 'questions', 'ticket']);
  });

  it('touches nothing for an event with no families', async () => {
    const queryClient = seededCache();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await invalidateFamilies(queryClient, LIVE_INVALIDATIONS.chat_changed);
    expect(spy).not.toHaveBeenCalled();
    expect(invalidated(queryClient)).toEqual([]);
  });

  it('keeps a refetch already in flight rather than starting another', async () => {
    const queryClient = seededCache();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await invalidateFamilies(queryClient, ['board']);
    expect(spy).toHaveBeenCalledWith(expect.anything(), { cancelRefetch: false });
  });

  it('logs, never throws, when a refetch fails', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const failing = { invalidateQueries: () => Promise.reject(new Error('cache gone')) };
    await expect(invalidateFamilies(failing, ['board'])).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('the hub: chat_changed fan-out', () => {
  const chat: LiveEvent = { type: 'chat_changed', data: { workspace_id: WS, chat_id: 'c-1' } };
  const board: LiveEvent = { type: 'board_changed', data: { workspace_id: WS } };

  it('reaches every chat_changed subscriber, and only them', () => {
    const hub = createLiveHub();
    const first = vi.fn();
    const second = vi.fn();
    const onBoard = vi.fn();
    hub.on('chat_changed', first);
    hub.on('chat_changed', second);
    hub.on('board_changed', onBoard);
    hub.emit(chat);
    expect(first).toHaveBeenCalledWith(chat.data);
    expect(second).toHaveBeenCalledWith(chat.data);
    expect(onBoard).not.toHaveBeenCalled();
    hub.emit(board);
    expect(onBoard).toHaveBeenCalledWith(board.data);
  });

  it('stops reaching a subscriber once it unsubscribes', () => {
    const hub = createLiveHub();
    const handler = vi.fn();
    const off = hub.on('chat_changed', handler);
    off();
    hub.emit(chat);
    expect(handler).not.toHaveBeenCalled();
  });

  it('still reaches the others when one subscriber throws', () => {
    const hub = createLiveHub();
    const after = vi.fn();
    hub.on('chat_changed', () => {
      throw new Error('subscriber bug');
    });
    hub.on('chat_changed', after);
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    expect(() => hub.emit(chat)).not.toThrow();
    expect(after).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith('[live] a chat_changed subscriber failed', expect.any(Error));
    warn.mockRestore();
  });

  it('starts offline and tells listeners of each change, once', () => {
    const hub = createLiveHub();
    const listener = vi.fn();
    const off = hub.onStatus(listener);
    expect(hub.status()).toBe('offline');
    hub.setStatus('connecting');
    hub.setStatus('connecting');
    hub.setStatus('live');
    expect(hub.status()).toBe('live');
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    hub.setStatus('offline');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
