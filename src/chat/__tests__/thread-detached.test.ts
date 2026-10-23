// P001C-RVW-5: a read that broke while the turn runs on (D-STOP: iOS suspends the app mid-turn) is
// a failure only until GET /api/chat/{id} answers. turnInFlight shows Auto working, never 'The
// reply was interrupted. Try again.' (a second turn into the running one). P001C-RVW-8: while Auto
// works on (that read, or a Stop the server never heard) a call it still runs reads running, never
// 'Stopped: …'. Every state and action is deep-frozen on the way through, so a mutation throws.

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import type { Frame } from '../../core/ai-sdk-stream';
import {
  awaitsDetachedCheck,
  canSend,
  canStop,
  createThread,
  shownMessages,
  threadReducer,
  type ThreadAction,
  type ThreadDraft,
  type ThreadState,
} from '../controller/thread';
import { CHAT_COPY } from '../strings';
import { threadRows, turnNotice, type ToolLineRow } from '../view-model';
import { AT, CHAT_ID, afterTurn, deepFreeze, saved } from './thread-fixtures';

const DRAFT: ThreadDraft = { text: 'File a ticket for the login bug', files: [], sentAt: AT };
const ASKED = saved('m-1', 'user', DRAFT.text);
const REPLIED = saved('m-2', 'assistant', 'Filed #0426 for the login bug.');
const IN_FLIGHT: ThreadAction = { type: 'detached', turnInFlight: true };
const SETTLED: ThreadAction = { type: 'detached', turnInFlight: false };

const frame = (f: Frame): ThreadAction => ({ type: 'frame', frame: f, at: AT });
const NAMED = frame({ kind: 'chat-id', chatId: CHAT_ID, aiGenerated: true });
const SEND: ThreadAction = { type: 'send', draft: DRAFT };

function run(state: ThreadState, ...actions: ThreadAction[]): ThreadState {
  return actions.reduce(
    (current, action) => deepFreeze(threadReducer(current, deepFreeze(action))),
    deepFreeze(state),
  );
}

/** A draft sent and named by its chat-id frame, these frames in, then its read broken by `error`. */
function broken(error: unknown, ...frames: ThreadAction[]): ThreadState {
  return run(createThread(null), SEND, NAMED, ...frames, { type: 'failed', error });
}

const rowTypes = (state: ThreadState) => threadRows(state).map((row) => row.type);

describe('a read that broke mid-turn (P001C-RVW-5, D-STOP)', () => {
  it('awaits the check; in flight → Auto is working, then the saved reply retires the turn', () => {
    const failed = broken(new ApiError('stream'));
    expect(failed).toMatchObject({ status: 'failed', failure: { kind: 'stream', code: null } });
    expect(awaitsDetachedCheck(failed)).toBe(true);
    // the foreground refetch lands first: the user's message is saved, the reply is not yet
    const refreshed = run(failed, { type: 'refetched', messages: [ASKED] });
    expect(awaitsDetachedCheck(refreshed)).toBe(true);

    const working = run(refreshed, IN_FLIGHT);
    expect(working).toMatchObject({ chatId: CHAT_ID, status: 'working', failure: null });
    expect(working.live).toBe(refreshed.live);
    expect(working.live?.draft).toEqual(DRAFT);
    expect(canSend(working)).toBe(false);
    expect(canStop(working)).toBe(true);
    expect(awaitsDetachedCheck(working)).toBe(false);
    expect(turnNotice(working)).toBeNull();
    expect(rowTypes(working)).toEqual(['user', 'working']);

    const landed = run(working, { type: 'refetched', messages: [ASKED, REPLIED] });
    expect(landed).toMatchObject({ status: 'idle', live: null, failure: null });
    expect(shownMessages(landed)).toEqual([ASKED, REPLIED]);
    expect(rowTypes(landed)).toEqual(['user', 'auto']);
  });

  it('keeps the reply so far on screen while Auto works on, without the working row', () => {
    const failed = broken(new ApiError('stream'), frame({ kind: 'text', text: 'Filing it now' }));
    const working = run(failed, IN_FLIGHT);
    expect(working).toMatchObject({ status: 'working', failure: null });
    expect(working.live?.turn.text).toBe('Filing it now');
    expect(rowTypes(working)).toEqual(['user', 'auto']);
  });

  it('not in flight: the failure stays, with Try again', () => {
    const failed = run(broken(new ApiError('stream')), ...afterTurn([ASKED]));
    const settled = run(failed, SETTLED);
    expect(settled).toBe(failed);
    expect(canSend(settled)).toBe(true);
    expect(turnNotice(settled)).toMatchObject({
      kind: 'failed',
      text: API_ERROR_COPY.stream,
      retry: true,
    });
  });

  it('a network failure behaves as a broken stream', () => {
    const failed = broken(new ApiError('network'));
    expect(awaitsDetachedCheck(failed)).toBe(true);
    expect(run(failed, IN_FLIGHT)).toMatchObject({ status: 'working', failure: null });
    expect(run(failed, SETTLED)).toBe(failed);
  });

  it('a turn the server failed, a draft never named, a refusal and a stop never await the check', () => {
    const turnFailed = run(
      createThread(null),
      SEND,
      NAMED,
      frame({ kind: 'error', message: 'No', code: 'turn_failed' }),
      { type: 'finished' },
    );
    const unnamed = run(createThread(null), SEND, {
      type: 'failed',
      error: new ApiError('stream'),
    });
    const refused = broken(new ApiError('server', { status: 402 }));
    const stopped = run(createThread(null), SEND, NAMED, { type: 'stopped', at: AT });
    const stopFailed = run(stopped, { type: 'stopFailed', error: new ApiError('network') });
    expect(turnFailed.failure).toEqual({ kind: 'turn', code: 'turn_failed' });
    expect(unnamed).toMatchObject({ chatId: null, status: 'failed' });
    for (const state of [turnFailed, unnamed, refused, stopped, stopFailed]) {
      expect(awaitsDetachedCheck(state)).toBe(false);
      expect(run(state, IN_FLIGHT)).toBe(state);
    }
  });

  it('every other status ignores the answer', () => {
    const idle = run(createThread(CHAT_ID), {
      type: 'loaded',
      chatId: CHAT_ID,
      messages: [],
      turnInFlight: false,
    });
    const streaming = run(idle, SEND);
    for (const state of [createThread(CHAT_ID), idle, streaming]) {
      expect(awaitsDetachedCheck(state)).toBe(false);
      expect(run(state, IN_FLIGHT)).toBe(state);
    }
  });
});

const LOOKING = frame({ kind: 'text', text: 'Let me look.' });
const SEARCH = frame({ kind: 'tool-start', toolCallId: 't1', toolName: 'platform_web_search' });
const RUNNING: ToolLineRow = {
  key: 't1',
  mark: null,
  tone: 'running',
  text: 'Searching the web',
  accessibilityLabel: 'Running, Searching the web',
};
const CUT_OFF: ToolLineRow = {
  key: 't1',
  mark: '–',
  tone: 'muted',
  text: 'Stopped: searching the web',
  accessibilityLabel: 'Stopped: searching the web',
};

const toolLines = (state: ThreadState) =>
  threadRows(state).flatMap((row) => (row.type === 'auto' ? row.toolLines : []));

describe('a tool call while Auto works on (P001C-RVW-8)', () => {
  it('a read that broke mid-turn: the call reads running once the turn is in flight', () => {
    expect(toolLines(run(createThread(null), SEND, NAMED, LOOKING, SEARCH))).toEqual([RUNNING]);
    const failed = broken(new ApiError('stream'), LOOKING, SEARCH);
    expect(toolLines(failed)).toEqual([CUT_OFF]);

    const working = run(failed, IN_FLIGHT);
    expect(working.status).toBe('working');
    expect(toolLines(working)).toEqual([RUNNING]);
    expect(rowTypes(working)).toEqual(['user', 'auto']);
  });

  it('a Stop the server never heard: the call reads running beside the notice', () => {
    const stop: ThreadAction = { type: 'stopped', at: AT };
    const stopped = run(createThread(null), SEND, NAMED, LOOKING, SEARCH, stop);
    expect(toolLines(stopped)).toEqual([CUT_OFF]);

    const stopFailed = run(stopped, { type: 'stopFailed', error: new ApiError('network') });
    expect(stopFailed.status).toBe('working');
    expect(toolLines(stopFailed)).toEqual([RUNNING]);
    expect(turnNotice(stopFailed)).toMatchObject({
      kind: 'stopFailed',
      text: CHAT_COPY.stopFailed,
    });
  });
});
