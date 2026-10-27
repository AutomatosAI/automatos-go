// Quick-ask with Auto's server voice, wired as use-quick-ask.ts wires it: the engine over the one
// voice out (reply-voice.ts over the real server speaker on fake ports and the phone's speaker on a
// spy expo-speech port), given the speech the hook builds (speakOptionsFor with serverSpeechFor).
// With tts the AI notice and the reply go to the server; without it, or with the phone's voice
// chosen, to the phone exactly as before; a refusal speaks the rest of the turn on the phone and
// the next turn tries the server again; STOP and leaving the screen stop the player and cancel
// every request. Then, read from source: the hook builds its speech that way and speaks only
// through the voice out.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GateInput } from '../../api/capabilities';
import { logger } from '../../lib/logger';
import { SERVER_VOICE_WAIT_MS } from '../config';
import { createServerSpeaker } from '../server/server-speaker';
import { VOICES_LOADING, serverSpeechFor } from '../server/server-voices';
import { SpeechFailure } from '../server/voice-api';
import {
  DEFAULT_VOICE_SETTING,
  speakOptionsFor,
  type VoiceSetting,
} from '../settings/voice-setting';
import { createReplyVoice } from '../speech/reply-voice';
import { createSpeaker } from '../speech/speaker-core';
import { AI_VOICE_GREETING } from '../strings';
import { EARLIER, ask, harness } from './quick-ask-harness';
import { fakeServerPorts, settle } from './server-ports';
import { spySpeechPort } from './speech-port';
import { frames, wire } from './thread-states';

const TTS: GateInput = { capabilities: ['spoken_mode', 'tts'], push: { expo: true } };
const NO_TTS: GateInput = { capabilities: ['spoken_mode'], push: { expo: true } };
const CLIENT = { binary: vi.fn() };

/** Quick-ask over the one voice out, its speech built as the hook builds it. */
function quickAskOver(discovery: GateInput, setting: VoiceSetting = DEFAULT_VOICE_SETTING) {
  const server = fakeServerPorts();
  const phone = spySpeechPort();
  const voiceOut = createReplyVoice({
    phone: createSpeaker(phone.port, 'ios'),
    server: (emit) => createServerSpeaker(server.ports, emit),
  });
  const serverSpeech = serverSpeechFor({
    discovery,
    setting,
    voices: VOICES_LOADING,
    client: CLIENT,
  });
  const speech = speakOptionsFor('en-GB', 'Daniel', setting, serverSpeech);
  const h = harness({ voiceOut, speech });
  voiceOut.listen(h.quickAsk.onSpeaker);
  const asked = () => server.requests.map((request) => request.text);
  const said = () => phone.utterances.map(({ text }) => text);
  return { h, server, phone, voiceOut, asked, said };
}

/** The server's file for request `index` plays to its end. */
async function playThrough(over: ReturnType<typeof quickAskOver>, index: number): Promise<void> {
  over.server.requests[index]?.answer();
  await settle();
  const player = over.server.playerOf(index);
  player.handlers.onPlaying(1);
  player.handlers.onEnded();
  await settle();
}

beforeEach(() => {
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('quick-ask with tts speaks through the server voice', () => {
  it('the AI notice first, then the reply, each its own request, at the saved voice and speed', async () => {
    const setting = { ...DEFAULT_VOICE_SETTING, serverVoice: 'bm_george', rate: 1.1 };
    const over = quickAskOver(TTS, setting);
    await ask(over.h, 'Anything today?');
    over.h.feed(...frames(wire.text('Two meetings. One at ')));
    expect(over.asked()).toEqual([AI_VOICE_GREETING]);
    expect(over.server.requests[0]?.server).toMatchObject({ voice: 'bm_george', speed: 1.1 });
    expect(over.said()).toEqual([]);
    over.server.requests[0]?.answer();
    await settle();
    over.server.playerOf(0).handlers.onPlaying(2);
    expect(over.h.voice().phase).toBe('speaking');
    // Prefetch: the reply's first sentence is asked for while the notice plays.
    expect(over.asked()).toEqual([AI_VOICE_GREETING, 'Two meetings.']);
  });

  it('ends Auto’s turn when the last sentence has played', async () => {
    const over = quickAskOver(TTS);
    await ask(over.h, 'Anything today?');
    over.h.feed(...frames(wire.text('Two meetings.'), wire.finish), { type: 'finished' });
    await playThrough(over, 0);
    expect(over.server.session).toEqual(['prepare']);
    await playThrough(over, 1);
    expect(over.h.voice().phase).toBe('idle');
    expect(over.said()).toEqual([]);
    expect(over.server.session).toEqual(['prepare', 'release']);
  });
});

describe('without tts, or with the phone’s voice chosen', () => {
  it.each([
    ['no tts', NO_TTS, DEFAULT_VOICE_SETTING],
    ['the phone’s voice chosen', TTS, { ...DEFAULT_VOICE_SETTING, source: 'phone' as const }],
  ])('%s: the phone speaks exactly as before', async (_name, discovery, setting) => {
    const over = quickAskOver(discovery, setting);
    await ask(over.h, 'Anything today?');
    over.h.feed(...frames(wire.text('Two meetings. One at ')));
    expect(over.said()).toEqual([AI_VOICE_GREETING, 'Two meetings.']);
    expect(over.phone.at(0)).toMatchObject({ language: 'en-GB', voice: 'Daniel' });
    expect(over.asked()).toEqual([]);
  });
});

describe('a server failure', () => {
  it('speaks that sentence and the rest of the turn on the phone; the next turn tries again', async () => {
    const over = quickAskOver(TTS);
    await ask(over.h, 'Anything today?');
    over.h.feed(...frames(wire.text('Two meetings. One at ')));
    over.server.requests[0]?.refuse(new SpeechFailure('tts_busy'));
    await settle();
    expect(over.said()).toEqual([AI_VOICE_GREETING, 'Two meetings.']);
    expect(over.server.session).toEqual(['prepare', 'release']);
    over.h.feed(...frames(wire.text('ten.'), wire.finish), { type: 'finished' });
    expect(over.said()).toEqual([AI_VOICE_GREETING, 'Two meetings.', 'One at ten.']);
    expect(over.asked()).toEqual([AI_VOICE_GREETING]);
    [0, 1, 2].forEach((index) => over.phone.at(index).onDone());
    expect(over.h.voice().phase).toBe('idle');
    over.h.feed({ type: 'settled', messages: EARLIER });
    await ask(over.h, 'And tomorrow?');
    over.h.feed(...frames(wire.text('Nothing yet. More ')));
    expect(over.asked()).toEqual([AI_VOICE_GREETING, 'Nothing yet.']);
    expect(over.said()).toHaveLength(3);
  });

  it('never leaves Auto silent: a request that takes too long is spoken on the phone', async () => {
    const over = quickAskOver(TTS);
    await ask(over.h, 'Anything today?');
    over.h.feed(...frames(wire.text('Two meetings. One at ')));
    over.server.fire(SERVER_VOICE_WAIT_MS);
    expect(over.said()).toEqual([AI_VOICE_GREETING, 'Two meetings.']);
    expect(over.server.requests[0]?.signal.aborted).toBe(true);
  });
});

describe('STOP and leaving the screen', () => {
  async function playing() {
    const over = quickAskOver(TTS);
    await ask(over.h, 'Anything today?');
    over.h.feed(...frames(wire.text('Two meetings. One at ')));
    over.server.requests[0]?.answer();
    await settle();
    over.server.playerOf(0).handlers.onPlaying(2);
    return over;
  }

  it('STOP stops the player, cancels the request fetched ahead and releases the session', async () => {
    const over = await playing();
    over.h.quickAsk.stop();
    await settle();
    expect(over.server.session).toEqual(['prepare', 'release']);
    expect(over.server.playerOf(0).stopped).toBe(true);
    expect(over.server.requests[1]?.signal.aborted).toBe(true);
    expect(over.server.removed).toEqual(['file:///cache/server-voice/1.mp3']);
    expect(over.h.voice().phase).toBe('idle');
    expect(over.said()).toEqual([]);
  });

  it('going to the background stops it the same way (the interruption policy)', async () => {
    const over = await playing();
    over.h.quickAsk.interrupt({ type: 'app', status: 'background' });
    expect(over.server.playerOf(0).stopped).toBe(true);
    expect(over.server.inFlight()).toEqual([]);
    await settle();
    expect(over.server.session).toEqual(['prepare', 'release']);
  });

  it('leaving the screen stops it and releases the session', async () => {
    const over = await playing();
    over.h.quickAsk.unmount();
    expect(over.server.playerOf(0).stopped).toBe(true);
    await settle();
    expect(over.server.session).toEqual(['prepare', 'release']);
  });

  it('pressing to talk (barge-in) stops it before the mic opens, leaving the session to the mic', async () => {
    const over = await playing();
    over.h.log.length = 0;
    await over.h.quickAsk.press();
    expect(over.server.playerOf(0).stopped).toBe(true);
    expect(over.server.inFlight()).toEqual([]);
    expect(over.h.log.indexOf('speaker.handOver')).toBeGreaterThan(-1);
    expect(over.h.log.indexOf('speaker.handOver')).toBeLessThan(
      over.h.log.indexOf('recognizer.start'),
    );
    await settle();
    expect(over.server.session).toEqual(['prepare']);
  });
});

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(path.resolve(ROOT, file), 'utf8');
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the hooks (source)', () => {
  it('quick-ask speaks only through the voice out, with the server voice when offered', () => {
    const hook = code(read('src/voice/quick-ask/use-quick-ask.ts'));
    expect(hook).toMatch(/import \{ voiceOut \} from '\.\.\/speech\/voice-out';/);
    expect(hook).not.toMatch(/from '\.\.\/speech\/speaker'/);
    expect(hook).toMatch(/speaker: voiceOut,/);
    expect(hook).toMatch(/const voices = useServerVoices\(\);/);
  });

  it('only audio-player.ts imports expo-audio', () => {
    const files = [
      'src/voice/server/server-speaker.ts',
      'src/voice/server/server-voice.ts',
      'src/voice/speech/reply-voice.ts',
      'src/voice/speech/voice-out.ts',
      'src/voice/quick-ask/use-quick-ask.ts',
    ];
    for (const file of files) expect(read(file), file).not.toMatch(/from 'expo-audio'/);
    expect(read('src/voice/server/audio-player.ts')).toMatch(/from 'expo-audio'/);
  });
});
