// Quick-ask's engine (US-019g, KV5, KV6, KV7, KV13) over spy ports and A2's real thread reducer:
// hold, hear, send through A2's thread with spokenMode, speak the reply sentence by sentence with the
// AI notice first once per session; barge-in stops the speech before the mic opens and cancels only
// a streaming turn; STOP and 'Auto, stop' send nothing; a typed turn is never spoken; a viewer's
// press opens nothing; leaving the screen stops the mic and the speech.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { HOLD_MAX_MS } from '../config';
import type { PermissionVerdict } from '../permissions/permission-flow';
import { AI_VOICE_GREETING } from '../strings';
import { ask, EARLIER, GRANTED, harness, READY } from './quick-ask-harness';
import { frames, saved, wire } from './thread-states';

afterEach(() => {
  vi.restoreAllMocks();
});

const ASKED = "What's on today?";

describe('a quick-ask, end to end', () => {
  it('asks the permission and the policy at the press, then listens on the phone', async () => {
    const h = harness();
    await h.quickAsk.press();
    expect(h.log).toEqual(['permissions.press', 'recognizer.start']);
    expect(h.permissions.press).toHaveBeenCalledWith('quick-ask');
    expect(h.recognizer.start).toHaveBeenCalledWith(READY);
    expect(h.voice()).toMatchObject({ phase: 'listening', micOpen: false });
    h.hear({ type: 'mic_open' });
    h.hear({ type: 'partial', text: "What's on" });
    expect(h.voice()).toMatchObject({ micOpen: true, heard: "What's on" });
  });

  it('sends the final through the thread with spokenMode, once, and the reducer thinks', async () => {
    const h = harness();
    await ask(h, ASKED);
    expect(h.recognizer.stop).toHaveBeenCalledTimes(1);
    expect(h.sends).toEqual([{ text: ASKED, spokenMode: true }]);
    expect(h.voice()).toMatchObject({
      phase: 'thinking',
      heard: ASKED,
      replyStreaming: true,
      notice: 'greeting',
    });
  });

  it("speaks Auto's sentences as they stream, the AI notice first, then goes idle", async () => {
    const h = harness();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('You have **two** meetings. One at ')));
    expect(h.speaker.speak.mock.calls.map(([sentence]) => sentence)).toEqual([
      AI_VOICE_GREETING,
      'You have two meetings.',
    ]);
    expect(h.voice().reply).toBe('You have two meetings. One at');
    h.quickAsk.onSpeaker({ type: 'speak_start' });
    expect(h.voice().phase).toBe('speaking');
    h.feed(...frames(wire.text('ten.'), wire.finish), { type: 'finished' });
    expect(h.speaker.speak).toHaveBeenLastCalledWith('One at ten.', { language: 'en-GB' });
    expect(h.voice()).toMatchObject({ phase: 'speaking', replyFinished: true });
    h.quickAsk.onSpeaker({ type: 'speak_done' });
    expect(h.voice()).toMatchObject({ phase: 'idle', reply: 'You have two meetings. One at ten.' });
  });

  it('shows the running tool while Auto works, and says it once the call ends', async () => {
    const h = harness();
    await ask(h, 'Will it rain?');
    h.feed(...frames(wire.toolStart('t-1', 'platform_web_search')));
    expect(h.voice().toolCaption).toBe('Searching the web');
    h.feed(...frames(wire.toolEnd('t-1', 'platform_web_search'), wire.text('It will.')));
    expect(h.voice().toolCaption).toBeNull();
  });

  it('greets once per voice session, and again after a new session', async () => {
    const h = harness();
    const turn = async (words: string, reply: string) => {
      await ask(h, words);
      h.feed(...frames(wire.text(reply), wire.finish), { type: 'finished' });
      h.feed({ type: 'settled', messages: EARLIER });
      h.quickAsk.onSpeaker({ type: 'speak_done' });
    };
    await turn('One?', 'One.');
    await turn('Two?', 'Two.');
    h.quickAsk.newSession();
    await turn('Three?', 'Three.');
    const spoken = h.speaker.speak.mock.calls.map(([sentence]) => sentence);
    expect(spoken).toEqual([AI_VOICE_GREETING, 'One.', 'Two.', AI_VOICE_GREETING, 'Three.']);
  });

  it('a turn that finishes with nothing to say ends Auto’s turn at once', async () => {
    const h = harness();
    await ask(h, ASKED);
    h.feed(...frames(wire.finish), { type: 'finished' });
    expect(h.speaker.speak).not.toHaveBeenCalled();
    expect(h.voice().phase).toBe('idle');
  });

  it('a failed turn speaks nothing more and shows the failure', async () => {
    const h = harness();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('Let me'), wire.error('No key', 'no_api_key')), {
      type: 'finished',
    });
    expect(h.speaker.stop).toHaveBeenCalled();
    expect(h.voice()).toMatchObject({ phase: 'error', errorKind: 'turn', turnFailure: 'turn' });
  });

  it('words heard while the thread settles wait, and go once it may send', async () => {
    const h = harness();
    await ask(h, 'First?');
    h.feed(...frames(wire.text('One.'), wire.finish), { type: 'finished' });
    h.quickAsk.onSpeaker({ type: 'speak_done' });
    expect(h.thread().settling).toBe(true);
    await ask(h, 'Second?');
    expect(h.sends).toHaveLength(1);
    h.feed({ type: 'settled', messages: EARLIER });
    expect(h.sends.map((message) => message.text)).toEqual(['First?', 'Second?']);
  });

  it("the next send takes the last turn's reply off the snapshot until its own", async () => {
    const h = harness();
    await ask(h, ASKED);
    h.feed(...frames(wire.taskCard(), wire.text('Filed it.'), wire.finish), { type: 'finished' });
    expect(h.quickAsk.snapshot().reply).toMatchObject({ hasCards: true, finished: true });
    h.feed({ type: 'settled', messages: EARLIER });
    h.quickAsk.onSpeaker({ type: 'speak_done' });
    await ask(h, 'And tomorrow?');
    expect(h.sends).toHaveLength(2);
    expect(h.quickAsk.snapshot().reply).toBeNull();
    h.feed(...frames(wire.text('Nothing yet.')));
    expect(h.quickAsk.snapshot().reply).toMatchObject({ text: 'Nothing yet.', hasCards: false });
  });
});

describe('a hold that sends nothing', () => {
  it('a tap aborts the recognizer and hints to hold', async () => {
    const h = harness();
    await h.quickAsk.press();
    h.clock.now += 100;
    h.quickAsk.release();
    expect(h.recognizer.abort).toHaveBeenCalledTimes(1);
    expect(h.recognizer.stop).not.toHaveBeenCalled();
    expect(h.voice()).toMatchObject({ phase: 'idle', message: 'holdHint' });
  });

  it('a release during the checks never opens the mic', async () => {
    let answer: (verdict: PermissionVerdict) => void = () => undefined;
    const h = harness({
      permissionAnswer: () =>
        new Promise<PermissionVerdict>((resolve) => {
          answer = resolve;
        }),
    });
    const pressed = h.quickAsk.press();
    h.clock.now += 50;
    h.quickAsk.release();
    answer(GRANTED);
    await pressed;
    expect(h.recognizer.start).not.toHaveBeenCalled();
    expect(h.voice()).toMatchObject({ phase: 'idle', message: 'holdHint' });
  });

  it("'Auto, stop' said as the whole hold is STOP: nothing is sent", async () => {
    const h = harness();
    await ask(h, 'Auto, stop.');
    expect(h.sends).toEqual([]);
    expect(h.speaker.stop).toHaveBeenCalled();
    expect(h.voice()).toMatchObject({ phase: 'idle', heard: '' });
  });

  it('a request that mentions stopping is sent as heard', async () => {
    const h = harness();
    await ask(h, 'Stop the deploy');
    expect(h.sends).toEqual([{ text: 'Stop the deploy', spokenMode: true }]);
  });

  it('HOLD_MAX_MS releases the hold by itself', async () => {
    const h = harness();
    await h.quickAsk.press();
    const [timer] = h.later();
    expect(timer?.ms).toBe(HOLD_MAX_MS);
    h.clock.now += HOLD_MAX_MS;
    timer?.run();
    expect(h.recognizer.stop).toHaveBeenCalledTimes(1);
    h.hear({ type: 'final', text: 'A long question' });
    expect(h.sends).toEqual([{ text: 'A long question', spokenMode: true }]);
  });

  it('a release cancels the HOLD_MAX_MS timer', async () => {
    const h = harness();
    await ask(h, ASKED);
    expect(h.later()).toEqual([]);
  });

  it('a recognizer that will not start is a recognizer error', async () => {
    const h = harness();
    h.recognizer.start.mockReturnValueOnce({ kind: 'failed' } as never);
    await h.quickAsk.press();
    expect(h.voice()).toMatchObject({ phase: 'error', errorKind: 'recognizer' });
    expect(h.later()).toEqual([]);
  });

  it('a press that throws ends the hold and logs it', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const h = harness({ permissionAnswer: () => Promise.reject(new Error('module gone')) });
    await h.quickAsk.press();
    expect(warn).toHaveBeenCalled();
    await h.quickAsk.press();
    expect(h.permissions.press).toHaveBeenCalledTimes(2);
  });
});

describe('what blocks a press', () => {
  it("a viewer's press asks nothing and opens nothing (D17)", async () => {
    const h = harness({ roleCanChat: false });
    await h.quickAsk.press();
    expect(h.permissions.press).not.toHaveBeenCalled();
    expect(h.recognizer.policy).not.toHaveBeenCalled();
    expect(h.recognizer.start).not.toHaveBeenCalled();
    expect(h.voice().phase).toBe('idle');
  });

  it('a first-time grant takes the hold: ready, the mic not opened', async () => {
    const h = harness({ permission: { step: 'granted', blocked: null, asked: true } });
    await h.quickAsk.press();
    expect(h.recognizer.start).not.toHaveBeenCalled();
    expect(h.voice()).toMatchObject({ phase: 'idle', message: 'ready' });
    expect(h.quickAsk.snapshot().permission).toMatchObject({ asked: true });
  });

  it('recognition off the phone is unavailable, and the recognizer never starts', async () => {
    const h = harness({ policy: { kind: 'unavailable', reason: 'no-on-device' } });
    await h.quickAsk.press();
    expect(h.recognizer.start).not.toHaveBeenCalled();
    expect(h.voice()).toMatchObject({ phase: 'error', errorKind: 'no-on-device' });
  });

  it('a language to download is offered; Download fetches it and reads the policy again', async () => {
    const h = harness({ policy: { kind: 'download', locale: 'en-GB' } });
    await h.quickAsk.press();
    expect(h.quickAsk.snapshot().policy).toEqual({ kind: 'download', locale: 'en-GB' });
    expect(h.voice().phase).toBe('idle');
    h.recognizer.policy.mockResolvedValueOnce(READY);
    await h.quickAsk.download();
    expect(h.recognizer.downloadModel).toHaveBeenCalledWith('en-GB');
    expect(h.quickAsk.snapshot().policy).toBe(READY);
  });
});

describe('barge-in and STOP', () => {
  async function speakingWhileStreaming() {
    const h = harness();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('You have two meetings. ')));
    h.quickAsk.onSpeaker({ type: 'speak_start' });
    h.log.length = 0;
    return h;
  }

  it('a press while Auto speaks stops the speech, cancels the streaming turn, then listens', async () => {
    const h = await speakingWhileStreaming();
    await h.quickAsk.press();
    expect(h.log).toEqual(['permissions.press', 'speaker.stop', 'thread.stop', 'recognizer.start']);
    expect(h.voice()).toMatchObject({ phase: 'listening', bargedIn: true });
  });

  it('a press once the turn finished stops the speech and cancels nothing', async () => {
    const h = harness();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('Two meetings.'), wire.finish), { type: 'finished' });
    h.quickAsk.onSpeaker({ type: 'speak_start' });
    h.log.length = 0;
    await h.quickAsk.press();
    expect(h.log).toEqual(['permissions.press', 'speaker.stop', 'recognizer.start']);
  });

  it('the cancelled turn is no longer spoken', async () => {
    const h = await speakingWhileStreaming();
    await h.quickAsk.press();
    h.speaker.speak.mockClear();
    h.feed(...frames(wire.text('More words. ')));
    expect(h.speaker.speak).not.toHaveBeenCalled();
  });

  it('STOP while listening aborts, and a late final sends nothing', async () => {
    const h = harness();
    await h.quickAsk.press();
    h.hear({ type: 'mic_open' });
    h.quickAsk.stop();
    expect(h.recognizer.abort).toHaveBeenCalledTimes(1);
    expect(h.voice()).toMatchObject({ phase: 'idle', micOpen: false });
    h.hear({ type: 'final', text: ASKED });
    expect(h.sends).toEqual([]);
  });

  it("STOP while quick-ask's turn streams stops the speech and cancels it through A2's Stop", async () => {
    const h = await speakingWhileStreaming();
    h.quickAsk.stop();
    expect(h.log).toEqual(['speaker.stop', 'thread.stop']);
    expect(h.recognizer.abort).not.toHaveBeenCalled();
    expect(h.voice().phase).toBe('idle');
  });

  it('STOP leaves a typed turn alone', async () => {
    const h = harness();
    h.typed('Typed on the TYPE sheet');
    h.feed(...frames(wire.text('Sure. ')));
    h.quickAsk.stop();
    expect(h.log).not.toContain('thread.stop');
  });
});

describe('only quick-ask turns are spoken, only while the screen is mounted (KV6)', () => {
  it('a typed turn on the same thread is never spoken', () => {
    const h = harness();
    h.typed('Typed on the TYPE sheet');
    h.feed(...frames(wire.text('Sure. Here it is. '), wire.finish), { type: 'finished' });
    expect(h.speaker.speak).not.toHaveBeenCalled();
    expect(h.voice()).toMatchObject({ phase: 'idle', reply: '' });
  });

  it('leaving the screen stops the mic and the speech; the turn runs on unspoken', async () => {
    const h = harness();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('One. ')));
    h.quickAsk.unmount();
    expect(h.speaker.stop).toHaveBeenCalled();
    h.speaker.speak.mockClear();
    h.feed(...frames(wire.text('Two. ')));
    expect(h.speaker.speak).not.toHaveBeenCalled();
    expect(h.log).not.toContain('thread.stop');
  });

  it('a press after the screen left opens nothing', async () => {
    const h = harness();
    h.quickAsk.unmount();
    await h.quickAsk.press();
    expect(h.permissions.press).not.toHaveBeenCalled();
  });

  it('the saved reply is spoken to its end when the turn retires in one step', async () => {
    const h = harness();
    await ask(h, ASKED);
    h.feed(...frames(wire.text('You have')));
    const reply = saved('m-3', 'assistant', 'You have two meetings.');
    h.feed(
      { type: 'refetched', messages: [...EARLIER, saved('m-2', 'user', ASKED), reply] },
      { type: 'finished' },
    );
    expect(h.thread().live).toBeNull();
    expect(h.speaker.speak).toHaveBeenLastCalledWith('You have two meetings.', {
      language: 'en-GB',
    });
  });
});
