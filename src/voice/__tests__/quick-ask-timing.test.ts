// Quick-ask's engine with a timing port (voice latency A-5), over the engine's harness and a spy
// port: the listen's moments, a turn begun at each send, its reference on the chat request only
// when the server lists turn_timing, the reply's marks by that reference, the reference on the
// reply's own sentences and never on the AI notice, and the turn closed at the run's end, at STOP
// and at the next send. With no timing port the engine is as it was.

import { describe, expect, it } from 'vitest';

import type { GateInput } from '../../api/capabilities';
import { AI_VOICE_GREETING } from '../strings';
import type { SpeakOptions } from '../speech/speaker-core';
import { ask, EARLIER, harness, spyTiming } from './quick-ask-harness';
import { SERVER_SPEECH } from './server-ports';
import { frames, wire } from './thread-states';

const ASKED = "What's on today?";
const REF = 'vt-test01-1';
const TIMED: GateInput = { capabilities: ['spoken_mode', 'turn_timing'], push: { expo: true } };
const SERVER: SpeakOptions = Object.freeze({ language: 'en-GB', server: SERVER_SPEECH });

function timed(options: { discovery?: GateInput; speech?: SpeakOptions } = {}) {
  const spy = spyTiming();
  const h = harness({
    discovery: options.discovery ?? TIMED,
    speech: options.speech ?? SERVER,
    timing: spy.timing,
  });
  return { h, calls: spy.calls };
}

/** What the speaker was handed, as [sentence, the turn on its speech or null]. */
function spoken(h: ReturnType<typeof harness>) {
  return h.speaker.speak.mock.calls.map(([sentence, speech]) => [
    sentence,
    speech.server?.turn ?? null,
  ]);
}

describe('a timed quick-ask', () => {
  it("tells the listen's moments in order, then begins a turn at the send", async () => {
    const { h, calls } = timed();
    await ask(h, ASKED);
    expect(calls).toEqual([
      'heard opened',
      'heard words',
      'heard released',
      'heard final',
      `begin ${REF}`,
    ]);
    expect(h.sends).toEqual([{ text: ASKED, spokenMode: true, locale: 'en-GB', turnRef: REF }]);
  });

  it('carries no ref on the send when the server does not list turn_timing; begin still runs', async () => {
    const { h, calls } = timed({
      discovery: { capabilities: ['spoken_mode'], push: { expo: true } },
    });
    await ask(h, ASKED);
    expect(calls).toContain(`begin ${REF}`);
    expect(h.sends).toEqual([{ text: ASKED, spokenMode: true, locale: 'en-GB' }]);
    h.feed(...frames(wire.text('Two meetings. One at ')));
    expect(spoken(h)).toEqual([
      [AI_VOICE_GREETING, null],
      ['Two meetings.', { ref: REF, send: false }],
    ]);
  });

  it("marks the reply's first text and first sentence, and says the notice led", async () => {
    const { h, calls } = timed();
    await ask(h, ASKED);
    calls.length = 0;
    h.feed(...frames(wire.toolStart('t-1', 'platform_web_search')));
    expect(calls).toEqual([]);
    h.feed(...frames(wire.toolEnd('t-1', 'platform_web_search'), wire.text('Two meetings. One ')));
    expect(calls).toEqual([
      `mark ${REF} reply_text`,
      `mark ${REF} sentence`,
      `note ${REF} {"notice":true}`,
    ]);
  });

  it('speaks the notice with no turn on its speech, and the reply’s sentences with it', async () => {
    const { h } = timed();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('Two meetings. One at ten. And ')));
    expect(spoken(h)).toEqual([
      [AI_VOICE_GREETING, null],
      ['Two meetings.', { ref: REF, send: true }],
      ['One at ten.', { ref: REF, send: true }],
    ]);
    expect(h.speaker.speak.mock.calls[0]?.[1]).toBe(SERVER);
    expect(SERVER.server).not.toHaveProperty('turn');
  });

  it("with the phone's voice the speech is the context's own object: there is no request to mark", async () => {
    const phone: SpeakOptions = Object.freeze({ language: 'en-GB' });
    const { h } = timed({ speech: phone });
    await ask(h, ASKED);
    h.feed(...frames(wire.text('Two meetings. One ')));
    h.speaker.speak.mock.calls.forEach(([, speech]) => expect(speech).toBe(phone));
  });

  it('marks audio at speak_start and closes the turn at speak_done after the reply ended', async () => {
    const { h, calls } = timed();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('Two meetings. ')));
    calls.length = 0;
    h.quickAsk.onSpeaker({ type: 'speak_start' });
    expect(calls).toEqual([`mark ${REF} audio`]);
    h.feed(...frames(wire.finish), { type: 'finished' });
    expect(calls).not.toContain(`close ${REF}`);
    h.quickAsk.onSpeaker({ type: 'speak_done' });
    expect(calls.at(-1)).toBe(`close ${REF}`);
    expect(calls.filter((call) => call.startsWith('close'))).toHaveLength(1);
  });

  it('a speak_done while the reply still streams leaves the turn open', async () => {
    const { h, calls } = timed();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('Two meetings. ')));
    h.quickAsk.onSpeaker({ type: 'speak_start' });
    h.quickAsk.onSpeaker({ type: 'speak_done' });
    expect(calls).not.toContain(`close ${REF}`);
    h.feed(...frames(wire.text('One at ten.'), wire.finish), { type: 'finished' });
    h.quickAsk.onSpeaker({ type: 'speak_done' });
    expect(calls.at(-1)).toBe(`close ${REF}`);
  });

  it('a reply that ends with nothing to say closes the turn at once', async () => {
    const { h, calls } = timed();
    await ask(h, ASKED);
    h.feed(...frames(wire.finish), { type: 'finished' });
    expect(calls.at(-1)).toBe(`close ${REF}`);
  });

  it('STOP before any audio closes the turn, with no audio mark', async () => {
    const { h, calls } = timed();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('Two meetings. ')));
    h.quickAsk.stop();
    expect(calls).toContain(`close ${REF}`);
    expect(calls.some((call) => call.endsWith(' audio'))).toBe(false);
  });

  it('a speak_start from the speaker after the turn closed marks with a null ref', async () => {
    const { h, calls } = timed();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('Two meetings. ')));
    h.quickAsk.stop();
    calls.length = 0;
    h.quickAsk.onSpeaker({ type: 'speak_start' });
    expect(calls).toEqual(['mark null audio']);
  });

  it('the next turn gets its own ref, and the one before it is closed first', async () => {
    const { h, calls } = timed();
    await ask(h, 'One?');
    h.feed(...frames(wire.text('One.'), wire.finish), { type: 'finished' });
    h.feed({ type: 'settled', messages: EARLIER });
    h.quickAsk.onSpeaker({ type: 'speak_done' });
    await ask(h, 'Two?');
    const order = calls.filter((call) => call.startsWith('begin') || call.startsWith('close'));
    expect(order).toEqual([`begin ${REF}`, `close ${REF}`, 'begin vt-test01-2']);
    expect(h.sends.map((message) => message.turnRef)).toEqual([REF, 'vt-test01-2']);
  });

  it('never hands the timing port a word that was heard or answered', async () => {
    const { h, calls } = timed();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('Two meetings. One at ten.'), wire.finish), { type: 'finished' });
    h.quickAsk.onSpeaker({ type: 'speak_start' });
    h.quickAsk.onSpeaker({ type: 'speak_done' });
    const everything = calls.join('\n');
    expect(everything).not.toMatch(/today|meetings|One at/i);
  });
});

describe('with no timing port', () => {
  it("the speech handed to the speaker is the context's own object, and no ref is sent", async () => {
    const h = harness({ discovery: TIMED, speech: SERVER });
    await ask(h, ASKED);
    h.feed(...frames(wire.text('Two meetings. One ')));
    expect(h.sends).toEqual([{ text: ASKED, spokenMode: true, locale: 'en-GB' }]);
    expect(h.speaker.speak).toHaveBeenCalledTimes(2);
    h.speaker.speak.mock.calls.forEach(([, speech]) => expect(speech).toBe(SERVER));
  });
});
