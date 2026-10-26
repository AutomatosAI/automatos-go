// The listener handover (P001V-RVW-2, KV5, KV8): two screens' engines over one recognizer-core and
// one speaker-core (spy ports) and A2's real thread reducer, each attached as use-quick-ask.ts does.
// A second engine attaching (a conversation's HUD home pushed over the voice screen) covers the
// first: its hold aborted with nothing sent, its speech silenced, idle with the screen free to sleep.
// When the second detaches (popped), the first hears again with no new attach: a press opens the mic
// with MIC LIVE from the module's audiostart, the release sends through its own thread, and its
// reply's speak_done ends Auto's turn.

import { describe, expect, it, vi } from 'vitest';

import { COVERED } from '../interruptions/interruption-policy';
import { result } from './recognizer-port';
import { EARLIER, twoScreens, type Harness } from './quick-ask-harness';
import { frames, wire } from './thread-states';

// The native module, replaced: keep-awake.ts is the one file that imports expo-keep-awake.
vi.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: vi.fn(async () => undefined),
  deactivateKeepAwake: vi.fn(async () => undefined),
}));
const { keepAwakeFor } = await import('../interruptions/keep-awake');

const ASKED = "What's on today?";
const HEARD = "What's on";

type Screens = ReturnType<typeof twoScreens>;

/** The press, and the module's own start of the capture: start, audiostart, the first words. */
async function holdOn(screens: Screens, h: Harness, words: string): Promise<void> {
  await h.quickAsk.press();
  screens.module.emit('start');
  screens.module.emit('audiostart', { uri: null });
  screens.module.emit('result', result(words));
}

/** The release after 1.2 s, and the module's end of the hold: the final, audioend, end. */
function letGo(screens: Screens, h: Harness, words: string): void {
  h.clock.now += 1_200;
  h.quickAsk.release();
  screens.module.emit('result', result(words, true));
  screens.module.emit('audioend', { uri: null });
  screens.module.emit('end');
}

/** The second screen popped, as HUD's home goes on its blur: covered, then detached. */
function pop(h: Harness, detach: () => void): void {
  h.quickAsk.interrupt(COVERED);
  detach();
}

/** Every utterance queued so far starts and ends, as the phone's engine plays them. */
function playAll(screens: Screens, from = 0): void {
  for (let index = from; index < screens.speech.utterances.length; index += 1) {
    screens.speech.at(index).onStart();
    screens.speech.at(index).onDone();
  }
}

/** After the pop, the first screen asks again: MIC LIVE from audiostart, the words sent, spoken. */
async function asksAgain(screens: Screens): Promise<void> {
  const { first, second } = screens;
  const sentBefore = first.sends.length;
  await first.quickAsk.press();
  expect(first.voice()).toMatchObject({ phase: 'listening', micOpen: false });
  screens.module.emit('start');
  screens.module.emit('audiostart', { uri: null });
  expect(first.voice().micOpen).toBe(true);
  screens.module.emit('result', result(ASKED));
  letGo(screens, first, ASKED);
  expect(first.voice()).toMatchObject({ phase: 'thinking', micOpen: false, heard: ASKED });
  expect(first.sends.slice(sentBefore)).toEqual([{ text: ASKED, spokenMode: true }]);
  expect(second.sends).toEqual([]);
  // The hold is over: no HOLD_MAX_MS or RELEASE_SETTLE_MS timer is left to fire.
  expect(first.later()).toEqual([]);
  const queued = screens.speech.utterances.length;
  first.feed(...frames(wire.text('Two meetings.'), wire.finish), { type: 'finished' });
  playAll(screens, queued);
  expect(screens.speech.utterances.length).toBeGreaterThan(queued);
  expect(first.voice()).toMatchObject({ phase: 'idle', replyStreaming: false });
  expect(keepAwakeFor(first.voice())).toBe(false);
}

describe('a second engine attaching covers the first (P001V-RVW-2)', () => {
  it('mid-hold: the hold is aborted, nothing is sent, idle; after the pop the first asks again', async () => {
    const screens = twoScreens();
    const { first, second, module } = screens;
    await holdOn(screens, first, HEARD);
    expect(first.voice()).toMatchObject({ phase: 'listening', micOpen: true });
    const detachSecond = screens.attach(second);
    expect(first.recognizer.abort).toHaveBeenCalledTimes(1);
    expect(module.port.abort).toHaveBeenCalledTimes(1);
    expect(first.speaker.stop).toHaveBeenCalled();
    expect(first.voice()).toMatchObject({
      phase: 'idle',
      micOpen: false,
      heard: HEARD,
      message: 'interrupted',
    });
    expect(keepAwakeFor(first.voice())).toBe(false);
    expect(first.later()).toEqual([]);
    // The aborted session's own end reaches the screen on top and says nothing; a late release
    // on the covered screen sends nothing either.
    module.emit('audioend', { uri: null });
    module.emit('end');
    first.quickAsk.release();
    expect(first.sends).toEqual([]);
    expect(second.sends).toEqual([]);
    expect(second.voice()).toMatchObject({ phase: 'idle', micOpen: false });
    pop(second, detachSecond);
    await asksAgain(screens);
  });

  it('mid-reply: the speech is silenced and the rest never spoken, idle; after the pop the first asks again', async () => {
    const screens = twoScreens();
    const { first, second, speech } = screens;
    await holdOn(screens, first, ASKED);
    letGo(screens, first, ASKED);
    first.feed(...frames(wire.text('You have two meetings. One at ')));
    speech.at(0).onStart();
    expect(first.voice()).toMatchObject({ phase: 'speaking', replyStreaming: true });
    const spoken = speech.utterances.length;
    const detachSecond = screens.attach(second);
    expect(speech.port.stop).toHaveBeenCalled();
    expect(first.voice()).toMatchObject({ phase: 'idle', micOpen: false, message: 'interrupted' });
    expect(keepAwakeFor(first.voice())).toBe(false);
    // The turn runs on to the chat (never cancelled) and nothing more of it is spoken.
    expect(first.log).not.toContain('thread.stop');
    first.feed(...frames(wire.text('ten.'), wire.finish), { type: 'finished' });
    expect(speech.utterances.length).toBe(spoken);
    // A2's after-turn refetch: the thread may send again.
    first.feed({ type: 'settled', messages: EARLIER });
    // The cut utterance's late callback (iOS didCancel) belongs to a stopped run: nobody hears it.
    speech.at(0).onStopped();
    expect(first.voice()).toMatchObject({ phase: 'idle' });
    expect(second.voice()).toMatchObject({ phase: 'idle' });
    pop(second, detachSecond);
    await asksAgain(screens);
  });

  it('while covered, the second screen holds and is spoken to; the first hears none of it', async () => {
    const screens = twoScreens();
    const { first, second, speech } = screens;
    await holdOn(screens, first, HEARD);
    screens.attach(second);
    const firstVoice = first.voice();
    await holdOn(screens, second, ASKED);
    expect(second.voice()).toMatchObject({ phase: 'listening', micOpen: true });
    letGo(screens, second, ASKED);
    expect(second.sends).toEqual([{ text: ASKED, spokenMode: true }]);
    second.feed(...frames(wire.text('Two meetings.'), wire.finish), { type: 'finished' });
    playAll(screens);
    expect(speech.utterances.length).toBeGreaterThan(0);
    expect(second.voice()).toMatchObject({ phase: 'idle', replyStreaming: false });
    expect(first.voice()).toBe(firstVoice);
    expect(first.sends).toEqual([]);
  });

  it("the first screen's own detach under the second leaves the second listening", async () => {
    const screens = twoScreens();
    const { first, second } = screens;
    await holdOn(screens, first, HEARD);
    screens.attach(second);
    screens.detachFirst();
    await holdOn(screens, second, ASKED);
    expect(second.voice()).toMatchObject({ phase: 'listening', micOpen: true });
    letGo(screens, second, ASKED);
    expect(second.sends).toEqual([{ text: ASKED, spokenMode: true }]);
    expect(first.sends).toEqual([]);
  });
});
