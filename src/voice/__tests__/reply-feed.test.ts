// One quick-ask reply fed as it streams (US-019g, KV6): the transcript's words (speakable), the
// running tool, the sentences new since the last view, the rest at the end; a failed or stopped turn
// silences the speech; after the first ending the feed says nothing. A read that broke is not an
// ending: turn_failed once, then turn_resumed and the rest when the turn runs on (28 Oct 2026).

import { describe, expect, it } from 'vitest';

import { createReplyFeed } from '../quick-ask/reply-feed';
import type { QuickAskReply } from '../quick-ask/reply-text';

function reply(changes: Partial<QuickAskReply> = {}): QuickAskReply {
  return {
    text: '',
    streaming: true,
    finished: false,
    stopped: false,
    hasCards: false,
    hasReceipts: false,
    since: 0,
    ...changes,
  };
}

describe('createReplyFeed', () => {
  it('says the speakable words and hands over each sentence once it is complete', () => {
    const feed = createReplyFeed();
    expect(feed.next(reply({ text: '**Two** meetings. One at' }))).toEqual({
      events: [{ type: 'turn_text', text: 'Two meetings. One at' }],
      speak: ['Two meetings.'],
      ended: false,
      silence: false,
    });
    expect(feed.next(reply({ text: '**Two** meetings. One at ten' })).speak).toEqual([]);
  });

  it('says nothing when nothing changed', () => {
    const feed = createReplyFeed();
    const first = reply({ text: 'Hello. ' });
    feed.next(first);
    expect(feed.next({ ...first })).toEqual({
      events: [],
      speak: [],
      ended: false,
      silence: false,
    });
  });

  it('follows the running tool while the turn streams, and drops it once it does not', () => {
    const feed = createReplyFeed();
    expect(feed.next(reply({ toolCaption: 'Searching the web' })).events).toEqual([
      { type: 'turn_tool', caption: 'Searching the web' },
    ]);
    expect(feed.next(reply({ toolCaption: 'Searching the web' })).events).toEqual([]);
    expect(feed.next(reply({ text: 'Rain.' })).events).toEqual([
      { type: 'turn_text', text: 'Rain.' },
      { type: 'turn_tool', caption: null },
    ]);
  });

  it('finishes with the rest of the text and turn_finished', () => {
    const feed = createReplyFeed();
    feed.next(reply({ text: 'One. Two' }));
    expect(feed.next(reply({ text: 'One. Two', streaming: false, finished: true }))).toEqual({
      events: [{ type: 'turn_finished' }],
      speak: ['Two'],
      ended: true,
      silence: false,
    });
  });

  it('a failed turn says turn_failed and silences the speech', () => {
    const feed = createReplyFeed();
    feed.next(reply({ text: 'Let me. ' }));
    expect(feed.next(reply({ streaming: false, failedKind: 'turn' }))).toEqual({
      events: [{ type: 'turn_failed', kind: 'turn' }],
      speak: [],
      ended: true,
      silence: true,
    });
  });

  it('a read that broke says turn_failed once, then resumes with the words not yet spoken', () => {
    const feed = createReplyFeed();
    expect(feed.next(reply({ text: 'Aqui vão três ideias. Primeira' })).speak).toEqual([
      'Aqui vão três ideias.',
    ]);
    const broke = reply({ text: 'Aqui vão três ideias. Primeira', streaming: false });
    expect(feed.next({ ...broke, failedKind: 'network' })).toEqual({
      events: [{ type: 'turn_failed', kind: 'network' }],
      speak: [],
      ended: false,
      silence: true,
    });
    expect(feed.next({ ...broke, failedKind: 'stream' })).toEqual({
      events: [],
      speak: [],
      ended: false,
      silence: false,
    });
    const text = 'Aqui vão três ideias. Primeira, um carrossel. Segunda, um vídeo.';
    expect(feed.next(reply({ text, streaming: false, finished: true }))).toEqual({
      events: [{ type: 'turn_resumed' }, { type: 'turn_text', text }, { type: 'turn_finished' }],
      speak: ['Primeira, um carrossel.', 'Segunda, um vídeo.'],
      ended: true,
      silence: false,
    });
  });

  it("a turn A2's Stop ended (from anywhere) says stop and silences the speech", () => {
    const feed = createReplyFeed();
    expect(feed.next(reply({ text: 'One. ', streaming: false, stopped: true }))).toEqual({
      events: [{ type: 'stop' }],
      speak: [],
      ended: true,
      silence: true,
    });
  });

  it('says nothing after the first ending', () => {
    const feed = createReplyFeed();
    feed.next(reply({ text: 'Done.', streaming: false, finished: true }));
    expect(feed.next(reply({ text: 'Done. More.', streaming: false, finished: true }))).toEqual({
      events: [],
      speak: [],
      ended: false,
      silence: false,
    });
  });
});

// Voice latency E-11: the feed of a spokenMode turn from a server that lists 'spoken_unit_ends'.
describe('createReplyFeed with unitEnds', () => {
  it('hands over a sentence that ends the text so far, and no second copy when the turn finishes', () => {
    const feed = createReplyFeed({ unitEnds: true });
    expect(feed.next(reply({ text: 'Sure thing.' }))).toEqual({
      events: [{ type: 'turn_text', text: 'Sure thing.' }],
      speak: ['Sure thing.'],
      ended: false,
      silence: false,
    });
    expect(feed.next(reply({ text: 'Sure thing.', streaming: false, finished: true }))).toEqual({
      events: [{ type: 'turn_finished' }],
      speak: [],
      ended: true,
      silence: false,
    });
  });

  it('speaks each unit as its frame lands, one unit sooner than without it', () => {
    const feed = createReplyFeed({ unitEnds: true });
    expect(feed.next(reply({ text: 'You have **two** meetings.' })).speak).toEqual([
      'You have two meetings.',
    ]);
    expect(feed.next(reply({ text: 'You have **two** meetings. One at ten.' })).speak).toEqual([
      'One at ten.',
    ]);
    const done = reply({
      text: 'You have **two** meetings. One at ten.',
      streaming: false,
      finished: true,
    });
    expect(feed.next(done).speak).toEqual([]);
  });

  it('still holds a unit with no terminator for the end of the turn', () => {
    const feed = createReplyFeed({ unitEnds: true });
    expect(feed.next(reply({ text: 'Talk to Dr.' })).speak).toEqual([]);
    expect(feed.next(reply({ text: "It's five o'clock" })).speak).toEqual([]);
    const done = reply({ text: "It's five o'clock", streaming: false, finished: true });
    expect(feed.next(done).speak).toEqual(["It's five o'clock"]);
  });

  it.each([undefined, {}, { unitEnds: false }, { firstClause: true }])(
    'waits for the next sentence to begin without it (options: %j)',
    (options) => {
      const feed = createReplyFeed(options);
      expect(feed.next(reply({ text: 'Sure thing.' })).speak).toEqual([]);
      expect(
        feed.next(reply({ text: 'Sure thing.', streaming: false, finished: true })).speak,
      ).toEqual(['Sure thing.']);
    },
  );
});
