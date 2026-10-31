// Listen on the brief (US-G03, §6.4 'Spoken'): it reads the brief's spoken words (else Auto's Read)
// in Auto's server voice, the phone's voice taking over when the server refuses; a second press
// stops it; a card going away stops only its own reading; another engine taking the voice stops it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { SERVER_SPEECH } from '../../voice/__tests__/server-ports';
import { spySpeechPort } from '../../voice/__tests__/speech-port';
import type { ServerSpeakerEvent, ServerSpeech } from '../../voice/server/server-speaker-ports';
import { DEFAULT_VOICE_SETTING } from '../../voice/settings/voice-setting';
import { createReplyVoice } from '../../voice/speech/reply-voice';
import { createSpeaker, type SpeakerEvent } from '../../voice/speech/speaker-core';
import {
  BRIEF_PIECE_CHARS,
  briefSentences,
  briefSpokenText,
  createBriefReader,
  type BriefSpeech,
} from '../listen';

const SPOKEN = 'Morning, Sam. 1. Send the launch email. 2. Lisbon flights.';
const WITH_SERVER: BriefSpeech = Object.freeze({
  language: 'en-GB',
  setting: DEFAULT_VOICE_SETTING,
  server: SERVER_SPEECH,
});
const PHONE_ONLY: BriefSpeech = Object.freeze({
  language: 'en-GB',
  setting: DEFAULT_VOICE_SETTING,
});

/** The real reply voice over a spy phone speaker and a stand-in server voice. */
function voiceOver() {
  const speech = spySpeechPort();
  const phone = createSpeaker(speech.port, 'ios');
  const served: { text: string; server: ServerSpeech }[] = [];
  let emit: (event: ServerSpeakerEvent) => void = () => undefined;
  const serverStop = vi.fn();
  const voice = createReplyVoice({
    phone,
    server: (handler) => {
      emit = handler;
      return {
        speak: (text, server) => void served.push({ text, server }),
        stop: serverStop,
        handOver: vi.fn(),
        busy: () => served.length > 0,
      };
    },
  });
  const said = () => speech.utterances.map(({ text }) => text);
  return {
    speech,
    voice,
    served,
    said,
    serverStop,
    emit: (event: ServerSpeakerEvent) => emit(event),
  };
}

/** Lets the reader's voice pick (a promise) settle. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('what Listen reads', () => {
  it("reads the brief's spoken words: the greeting and the numbered titles, never a why", () => {
    expect(briefSpokenText({ spoken: `  ${SPOKEN} `, prose: 'Auto’s **Read**.' })).toBe(SPOKEN);
  });

  it("reads Auto's Read as a voice can say it when the server sent no spoken words", () => {
    expect(briefSpokenText({ spoken: null, prose: 'Two things **need** you.' })).toBe(
      'Two things need you.',
    );
    expect(briefSpokenText({ spoken: '  ', prose: '' })).toBe('');
  });

  it('queues whole sentences, short ones together, never one cut in two', () => {
    expect(briefSentences(SPOKEN)).toEqual([SPOKEN]);
    const long = `${'word '.repeat(30).trim()}.`;
    const pieces = briefSentences(`${long} ${long} Short one.`);
    expect(pieces).toEqual([long, `${long} Short one.`]);
    expect(pieces.every((piece) => piece.length <= BRIEF_PIECE_CHARS)).toBe(true);
  });
});

describe('the reader', () => {
  it("speaks through Auto's server voice when the speech carries it", async () => {
    const h = voiceOver();
    const reader = createBriefReader(h.voice);
    await reader.read('Morning, Sam. One thing needs you.', WITH_SERVER);
    expect(reader.reading()).toBe(true);
    expect(h.served.map(({ text }) => text)).toEqual(['Morning, Sam. One thing needs you.']);
    expect(h.served[0]?.server).toBe(SERVER_SPEECH);
    expect(h.said()).toEqual([]);
  });

  it("falls back to the phone's voice on a refusal code, for the rest of the reading", async () => {
    const h = voiceOver();
    const reader = createBriefReader(h.voice);
    // over a piece's limit, so the two sentences go as two pieces
    const long = `${'word '.repeat(45).trim()}.`;
    await reader.read(`${long} One thing needs you.`, WITH_SERVER);
    expect(h.served.map(({ text }) => text)).toEqual([long, 'One thing needs you.']);
    h.emit({ type: 'failed', kind: 'tts_off', rest: [long, 'One thing needs you.'] });
    expect(h.said()).toEqual([long, 'One thing needs you.']);
    expect(reader.reading()).toBe(true);
    h.speech.at(0).onStart();
    h.speech.at(0).onDone();
    h.speech.at(1).onStart();
    h.speech.at(1).onDone();
    expect(reader.reading()).toBe(false);
  });

  it("speaks in the phone's voice when the server lists no tts", async () => {
    const h = voiceOver();
    const reader = createBriefReader(h.voice);
    await reader.read('Morning, Sam.', PHONE_ONLY);
    expect(h.said()).toEqual(['Morning, Sam.']);
    expect(h.served).toEqual([]);
  });

  it('is back to Listen once the last sentence ended, and tells its subscribers', async () => {
    const h = voiceOver();
    const reader = createBriefReader(h.voice);
    const told = vi.fn();
    reader.subscribe(told);
    await reader.read('Morning, Sam.', WITH_SERVER);
    h.emit({ type: 'speak_start' });
    expect(reader.reading()).toBe(true);
    h.emit({ type: 'speak_done' });
    expect(reader.reading()).toBe(false);
    expect(told).toHaveBeenCalledTimes(2);
  });

  it('stops on a second press: the voice silenced, its listener given back', async () => {
    const h = voiceOver();
    const below: SpeakerEvent[] = [];
    h.voice.listen((event) => below.push(event));
    const reader = createBriefReader(h.voice);
    await reader.read('Morning, Sam.', WITH_SERVER);
    h.serverStop.mockClear();
    reader.stop();
    expect(reader.reading()).toBe(false);
    expect(h.serverStop).toHaveBeenCalledTimes(1);
    // the screen's own listener hears again, and nothing of the stopped reading reaches it
    expect(below).toEqual([]);
    h.voice.speak('Later.', { language: 'en-GB' });
    h.speech.at(0).onStart();
    expect(below.map((event) => event.type)).toEqual(['speak_start']);
  });

  it("never stops anyone else's speech when it is not reading (a card going away)", () => {
    const h = voiceOver();
    const reader = createBriefReader(h.voice);
    reader.stop();
    expect(h.serverStop).not.toHaveBeenCalled();
    expect(h.speech.port.stop).not.toHaveBeenCalled();
  });

  it('stops when another engine takes the voice (the voice screen opening)', async () => {
    const h = voiceOver();
    const reader = createBriefReader(h.voice);
    await reader.read('Morning, Sam.', WITH_SERVER);
    const taker: SpeakerEvent[] = [];
    h.voice.listen((event) => taker.push(event));
    expect(reader.reading()).toBe(false);
    expect(h.serverStop).toHaveBeenCalled();
    // the reading's own stop reached the reading, never the engine that took over
    expect(taker).toEqual([]);
  });

  it('speaks nothing when stopped while its voice was still being picked', async () => {
    const h = voiceOver();
    const reader = createBriefReader(h.voice);
    const reading = reader.read('Morning, Sam.', PHONE_ONLY);
    reader.stop();
    await reading;
    await settled();
    expect(h.said()).toEqual([]);
    expect(reader.reading()).toBe(false);
  });

  it('reads nothing when there is nothing to say', async () => {
    const h = voiceOver();
    const reader = createBriefReader(h.voice);
    await reader.read('   ', WITH_SERVER);
    expect(reader.reading()).toBe(false);
    expect(h.served).toEqual([]);
  });
});
