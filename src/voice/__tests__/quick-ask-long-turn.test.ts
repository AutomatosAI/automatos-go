// A long voice turn (28 Oct 2026): HUD showed SOMETHING WENT WRONG on 26–32 s Portuguese turns
// whose reply still arrived. Quick-ask arms no timer of its own on a turn (the chat turn's only cap
// is its status, CHAT_TURN_CONNECT_TIMEOUT_MS, then none while chunks come), so a long healthy turn
// is never an error; and a turn whose read broke (the network, the stream) but ran on is not left an
// error: when A2's detached check says it runs on and its saved reply lands, Auto says the rest.

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/errors';
import { AI_VOICE_GREETING } from '../strings';
import { EARLIER, ask, harness } from './quick-ask-harness';
import { CHAT_ID, frames, saved, wire } from './thread-states';

const ASKED = 'Me dá três ideias de posts para esta semana';
const FIRST = 'Aqui vão três ideias.';
const REST = 'Primeira, um carrossel. Segunda, um vídeo.';

const spoken = (h: ReturnType<typeof harness>): string[] =>
  h.speaker.speak.mock.calls.map(([sentence]) => sentence);

describe('a long quick-ask turn', () => {
  it('runs as long as chunks come: tools, a failed one, then the words; never an error', async () => {
    const h = harness({ speech: { language: 'pt-BR' } });
    await ask(h, ASKED);
    expect(h.later()).toEqual([]);
    h.feed(...frames(wire.chatId(CHAT_ID), wire.toolStart('t-1', 'platform_execute')));
    h.feed(...frames(wire.toolEnd('t-1', 'platform_execute', { success: false })));
    h.feed(...frames(wire.toolStart('t-2', 'composio_execute')));
    h.feed(...frames(wire.toolEnd('t-2', 'composio_execute', { success: false })));
    h.clock.now += 30_000;
    expect(h.voice()).toMatchObject({ phase: 'thinking', errorKind: null });
    h.feed(...frames(wire.text(`${FIRST} ${REST}`), wire.finish), { type: 'finished' });
    expect(h.later()).toEqual([]);
    expect(spoken(h)).toEqual([
      AI_VOICE_GREETING,
      FIRST,
      'Primeira, um carrossel.',
      'Segunda, um vídeo.',
    ]);
    expect(h.voice()).toMatchObject({ errorKind: null, replyFinished: true });
  });

  it('a read that broke shows the snag, then the turn that ran on is spoken to its end', async () => {
    const h = harness({ speech: { language: 'pt-BR' } });
    await ask(h, ASKED);
    h.feed(...frames(wire.text(`${FIRST} Primeira`)));
    expect(spoken(h)).toEqual([AI_VOICE_GREETING, FIRST]);
    h.feed({ type: 'failed', error: new ApiError('network') });
    expect(h.voice()).toMatchObject({ phase: 'error', errorKind: 'turn', turnFailure: 'network' });
    // A2's detached check: the turn runs on the server.
    h.feed({ type: 'detached', turnInFlight: true });
    expect(h.voice()).toMatchObject({ phase: 'thinking', errorKind: null, replyStreaming: true });
    // Its saved reply lands (chat_changed's refetch): the thread retires the turn.
    const reply = saved('m-3', 'assistant', `${FIRST} ${REST}`);
    h.feed({ type: 'refetched', messages: [...EARLIER, saved('m-2', 'user', ASKED), reply] });
    expect(h.thread().status).toBe('idle');
    expect(spoken(h).slice(2)).toEqual(['Primeira, um carrossel.', 'Segunda, um vídeo.']);
    expect(h.voice()).toMatchObject({ reply: `${FIRST} ${REST}`, replyFinished: true });
    h.quickAsk.onSpeaker({ type: 'speak_start' });
    h.quickAsk.onSpeaker({ type: 'speak_done' });
    expect(h.voice()).toMatchObject({ phase: 'idle', errorKind: null });
  });

  it('a turn the server failed (an e: line) stays an error', async () => {
    const h = harness();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('Let me'), wire.error('No key', 'no_api_key')), {
      type: 'finished',
    });
    expect(h.voice()).toMatchObject({ phase: 'error', errorKind: 'turn', turnFailure: 'turn' });
    h.feed({ type: 'refetched', messages: EARLIER });
    expect(h.voice().phase).toBe('error');
  });
});
