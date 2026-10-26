// The reply to quick-ask's turn (US-019g, KV6), over A2's real thread states and the vendored frame
// parser: only quick-ask's turn is followed (by its draft); Auto's text parts only (receipts and the
// lines above them excluded, retracted narration gone); the running or waiting tool's words; a turn
// that failed, stopped or finished; the saved reply once the thread retires the live turn.

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/errors';
import type { ThreadState } from '../../chat/controller/thread';
import {
  awaitingTurn,
  quickAskReply,
  toolCaption,
  trackTurn,
  withoutAbove,
  type TurnTracking,
} from '../quick-ask/reply-text';
import { deepFreeze } from './voice-fixtures';
import {
  AT,
  RECEIPT,
  draft,
  frames,
  opened,
  run,
  saved,
  sent,
  wire,
} from './thread-states';

const ASKED = draft("What's on today?");
const EARLIER = [saved('m-0', 'user', 'Hi'), saved('m-1', 'assistant', 'Morning.')];

/** Quick-ask's send on the opened thread: the tracking at the send, then the thread after it. */
function quickAsk(...lines: readonly string[]) {
  const before = opened(EARLIER);
  const tracking = awaitingTurn(before);
  const state = run(sent(before, ASKED), ...frames(...lines));
  return { tracking: trackTurn(tracking, state), state };
}

function replyOf(state: ThreadState, tracking: TurnTracking) {
  return quickAskReply(deepFreeze(state), tracking);
}

describe('trackTurn', () => {
  it('waits for the live draft that is new since the send, then follows it', () => {
    const before = opened(EARLIER);
    const awaiting = awaitingTurn(before);
    expect(awaiting).toEqual({ kind: 'awaiting', before: null });
    expect(trackTurn(awaiting, before)).toBe(awaiting);
    const after = sent(before, ASKED);
    const tracking = trackTurn(awaiting, after);
    expect(tracking).toMatchObject({ kind: 'following', turn: { draft: ASKED, since: 2 } });
  });

  it('never takes the live turn that was there before the send', () => {
    const typed = sent(opened(EARLIER), draft('Typed on the TYPE sheet'));
    const awaiting = awaitingTurn(typed);
    expect(trackTurn(awaiting, run(typed, ...frames(wire.text('Sure.'))))).toBe(awaiting);
  });

  it('keeps following its own turn when a typed one replaces it', () => {
    const { tracking, state } = quickAsk(wire.text('Two meetings.'), wire.finish);
    // The after-turn refetch answers before the thread sends again (A2's settling).
    const ended = run(state, { type: 'finished' }, { type: 'settled', messages: EARLIER });
    expect(ended.live?.draft).toBe(ASKED);
    const typed = sent(ended, draft('And tomorrow?'));
    expect(typed.live?.draft).not.toBe(ASKED);
    expect(trackTurn(tracking, typed)).toBe(tracking);
    expect(replyOf(typed, tracking)).toBeNull();
  });

  it('returns the same tracking while nothing about the turn changed', () => {
    const { tracking, state } = quickAsk(wire.text('Two meetings.'));
    expect(trackTurn(tracking, state)).toBe(tracking);
  });

  it('says nothing while it is still waiting for the turn', () => {
    const before = opened(EARLIER);
    expect(quickAskReply(before, awaitingTurn(before))).toBeNull();
  });
});

describe('quickAskReply while the turn is live', () => {
  it("is Auto's words as they stream, a lone list marker held back", () => {
    const { tracking, state } = quickAsk(wire.text('You have:\n-'));
    expect(replyOf(state, tracking)).toEqual({
      text: 'You have:',
      streaming: true,
      finished: false,
      stopped: false,
      hasCards: false,
      hasReceipts: false,
      since: EARLIER.length,
    });
  });

  it('leaves out the receipts and the lines above the reply', () => {
    const above = 'Tried to email Maya: refused.';
    const { tracking, state } = quickAsk(
      wire.receipts([RECEIPT], [above]),
      wire.text('I moved #0422 to Done.'),
    );
    const reply = replyOf(state, tracking);
    expect(reply?.text).toBe('I moved #0422 to Done.');
    expect(reply?.text).not.toContain(above);
    expect(reply?.hasReceipts).toBe(true);
  });

  it('an empty receipts list says nothing more is in the chat', () => {
    const { tracking, state } = quickAsk(wire.receipts([]), wire.text('Nothing to do.'));
    expect(replyOf(state, tracking)?.hasReceipts).toBe(false);
  });

  it('drops narration the server retracted', () => {
    const claim = 'I have emailed Maya. ';
    const { tracking, state } = quickAsk(
      wire.text(claim),
      wire.narration(claim, true),
      wire.text('I could not email Maya.'),
    );
    expect(replyOf(state, tracking)?.text).toBe('I could not email Maya.');
  });

  it('moves narration out of the answer once its round called tools', () => {
    const before = 'Let me look. ';
    const { tracking, state } = quickAsk(
      wire.text(before),
      wire.narration(before),
      wire.toolStart('t-1', 'platform_web_search', { query: 'weather Dublin' }),
    );
    const reply = replyOf(state, tracking);
    expect(reply?.text).toBe('');
    expect(reply?.toolCaption).toBe('Searching the web');
  });

  it("names a tool the labels do not know by its readable name, never the input's detail", () => {
    const { tracking, state } = quickAsk(
      wire.toolStart('t-1', 'platform_send_email', { title: 'Hi' }),
    );
    expect(replyOf(state, tracking)?.toolCaption).toBe('Using send email');
  });

  it('says a call waits on the owner, without its summary', () => {
    const { tracking, state } = quickAsk(
      wire.toolStart('t-1', 'platform_send_email'),
      wire.toolEnd('t-1', 'platform_send_email', { waiting: true, summary: 'Approve the email' }),
      wire.text('I need your OK first.'),
      wire.finish,
    );
    const ended = run(state, { type: 'finished' });
    const reply = replyOf(ended, tracking);
    expect(reply?.toolCaption).toBe('Waiting for you');
    expect(reply?.finished).toBe(true);
  });

  it('has no caption once the running call is done', () => {
    const { tracking, state } = quickAsk(
      wire.toolStart('t-1', 'platform_web_search'),
      wire.toolEnd('t-1', 'platform_web_search', { summary: '3 results' }),
      wire.text('It will rain.'),
    );
    expect(replyOf(state, tracking)?.toolCaption).toBeUndefined();
  });

  it('says the cards and tickets the reply raised are in the chat', () => {
    const withdraw = quickAsk(wire.withdraw(), wire.text('Shall I?'));
    expect(replyOf(withdraw.state, withdraw.tracking)?.hasCards).toBe(true);
    const ticket = quickAsk(wire.taskCard(), wire.text('Filed #0431.'));
    expect(replyOf(ticket.state, ticket.tracking)?.hasCards).toBe(true);
  });

  it("carries the answering agent's name when the turn names one", () => {
    const { tracking, state } = quickAsk(wire.agent(' Scout '), wire.text('On it.'));
    expect(replyOf(state, tracking)?.agentName).toBe('Scout');
  });

  it('finishes with the whole text once the read is complete', () => {
    const { tracking, state } = quickAsk(wire.text('Two meetings.\n-'), wire.finish);
    const reply = replyOf(run(state, { type: 'finished' }), tracking);
    expect(reply).toMatchObject({ text: 'Two meetings.\n-', streaming: false, finished: true });
  });

  it("fails with the server's e: line as a turn failure", () => {
    const { tracking, state } = quickAsk(wire.text('Let me'), wire.error('No key', 'no_api_key'));
    const reply = replyOf(run(state, { type: 'finished' }), tracking);
    expect(reply).toMatchObject({ failedKind: 'turn', finished: false, streaming: false });
  });

  it("fails with the client's kind when the read broke", () => {
    const { tracking, state } = quickAsk(wire.text('Let me'));
    const broke = run(state, { type: 'failed', error: new ApiError('network') });
    expect(replyOf(broke, tracking)?.failedKind).toBe('network');
  });

  it("says stopped when A2's Stop ended it, from anywhere", () => {
    const { tracking, state } = quickAsk(wire.text('Two meetings.'));
    const reply = replyOf(run(state, { type: 'stopped', at: AT }), tracking);
    expect(reply).toMatchObject({ stopped: true, finished: false, streaming: false });
  });
});

describe('quickAskReply once the thread retires the live turn', () => {
  const above = 'Tried to email Maya: refused.';
  const reply = saved('m-3', 'assistant', `${above}\n\nI moved #0422 to Done.`, {
    parts: [
      { type: 'text', text: `${above}\n\nI moved #0422 to Done.` },
      { type: 'receipts', receipts: [RECEIPT] },
    ],
  });
  const savedTurn = [...EARLIER, saved('m-2', 'user', ASKED.text), reply];

  it('reads the saved reply without the lines above it', () => {
    const { tracking, state } = quickAsk(
      wire.receipts([RECEIPT], [above]),
      wire.text('I moved #0422'),
    );
    const ended = run(
      state,
      { type: 'refetched', messages: savedTurn },
      { type: 'finished' },
    );
    expect(ended.live).toBeNull();
    expect(replyOf(ended, tracking)).toEqual({
      text: 'I moved #0422 to Done.',
      streaming: false,
      finished: true,
      stopped: false,
      hasCards: false,
      hasReceipts: true,
      since: EARLIER.length,
    });
  });

  it('reads a failure the server saved as a turn failure', () => {
    const failure = saved('m-3', 'assistant', '⚠️ No API key', {
      source: { label: null, origin: 'turn_error', code: 'no_api_key' },
    });
    const { tracking, state } = quickAsk(wire.text('Let me'));
    const messages = [...EARLIER, saved('m-2', 'user', ASKED.text), failure];
    const ended = run(state, { type: 'refetched', messages }, { type: 'finished' });
    expect(replyOf(ended, tracking)).toMatchObject({ failedKind: 'turn', text: '' });
  });

  it('is nothing until the saved reply is in', () => {
    const { tracking, state } = quickAsk(wire.text('Two meetings.'));
    const reopened = run(state, { type: 'opened', chatId: null });
    expect(replyOf(reopened, tracking)).toBeNull();
  });
});

describe('toolCaption', () => {
  it('names nothing for a turn with no calls', () => {
    const { state } = quickAsk(wire.text('Hi.'));
    expect(toolCaption(state.live!.turn, true)).toBeUndefined();
  });
});

describe('withoutAbove', () => {
  it('drops the leading lines that are the platform lines, blank lines among them', () => {
    expect(withoutAbove('A.\n\nB.\n\nThe answer.', ['A.', 'B.'])).toBe('The answer.');
  });

  it('keeps a reply that does not start with them, and one with none', () => {
    expect(withoutAbove('The answer.\nA.', ['A.'])).toBe('The answer.\nA.');
    expect(withoutAbove('The answer.', undefined)).toBe('The answer.');
  });

  it('is empty when the reply is only those lines', () => {
    expect(withoutAbove('A.\n', ['A.'])).toBe('');
  });
});
