import { describe, expect, it } from 'vitest';

import { ApiError } from '../../../api/errors';
import { CHAT_ID, line, saved } from '../../../chat/__tests__/thread-fixtures';
import { opened, receipt } from '../../../chat/__tests__/view-model-fixtures';
import { createThread, threadReducer, type ThreadState } from '../../../chat/controller/thread';
import { parseLine, type Frame } from '../../../core/ai-sdk-stream';
import {
  approvalWaiting,
  captionFactsOf,
  chatStatusOf,
  replyProgressOf,
  threadMascotEvents,
} from '../mascot-feed';
import {
  FINISH,
  FINISHED,
  SEARCH_END,
  SEARCH_START,
  SEND,
  TOOL_APPROVAL,
  autoShows,
  frame,
  homeOn,
  live,
  madeDocument,
} from './fixtures';

const DONE_RECEIPT: Frame = { kind: 'receipts', receipts: [receipt({})], above: [] };
const STOPPED = { type: 'stopped', at: '2026-10-24T09:00:00.000Z' } as const;
/** One line of the real stream through the foundation's parser. */
const parsed = (text: string): Frame => parseLine(text.trimEnd());

describe('Auto over A2’s thread: the frames and how the thread moved', () => {
  it('a send starts the turn: Auto thinks', () => {
    expect(autoShows(live(homeOn(opened()), SEND))).toBe('thinking');
  });

  it('a web search from the parser: searching, then its end lets him go on', () => {
    const searching = live(homeOn(opened()), SEND, frame(SEARCH_START));
    expect(autoShows(searching)).toBe('searching');
    expect(autoShows(live(searching, frame(SEARCH_END)))).not.toBe('searching');
    const fromLine = live(
      homeOn(opened()),
      SEND,
      frame(parsed(line.toolStart('call-2', 'platform_web_search'))),
    );
    expect(autoShows(fromLine)).toBe('searching');
  });

  it('his words end the thinking', () => {
    const answering = live(homeOn(opened()), SEND, frame(parsed(line.text('Aim for 16 GB.'))));
    expect(autoShows(answering)).toBe('idle');
  });

  it('a done receipt celebrates once the turn finishes', () => {
    const home = live(homeOn(opened()), SEND, frame(DONE_RECEIPT), frame(FINISH), FINISHED);
    expect(home.state.status).toBe('idle');
    expect(autoShows(home)).toBe('celebrate');
  });

  it('Stop: the turn ends and its done receipt no longer celebrates', () => {
    const home = live(homeOn(opened()), SEND, frame(DONE_RECEIPT), STOPPED);
    expect(home.state.status).toBe('stopped');
    expect(autoShows(home)).not.toBe('celebrate');
    expect(home.run.driver.mascot.turnActive).toBe(false);
  });

  it('a turn the server failed (an e: line) and a read that broke are oops', () => {
    const failedTurn = live(
      homeOn(opened()),
      SEND,
      frame(parsed(line.error('The model is busy', 'model_unavailable'))),
      FINISHED,
    );
    expect(failedTurn.state.status).toBe('failed');
    expect(autoShows(failedTurn)).toBe('oops');
    const broken = live(homeOn(opened()), SEND, {
      type: 'failed',
      error: new ApiError('network', {}),
    });
    expect(autoShows(broken)).toBe('oops');
  });

  it('a tool card waiting on the user: Auto listens until it is answered', () => {
    const waiting = live(homeOn(opened()), SEND, frame(TOOL_APPROVAL), frame(FINISH), FINISHED);
    expect(approvalWaiting(waiting.state)).toBe(true);
    expect(autoShows(waiting)).toBe('listening');
    const [card] = waiting.state.cards;
    const answered = live(waiting, { type: 'card', key: card.key, outcome: { state: 'denied' } });
    expect(approvalWaiting(answered.state)).toBe(false);
    expect(autoShows(answered)).toBe('idle');
  });

  it('a Deliverable landing in the chat: Auto celebrates (US-017g)', () => {
    const made = live(
      homeOn(opened()),
      SEND,
      frame(madeDocument('shortlist-1', 'Laptop shortlist')),
    );
    expect(autoShows(made)).toBe('celebrate');
    expect(made.run.driver.mascot.celebratedThisTurn).toBe(true);
  });

  it('a chat reopened mid-turn works until the saved reply lands', () => {
    const question = saved('m1', 'user', 'Find me a laptop');
    const reopened = live(homeOn(createThread(CHAT_ID)), {
      type: 'loaded',
      chatId: CHAT_ID,
      messages: [question],
      turnInFlight: true,
    });
    expect(reopened.state.status).toBe('working');
    expect(autoShows(reopened)).toBe('thinking');
    const replied = live(reopened, {
      type: 'refetched',
      messages: [question, saved('m2', 'assistant', 'Here are three.')],
    });
    expect(replied.state.status).toBe('idle');
    expect(autoShows(replied)).toBe('idle');
  });
});

describe('the feed’s rules', () => {
  const sent = threadReducer(opened(), SEND);

  it('reads the thread’s status as the web chat’s', () => {
    expect(chatStatusOf({ status: 'streaming' })).toBe('streaming');
    expect(chatStatusOf({ status: 'working' })).toBe('streaming');
    expect(chatStatusOf({ status: 'failed' })).toBe('error');
    for (const status of ['idle', 'stopped', 'loading'] as const) {
      expect(chatStatusOf({ status })).toBe('idle');
    }
  });

  it('says nothing when nothing moved, and Stop before the turn’s end', () => {
    expect(threadMascotEvents(sent, sent)).toEqual([]);
    const stopped = threadReducer(sent, STOPPED);
    expect(threadMascotEvents(sent, stopped).map((event) => event.type)).toEqual([
      'stop',
      'finish',
    ]);
  });

  it('a send is the composer’s send; a failure carries its code', () => {
    expect(threadMascotEvents(opened(), sent)).toEqual([{ type: 'send' }]);
    const failed = threadReducer(sent, { type: 'failed', error: new ApiError('network', {}) });
    expect(threadMascotEvents(sent, failed)).toEqual([
      { type: 'error', message: 'The turn failed', code: null },
    ]);
  });

  it('reads the live reply’s progress, and none with no turn on screen', () => {
    expect(replyProgressOf(opened()).id).toBeNull();
    const searching = [frame(SEARCH_START), frame(parsed(line.text('So far')))].reduce(
      threadReducer,
      sent,
    );
    expect(replyProgressOf(searching)).toMatchObject({
      hasText: true,
      toolRunning: true,
      limitReached: false,
    });
  });

  it('says deliverable-added once per new Deliverable, for the turn that named it', () => {
    const shortlist = madeDocument('shortlist-1', 'Laptop shortlist');
    const made = threadReducer(sent, frame(shortlist));
    expect(threadMascotEvents(sent, made)).toEqual([{ type: 'deliverable-added' }]);
    const again = threadReducer(made, frame(shortlist));
    expect(threadMascotEvents(made, again)).toEqual([]);
    const second = threadReducer(made, frame(madeDocument('budget-2', 'Lisbon budget')));
    expect(threadMascotEvents(made, second)).toEqual([{ type: 'deliverable-added' }]);
    expect(threadMascotEvents(opened(), sent)).toEqual([{ type: 'send' }]);
  });

  it('leaves the words to the frames while this phone reads them', () => {
    const words = threadReducer(sent, frame(parsed(line.text('Aim for 16 GB.'))));
    expect(threadMascotEvents(sent, words)).toEqual([]);
  });

  it('tells Play’s caption the running query, the newest Deliverable and a waiting card', () => {
    const state: ThreadState = [
      frame(SEARCH_START),
      frame(madeDocument('shortlist-1', 'Laptop shortlist')),
      frame(TOOL_APPROVAL),
    ].reduce(threadReducer, sent);
    expect(captionFactsOf(state)).toEqual({
      runningInput: { query: 'best budget laptops' },
      deliverableKind: 'document',
      approvalWaiting: true,
    });
    expect(captionFactsOf(opened())).toEqual({
      runningInput: undefined,
      deliverableKind: undefined,
      approvalWaiting: false,
    });
  });
});
