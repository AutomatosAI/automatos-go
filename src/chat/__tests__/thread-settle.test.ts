// P001C-RVW-6: the server saves Auto's reply, then runs its memory step with the stream still open,
// so a refetch (a return to the foreground) can bring the reply while this phone is still reading.
// It is held back mid-read and retires the live turn when the read settles (finished, failed,
// stopped): the reply is the saved row (Report this), never a live row with a stop or a failure
// under it. Every state and action is deep-frozen on the way through, so a mutation throws.

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/errors';
import type { Frame } from '../../core/ai-sdk-stream';
import {
  awaitsDetachedCheck,
  canSend,
  createThread,
  shownMessages,
  threadReducer,
  type ThreadAction,
  type ThreadDraft,
  type ThreadState,
} from '../controller/thread';
import { threadRows, turnNotice } from '../view-model';
import { AT, CHAT_ID, deepFreeze, saved } from './thread-fixtures';

const DRAFT: ThreadDraft = { text: 'File a ticket for the login bug', files: [], sentAt: AT };
const ASKED = saved('m-1', 'user', DRAFT.text);
const REPLIED = saved('m-2', 'assistant', 'Filed #0426.');

const frame = (f: Frame): ThreadAction => ({ type: 'frame', frame: f, at: AT });
const NAMED = frame({ kind: 'chat-id', chatId: CHAT_ID, aiGenerated: true });
const TEXT = frame({ kind: 'text', text: 'Filed #0426.' });
const SEND: ThreadAction = { type: 'send', draft: DRAFT };
const ASKED_ONLY: ThreadAction = { type: 'refetched', messages: [ASKED] };
const REPLY_SAVED: ThreadAction = { type: 'refetched', messages: [ASKED, REPLIED] };
const FINISHED: ThreadAction = { type: 'finished' };
const BROKEN: ThreadAction = { type: 'failed', error: new ApiError('stream') };
const STOPPED: ThreadAction = { type: 'stopped', at: AT };

function run(state: ThreadState, ...actions: ThreadAction[]): ThreadState {
  return actions.reduce(
    (current, action) => deepFreeze(threadReducer(current, deepFreeze(action))),
    deepFreeze(state),
  );
}

/** A draft sent, named and streamed, and then this refetch landed while the read is still open. */
function reading(refetch: ThreadAction): ThreadState {
  return run(createThread(null), SEND, NAMED, TEXT, refetch);
}

const rows = (state: ThreadState) =>
  threadRows(state).map((row) => [row.type, row.type === 'auto' ? row.messageId : null] as const);

describe('a reply saved while its read is still open (P001C-RVW-6)', () => {
  it('is held back mid-read: still streaming, the live turn kept', () => {
    const state = reading(REPLY_SAVED);
    expect(state).toMatchObject({ chatId: CHAT_ID, status: 'streaming', failure: null });
    expect(state.messages).toEqual([ASKED, REPLIED]);
    expect(state.live).not.toBeNull();
    expect(canSend(state)).toBe(false);
    expect(shownMessages(state)).toEqual([]);
    expect(rows(state)).toEqual([
      ['user', null],
      ['auto', null],
    ]);
  });

  it('finished: the turn retires and the reply is the saved row', () => {
    const state = run(reading(REPLY_SAVED), FINISHED);
    expect(state).toMatchObject({ status: 'idle', live: null, failure: null });
    expect(shownMessages(state)).toEqual([ASKED, REPLIED]);
    expect(rows(state)).toEqual([
      ['user', null],
      ['auto', REPLIED.id],
    ]);
    expect(turnNotice(state)).toBeNull();
  });

  it('a read that broke after: the turn retires, never interrupted with Try again', () => {
    const state = run(reading(REPLY_SAVED), BROKEN);
    expect(state).toMatchObject({ status: 'idle', live: null, failure: null });
    expect(awaitsDetachedCheck(state)).toBe(false);
    expect(turnNotice(state)).toBeNull();
    expect(rows(state)).toEqual([
      ['user', null],
      ['auto', REPLIED.id],
    ]);
  });

  it('Stop during the memory step: the turn retires, never stopped under a saved reply', () => {
    const state = run(reading(REPLY_SAVED), STOPPED);
    expect(state).toMatchObject({ status: 'idle', live: null, failure: null });
    expect(turnNotice(state)).toBeNull();
    expect(rows(state)).toEqual([
      ['user', null],
      ['auto', REPLIED.id],
    ]);
  });

  it('a turn the server failed keeps its failure, the reply merged or not', () => {
    const errored = frame({ kind: 'error', message: 'No', code: 'turn_failed' });
    const state = run(createThread(null), SEND, NAMED, TEXT, errored, REPLY_SAVED, FINISHED);
    expect(state).toMatchObject({
      status: 'failed',
      failure: { kind: 'turn', code: 'turn_failed' },
    });
    expect(state.live).not.toBeNull();
  });

  it('with no reply saved yet, the read settles as before: the live turn kept', () => {
    const before = reading(ASKED_ONLY);
    const finished = run(before, FINISHED);
    const broken = run(before, BROKEN);
    const stopped = run(before, STOPPED);
    expect(finished).toMatchObject({ status: 'idle', failure: null, live: before.live });
    expect(broken).toMatchObject({ status: 'failed', failure: { kind: 'stream' } });
    expect(broken.live).toBe(before.live);
    expect(awaitsDetachedCheck(broken)).toBe(true);
    expect(stopped).toMatchObject({ status: 'stopped', failure: null, live: before.live });
    // the after-turn refetch still retires it
    expect(run(finished, REPLY_SAVED)).toMatchObject({ status: 'idle', live: null });
  });
});
