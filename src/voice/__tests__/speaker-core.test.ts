import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { SPEECH_RATE } from '../config';
import {
  createSpeaker,
  fitToEngine,
  type SpeakerEvent,
  type SpeakRequest,
  type SpeechPort,
} from '../speech/speaker-core';

/** A spy SpeechPort: every utterance held with its request, so a test plays the engine's callbacks. */
function spyPort(overrides: Partial<SpeechPort> = {}) {
  const utterances: { text: string; request: SpeakRequest }[] = [];
  const port = {
    speak: vi.fn((text: string, request: SpeakRequest) => {
      utterances.push({ text, request });
    }),
    stop: vi.fn(async () => undefined),
    getVoices: vi.fn(async (): Promise<unknown> => []),
    maxInputLength: Number.MAX_VALUE,
    ...overrides,
  };
  return { port, utterances };
}

function speaking(overrides: Partial<SpeechPort> = {}, platform: 'ios' | 'android' = 'ios') {
  const spy = spyPort(overrides);
  const speaker = createSpeaker(spy.port, platform);
  const heard: SpeakerEvent['type'][] = [];
  const unlisten = speaker.listen((event) => heard.push(event.type));
  const at = (index: number): SpeakRequest => {
    const utterance = spy.utterances[index];
    if (!utterance) throw new Error(`no utterance ${index}`);
    return utterance.request;
  };
  return { ...spy, speaker, heard, unlisten, at };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('speaker.speak', () => {
  it("queues each sentence in the phone's language and voice, at the set rate, in the system's audio session", () => {
    const { speaker, port, utterances, at } = speaking();
    speaker.speak('  Hello there.  ', {
      language: 'en-GB',
      voice: 'com.apple.voice.enhanced.en-GB.Daniel',
    });
    speaker.speak('Second.', { language: 'en-GB' });
    expect(port.speak).toHaveBeenCalledTimes(2);
    expect(utterances.map((utterance) => utterance.text)).toEqual(['Hello there.', 'Second.']);
    expect(at(0)).toMatchObject({
      language: 'en-GB',
      voice: 'com.apple.voice.enhanced.en-GB.Daniel',
      rate: SPEECH_RATE,
      useApplicationAudioSession: false,
    });
    expect(at(1)).not.toHaveProperty('voice');
  });

  it('says nothing for a blank sentence', () => {
    const { speaker, port, heard } = speaking();
    speaker.speak('   ', { language: 'en-GB' });
    expect(port.speak).not.toHaveBeenCalled();
    expect(heard).toEqual([]);
  });

  it('splits a sentence longer than the engine takes at a space', () => {
    const { speaker, utterances } = speaking({ maxInputLength: 12 });
    speaker.speak('one two three four five', { language: 'en-US' });
    expect(utterances.map((utterance) => utterance.text)).toEqual([
      'one two',
      'three four',
      'five',
    ]);
  });
});

describe('the callbacks, folded', () => {
  it('says speak_start at the first utterance and speak_done after the last one', () => {
    const { speaker, heard, at } = speaking();
    speaker.speak('One.', { language: 'en-GB' });
    speaker.speak('Two.', { language: 'en-GB' });
    at(0).onStart();
    expect(heard).toEqual(['speak_start']);
    at(0).onDone();
    at(1).onStart();
    expect(heard).toEqual(['speak_start']);
    at(1).onDone();
    expect(heard).toEqual(['speak_start', 'speak_done']);
  });

  it('starts a new run when a sentence comes after the queue ran out', () => {
    const { speaker, heard, at } = speaking();
    speaker.speak('One.', { language: 'en-GB' });
    at(0).onStart();
    at(0).onDone();
    speaker.speak('Two.', { language: 'en-GB' });
    at(1).onStart();
    at(1).onDone();
    expect(heard).toEqual(['speak_start', 'speak_done', 'speak_start', 'speak_done']);
  });

  it('counts a failed or system-stopped utterance as ended', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { speaker, heard, at } = speaking();
    speaker.speak('One.', { language: 'en-GB' });
    speaker.speak('Two.', { language: 'en-GB' });
    at(0).onError(new Error(''));
    at(1).onStopped();
    expect(heard).toEqual(['speak_done']);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('ignores callbacks after the run ended', () => {
    const { speaker, heard, at } = speaking();
    speaker.speak('One.', { language: 'en-GB' });
    at(0).onDone();
    at(0).onDone();
    at(0).onStart();
    expect(heard).toEqual(['speak_done']);
  });

  it('counts an utterance the engine refused to queue as ended', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { speaker, heard } = speaking({
      speak: () => {
        throw new Error('too long');
      },
    });
    speaker.speak('One.', { language: 'en-GB' });
    expect(heard).toEqual(['speak_done']);
    expect(warn).toHaveBeenCalledWith('[voice] an utterance was not queued', expect.any(Error));
  });
});

describe('speaker.stop', () => {
  it('stops the engine and says stopped once; the old run calls back no more', () => {
    const { speaker, port, heard, at } = speaking();
    speaker.speak('One.', { language: 'en-GB' });
    speaker.speak('Two.', { language: 'en-GB' });
    at(0).onStart();
    speaker.stop();
    expect(port.stop).toHaveBeenCalledTimes(1);
    at(0).onStopped();
    at(1).onStopped();
    at(1).onDone();
    expect(heard).toEqual(['speak_start', 'stopped']);
    speaker.speak('Three.', { language: 'en-GB' });
    at(2).onStart();
    at(2).onDone();
    expect(heard).toEqual(['speak_start', 'stopped', 'speak_start', 'speak_done']);
  });

  it('stops the engine but says nothing when nothing was queued', () => {
    const { speaker, port, heard } = speaking();
    speaker.stop();
    expect(port.stop).toHaveBeenCalledTimes(1);
    expect(heard).toEqual([]);
  });

  it('logs an engine that fails to stop', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { speaker } = speaking({ stop: async () => Promise.reject(new Error('busy')) });
    speaker.stop();
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
  });
});

describe('speaker.listen', () => {
  it('has one listener at a time', () => {
    const { speaker, heard, at, unlisten } = speaking();
    const second: string[] = [];
    const unlistenSecond = speaker.listen((event) => second.push(event.type));
    unlisten();
    speaker.speak('One.', { language: 'en-GB' });
    at(0).onDone();
    expect(heard).toEqual([]);
    expect(second).toEqual(['speak_done']);
    unlistenSecond();
    speaker.speak('Two.', { language: 'en-GB' });
    at(1).onDone();
    expect(second).toEqual(['speak_done']);
  });
});

describe('speaker.voices and voiceFor', () => {
  const VOICES = [
    {
      identifier: 'en-gb-x-gbb-local',
      name: 'en-gb-x-gbb-local',
      quality: 'Default',
      language: 'en-GB',
    },
    {
      identifier: 'en-gb-x-gbb-network',
      name: 'en-gb-x-gbb-network',
      quality: 'Enhanced',
      language: 'en-GB',
    },
    { identifier: null, name: 'broken', quality: 'Default', language: 'en-GB' },
  ];

  it("reads the phone's voices once per launch, dropping any that does not parse", async () => {
    const { speaker, port } = speaking({ getVoices: vi.fn(async () => VOICES) }, 'android');
    expect(await speaker.voices()).toHaveLength(2);
    expect(await speaker.voiceFor('en-GB')).toBe('en-gb-x-gbb-local');
    expect(port.getVoices).toHaveBeenCalledTimes(1);
  });

  it('treats a list that is not a list as no voices', async () => {
    const { speaker } = speaking({ getVoices: async () => ({ voices: VOICES }) });
    expect(await speaker.voices()).toEqual([]);
    expect(await speaker.voiceFor('en-GB')).toBeUndefined();
  });

  it('tries a failed read again next time', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const getVoices = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('not ready'))
      .mockResolvedValue(VOICES);
    const { speaker } = speaking({ getVoices }, 'android');
    expect(await speaker.voices()).toEqual([]);
    expect(await speaker.voices()).toHaveLength(2);
    expect(getVoices).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('fitToEngine', () => {
  it('keeps text the engine takes whole', () => {
    expect(fitToEngine(' Hello. ', Number.MAX_VALUE)).toEqual(['Hello.']);
    expect(fitToEngine('Hello.', Number.NaN)).toEqual(['Hello.']);
    expect(fitToEngine('  ', 10)).toEqual([]);
  });

  it('cuts a word longer than the limit where it must', () => {
    expect(fitToEngine('abcdefghij klm', 4)).toEqual(['abcd', 'efgh', 'ij', 'klm']);
  });
});
