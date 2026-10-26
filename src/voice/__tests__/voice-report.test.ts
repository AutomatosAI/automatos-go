// Report this on the voice's reply (D15, P001R-AF-1), over A2's real thread states: quick-ask's turn
// names its saved reply only once the thread retires the turn, by where the turn started (a typed
// turn after it never takes its place), and only where A2's thread offers Report this on that
// message (never a failure or a stop, never an id the server would refuse). The voice's turn on
// the core carries that id while Auto's words are on screen, and none while they stream.

import { describe, expect, it } from 'vitest';

import { REPORT_TARGET_ID_MAX_CHARS } from '../../api/reports';
import type { ThreadState } from '../../chat/controller/thread';
import type { StoredMessage } from '../../chat/schemas';
import {
  awaitingTurn,
  quickAskReply,
  savedReplyId,
  trackTurn,
  type QuickAskReply,
} from '../quick-ask/reply-text';
import { voiceReportId, voiceTurn } from '../screen/core-props';
import { AT as PHASE, SPEAKING, run as voiceRun } from './voice-fixtures';
import { reply as replyOf, view } from './voice-view-fixtures';
import { draft, frames, opened, run, saved, sent, wire } from './thread-states';

const ASKED = draft("What's on today?");
const EARLIER = [saved('m-0', 'user', 'Hi'), saved('m-1', 'assistant', 'Morning.')];
const ANSWER = saved('m-3', 'assistant', 'Two meetings.');
const SAVED_TURN = [...EARLIER, saved('m-2', 'user', ASKED.text), ANSWER];

type Asked = { readonly state: ThreadState; readonly reply: QuickAskReply | null };

/** Quick-ask's send, these lines, then the end: the reply the snapshot keeps as the feed ends. */
function askedAndEnded(...lines: readonly string[]): Asked {
  const before = opened(EARLIER);
  const tracking = trackTurn(awaitingTurn(before), run(sent(before, ASKED)));
  const state = run(sent(before, ASKED), ...frames(...lines), { type: 'finished' });
  return { state, reply: quickAskReply(state, trackTurn(tracking, state)) };
}

/** The after-turn refetch's answer, with these messages saved. */
const settled = (state: ThreadState, messages: readonly StoredMessage[]) =>
  run(state, { type: 'settled', messages });

describe("savedReplyId: the voice's saved reply, once the thread retires its turn", () => {
  it('is null while the turn is still live, finished but not saved', () => {
    const { state, reply } = askedAndEnded(wire.text('Two meetings.'));
    expect(reply).toMatchObject({ finished: true, since: EARLIER.length });
    expect(state.live).not.toBeNull();
    expect(savedReplyId(state, reply)).toBeNull();
  });

  it("names Auto's first message from where the turn started once it is saved", () => {
    const { state, reply } = askedAndEnded(wire.text('Two meetings.'));
    const retired = settled(state, SAVED_TURN);
    expect(retired.live).toBeNull();
    expect(savedReplyId(retired, reply)).toBe('m-3');
  });

  it('keeps naming the voice’s reply after a typed turn follows it', () => {
    const { state, reply } = askedAndEnded(wire.text('Two meetings.'));
    const typed = sent(settled(state, SAVED_TURN), draft('And tomorrow?'));
    expect(savedReplyId(typed, reply)).toBe('m-3');
    const answered = settled(run(typed, ...frames(wire.text('One.')), { type: 'finished' }), [
      ...SAVED_TURN,
      saved('m-4', 'user', 'And tomorrow?'),
      saved('m-5', 'assistant', 'One.'),
    ]);
    expect(answered.live).toBeNull();
    expect(savedReplyId(answered, reply)).toBe('m-3');
  });

  it('is null for no reply, and for a turn that failed or was stopped', () => {
    const retired = settled(askedAndEnded(wire.text('Two meetings.')).state, SAVED_TURN);
    expect(savedReplyId(retired, null)).toBeNull();
    const failed = replyOf({ finished: false, failedKind: 'turn', since: EARLIER.length });
    const stopped = replyOf({ finished: false, stopped: true, since: EARLIER.length });
    expect(savedReplyId(retired, failed)).toBeNull();
    expect(savedReplyId(retired, stopped)).toBeNull();
  });
});

describe('voiceReportId: where A2’s thread offers Report this on that message', () => {
  it('is the saved reply’s id', () => {
    const { state, reply } = askedAndEnded(wire.text('Two meetings.'));
    expect(voiceReportId(state, reply)).toBeNull();
    expect(voiceReportId(settled(state, SAVED_TURN), reply)).toBe('m-3');
  });

  it("refuses a saved failure and an id the server's target_id would refuse", () => {
    const { state, reply } = askedAndEnded(wire.text('Two meetings.'));
    const failure = {
      ...ANSWER,
      source: { label: null, origin: 'turn_error', code: 'turn_failed' },
    };
    expect(voiceReportId(settled(state, [...SAVED_TURN.slice(0, 3), failure]), reply)).toBeNull();
    const tooLong = { ...ANSWER, id: 'v'.repeat(REPORT_TARGET_ID_MAX_CHARS + 1) };
    expect(voiceReportId(settled(state, [...SAVED_TURN.slice(0, 3), tooLong]), reply)).toBeNull();
  });
});

describe("the voice's turn on the core", () => {
  const spoken = view({
    state: voiceRun([...SPEAKING, { type: 'turn_finished' }, { type: 'speak_done' }]),
  });

  it("carries the id while Auto's finished words are on screen", () => {
    expect(spoken.transcript).toMatchObject({
      auto: 'You have two meetings.',
      autoStreaming: false,
    });
    expect(voiceTurn(spoken, null, 'm-3').autoMessageId).toBe('m-3');
    expect(voiceTurn(spoken, null).autoMessageId).toBeNull();
  });

  it('carries none while the reply streams, nor before Auto has words', () => {
    expect(voiceTurn(view({ state: PHASE.speaking }), null, 'm-3')).toMatchObject({
      streaming: true,
      autoMessageId: null,
    });
    expect(voiceTurn(view({ state: PHASE.listening }), null, 'm-3')).toMatchObject({
      auto: null,
      autoMessageId: null,
    });
  });
});
