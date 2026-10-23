// P001C-RVW-7: a turn that ended in a named chat without retiring is settling until the after-turn
// refetch answers (use-thread.ts dispatches settled, a failed refetch included). No send before it:
// the next turn would start ahead of this one's saved messages, hide that exchange, and have its
// reply retire the new turn, a refused send included. Every state and action is deep-frozen on the
// way through, so a mutation throws.

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/errors';
import type { Frame } from '../../core/ai-sdk-stream';
import {
  canSend,
  createThread,
  threadReducer,
  type ThreadAction,
  type ThreadState,
} from '../controller/thread';
import type { StoredMessage } from '../schemas';
import { LIVE_AUTO_KEY, LIVE_USER_KEY, retryInput, threadRows, turnNotice } from '../view-model';
import { AT, CHAT_ID, deepFreeze, saved } from './thread-fixtures';

const Q0 = saved('m-q0', 'user', 'What needs me?');
const R0 = saved('m-r0', 'assistant', 'Two things need you.');
const Q1 = saved('m-q1', 'user', 'First');
const R1 = saved('m-r1', 'assistant', 'Answer one');

const frame = (f: Frame): ThreadAction => ({ type: 'frame', frame: f, at: AT });
const sendOf = (text: string): ThreadAction => ({
  type: 'send',
  draft: { text, files: [], sentAt: AT },
});
const NAMED = frame({ kind: 'chat-id', chatId: CHAT_ID, aiGenerated: true });
const ANSWER = frame({ kind: 'text', text: 'Answer one' });
const FINISHED: ThreadAction = { type: 'finished' };
const settledWith = (...messages: StoredMessage[]): ThreadAction => ({
  type: 'settled',
  messages,
});

function run(state: ThreadState, ...actions: ThreadAction[]): ThreadState {
  return actions.reduce(
    (current, action) => deepFreeze(threadReducer(current, deepFreeze(action))),
    deepFreeze(state),
  );
}

/** A named chat with [Q0, R0] saved, its turn 'First' sent, named and answered so far. */
function answering(): ThreadState {
  const loaded = run(createThread(CHAT_ID), {
    type: 'loaded',
    chatId: CHAT_ID,
    messages: [Q0, R0],
    turnInFlight: false,
  });
  return run(loaded, sendOf('First'), NAMED, ANSWER);
}

const rows = (state: ThreadState) => threadRows(state).map((row) => [row.type, row.key]);

describe('a send right after a turn waits for its saved reply (P001C-RVW-7)', () => {
  it('the review probe: settling until settled, then no turn hidden and no failed send lost', () => {
    const ended = run(answering(), FINISHED);
    expect(ended).toMatchObject({ status: 'idle', settling: true });
    expect(ended.live).not.toBeNull();
    expect(canSend(ended)).toBe(false);
    expect(run(ended, sendOf('Second'))).toBe(ended);

    const landed = run(ended, settledWith(Q0, R0, Q1, R1));
    expect(landed).toMatchObject({ status: 'idle', live: null, settling: false });
    expect(canSend(landed)).toBe(true);
    expect(rows(landed)).toEqual([
      ['user', Q0.id],
      ['auto', R0.id],
      ['user', Q1.id],
      ['auto', R1.id],
    ]);

    const refused = run(
      landed,
      sendOf('Second'),
      { type: 'failed', error: new ApiError('server', { status: 503 }) },
      settledWith(Q0, R0, Q1, R1),
    );
    expect(refused).toMatchObject({ status: 'failed', settling: false });
    expect(refused.live?.draft?.text).toBe('Second');
    expect(retryInput(refused)).toEqual({ text: 'Second', files: [] });
    expect(rows(refused)).toEqual([
      ['user', Q0.id],
      ['auto', R0.id],
      ['user', Q1.id],
      ['auto', R1.id],
      ['user', LIVE_USER_KEY],
      ['notice', 'turn-notice'],
    ]);
    expect(turnNotice(refused)).toMatchObject({ kind: 'failed', retry: true });
  });

  it('a refetch that failed settles on the cached list: the live turn kept, sendable', () => {
    const ended = run(answering(), FINISHED);
    const settled = run(ended, settledWith(Q0, R0));
    expect(settled).toMatchObject({ status: 'idle', settling: false, live: ended.live });
    expect(canSend(settled)).toBe(true);
    expect(rows(settled)).toEqual([
      ['user', Q0.id],
      ['auto', R0.id],
      ['user', LIVE_USER_KEY],
      ['auto', LIVE_AUTO_KEY],
    ]);
  });

  it('a draft that failed before its chat-id frame has nothing to wait for', () => {
    const draft = run(createThread(null), sendOf('First'));
    for (const error of [new ApiError('stream'), new ApiError('server', { status: 503 })]) {
      const failed = run(draft, { type: 'failed', error });
      expect(failed).toMatchObject({ chatId: null, status: 'failed', settling: false });
      expect(canSend(failed)).toBe(true);
      expect(turnNotice(failed)).toMatchObject({ kind: 'failed', retry: true });
    }
  });

  it('a Stop in a named chat settles too: no send until the refetch answers', () => {
    const stopped = run(answering(), { type: 'stopped', at: AT });
    expect(stopped).toMatchObject({ status: 'stopped', settling: true });
    expect(canSend(stopped)).toBe(false);
    expect(run(stopped, sendOf('Second'))).toBe(stopped);
    const settled = run(stopped, settledWith(Q0, R0, Q1));
    expect(settled).toMatchObject({ status: 'stopped', settling: false, live: stopped.live });
    expect(canSend(settled)).toBe(true);
    expect(turnNotice(settled)).toMatchObject({ kind: 'stopped' });
  });

  it('a turn the server failed keeps its failure through settled and offers Try again after', () => {
    const errored = frame({ kind: 'error', message: 'No', code: 'turn_failed' });
    const ended = run(answering(), errored, FINISHED);
    expect(ended).toMatchObject({ status: 'failed', settling: true });
    expect(turnNotice(ended)).toMatchObject({ kind: 'failed', retry: false });
    const settled = run(ended, settledWith(Q0, R0, Q1));
    expect(settled).toMatchObject({
      status: 'failed',
      failure: { kind: 'turn', code: 'turn_failed' },
      settling: false,
      live: ended.live,
    });
    expect(canSend(settled)).toBe(true);
    expect(turnNotice(settled)).toMatchObject({ kind: 'failed', retry: true });
  });

  it('a refetch that brings the reply first retires the turn and ends settling', () => {
    const ended = run(answering(), FINISHED);
    const retired = run(ended, { type: 'refetched', messages: [Q0, R0, Q1, R1] });
    expect(retired).toMatchObject({ status: 'idle', live: null, settling: false });
    expect(canSend(retired)).toBe(true);
    expect(run(retired, settledWith(Q0, R0, Q1, R1))).toBe(retired);
  });

  it('settled while nothing settles (loading, a draft, a read still open) changes nothing', () => {
    const loading = createThread(CHAT_ID);
    const idle = run(createThread(null));
    const streaming = answering();
    for (const state of [loading, idle, streaming]) {
      expect(state.settling).toBe(false);
      expect(run(state, settledWith(Q0, R0, Q1, R1))).toBe(state);
    }
  });
});
