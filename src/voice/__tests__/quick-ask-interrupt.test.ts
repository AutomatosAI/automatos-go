// Quick-ask's interruptions on the engine (US-019h, KV10) over spy ports and A2's real thread reducer:
// leaving the screen mid-hold sends nothing, mid-reply silences the rest of the reply without
// cancelling the turn, and ends the AI-notice session; a call or a lost microphone mid-hold aborts
// with the words kept; coming back to the screen reopens nothing, and the next press still works.

import { describe, expect, it } from 'vitest';

import type { PermissionVerdict } from '../permissions/permission-flow';
import { AI_VOICE_GREETING } from '../strings';
import { ask, EARLIER, GRANTED, harness, type Harness } from './quick-ask-harness';
import { frames, wire } from './thread-states';

const ASKED = "What's on today?";
const app = (status: string) => ({ type: 'app', status }) as const;

/** Press and hear the first words: the mic is open, the hold under way. */
async function holding(h: Harness, words = "What's on"): Promise<void> {
  await h.quickAsk.press();
  h.hear({ type: 'mic_open' });
  h.hear({ type: 'partial', text: words });
}

/** A quick-ask whose reply is being spoken: the greeting and the first sentence queued. */
async function speaking(h: Harness): Promise<void> {
  await ask(h, ASKED);
  h.feed(...frames(wire.text('You have two meetings. One at ')));
  h.quickAsk.onSpeaker({ type: 'speak_start' });
}

describe("leaving the screen ('background')", () => {
  it('mid-hold: the recognizer aborts, nothing is sent, the words stay on screen', async () => {
    const h = harness();
    await holding(h);
    h.quickAsk.interrupt(app('background'));
    expect(h.recognizer.abort).toHaveBeenCalledTimes(1);
    expect(h.voice()).toMatchObject({
      phase: 'idle',
      micOpen: false,
      heard: "What's on",
      message: 'interrupted',
    });
    // The module's own end of the aborted session: no final, nothing sent.
    h.hear({ type: 'mic_closed' });
    h.quickAsk.onRecognizer({ kind: 'ended' });
    h.quickAsk.release();
    expect(h.sends).toEqual([]);
    expect(h.recognizer.stop).not.toHaveBeenCalled();
  });

  it('mid-reply: the speech stops and the rest is never spoken; the turn is not cancelled', async () => {
    const h = harness();
    await speaking(h);
    const spokenBefore = h.speaker.speak.mock.calls.length;
    h.quickAsk.interrupt(app('background'));
    expect(h.speaker.stop).toHaveBeenCalled();
    expect(h.log).not.toContain('thread.stop');
    expect(h.voice()).toMatchObject({ phase: 'idle', message: 'interrupted' });
    h.feed(...frames(wire.text('ten.'), wire.finish), { type: 'finished' });
    expect(h.speaker.speak).toHaveBeenCalledTimes(spokenBefore);
  });

  it('ends the AI-notice session: the next spoken reply greets again', async () => {
    const h = harness();
    const turn = async (words: string, reply: string) => {
      await ask(h, words);
      h.feed(...frames(wire.text(reply), wire.finish), { type: 'finished' });
      h.feed({ type: 'settled', messages: EARLIER });
      h.quickAsk.onSpeaker({ type: 'speak_done' });
    };
    await turn('One?', 'One.');
    h.quickAsk.interrupt(app('inactive'));
    h.quickAsk.interrupt(app('active'));
    await turn('Two?', 'Two.');
    h.quickAsk.interrupt(app('background'));
    h.quickAsk.interrupt(app('active'));
    await turn('Three?', 'Three.');
    const spoken = h.speaker.speak.mock.calls.map(([sentence]) => sentence);
    expect(spoken).toEqual([AI_VOICE_GREETING, 'One.', 'Two.', AI_VOICE_GREETING, 'Three.']);
  });

  it('while idle: nothing to say on return, the line stays as it was', async () => {
    const h = harness();
    h.quickAsk.interrupt(app('background'));
    expect(h.voice()).toMatchObject({ phase: 'idle', message: null });
    expect(h.recognizer.start).not.toHaveBeenCalled();
  });

  it('during the checks (a permission prompt up): the press ends and the mic never opens', async () => {
    let answer: (verdict: PermissionVerdict) => void = () => undefined;
    const h = harness({
      permissionAnswer: () =>
        new Promise<PermissionVerdict>((resolve) => {
          answer = resolve;
        }),
    });
    const pressed = h.quickAsk.press();
    h.quickAsk.interrupt(app('background'));
    answer(GRANTED);
    await pressed;
    expect(h.recognizer.start).not.toHaveBeenCalled();
  });
});

describe('coming back to the screen reopens nothing (KV10)', () => {
  it("'active' after leaving mid-hold or mid-reply starts no mic, speech or turn", async () => {
    const h = harness();
    await speaking(h);
    h.quickAsk.interrupt(app('background'));
    await holding(h);
    h.quickAsk.interrupt(app('background'));
    const before = [...h.log];
    h.quickAsk.interrupt(app('inactive'));
    h.quickAsk.interrupt(app('active'));
    expect(h.log).toEqual(before);
    expect(h.voice()).toMatchObject({ phase: 'idle', micOpen: false });
  });

  it("'inactive' mid-hold (Control Centre, a call banner) leaves the hold alone", async () => {
    const h = harness();
    await holding(h);
    h.quickAsk.interrupt(app('inactive'));
    expect(h.recognizer.abort).not.toHaveBeenCalled();
    expect(h.voice()).toMatchObject({ phase: 'listening', micOpen: true });
  });

  it('the next press after an interruption listens again', async () => {
    const h = harness();
    await holding(h);
    h.quickAsk.interrupt(app('background'));
    h.quickAsk.onRecognizer({ kind: 'ended' });
    await h.quickAsk.press();
    expect(h.recognizer.start).toHaveBeenCalledTimes(2);
    expect(h.voice()).toMatchObject({ phase: 'listening', message: null });
  });
});

describe('the recognizer loses the audio mid-hold', () => {
  it("a call or Siri ('interrupted'): abort, the words kept un-sent, 'Interrupted'", async () => {
    const h = harness();
    await holding(h, 'Remind me');
    h.hear({ type: 'interrupted', reason: 'audio-session' });
    expect(h.recognizer.abort).toHaveBeenCalledTimes(1);
    expect(h.voice()).toMatchObject({
      phase: 'idle',
      micOpen: false,
      heard: 'Remind me',
      message: 'interrupted',
    });
    h.quickAsk.onRecognizer({ kind: 'ended' });
    h.quickAsk.release();
    expect(h.sends).toEqual([]);
  });

  it("the microphone going away ('audio-capture' with the mic open): 'The microphone changed'", async () => {
    const h = harness();
    await holding(h);
    h.hear({ type: 'error', kind: 'mic-busy' });
    expect(h.recognizer.abort).toHaveBeenCalledTimes(1);
    expect(h.voice()).toMatchObject({ phase: 'idle', errorKind: null, message: 'micChanged' });
    expect(h.sends).toEqual([]);
  });

  it("'audio-capture' before the mic opened is the input busy, as before", async () => {
    const h = harness();
    await h.quickAsk.press();
    h.hear({ type: 'error', kind: 'mic-busy' });
    expect(h.recognizer.abort).not.toHaveBeenCalled();
    expect(h.voice()).toMatchObject({ phase: 'error', errorKind: 'mic-busy' });
  });

  it('a late interruption after the release changes nothing', async () => {
    const h = harness();
    await ask(h, ASKED);
    const before = h.voice();
    h.hear({ type: 'interrupted', reason: 'audio-session' });
    expect(h.voice()).toBe(before);
    expect(h.recognizer.abort).not.toHaveBeenCalled();
  });
});
