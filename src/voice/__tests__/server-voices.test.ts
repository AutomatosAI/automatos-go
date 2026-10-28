// Which server voice quick-ask asks for: the server's list read once per server and kept (a failed
// read tried again, fresh on request); the saved voice while the list offers it, else the server's
// default; and Auto's server voice only when the server lists tts and the person keeps it. A screen
// watching the list reads it again while it fails, so Portuguese (Brazil), which needs the list to
// name its voice, is not left on the phone's voice by one failed read (28 Oct 2026).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GateInput } from '../../api/capabilities';
import { logger } from '../../lib/logger';
import { SERVER_VOICES_RETRY_MS } from '../config';
import { spokenLanguage } from '../language/language-voice';
import {
  VOICES_LOADING,
  VOICES_OFF,
  VOICES_UNAVAILABLE,
  createVoicesCache,
  resolveServerVoice,
  serverSpeechFor,
  voicesReady,
  watchServerVoices,
  type ServerVoicesState,
  type VoicesClient,
} from '../server/server-voices';
import type { ServerVoiceList } from '../server/voice-api';
import { DEFAULT_VOICE_SETTING } from '../settings/voice-setting';

const LIST: ServerVoiceList = {
  defaultId: 'af_heart',
  voices: [
    { id: 'af_heart', name: 'Heart', accent: 'en-US', gender: 'female' },
    { id: 'bm_george', name: 'George', accent: 'en-GB', gender: 'male' },
  ],
};

const clientAt = (apiUrl: string): VoicesClient =>
  ({ server: { apiUrl, webUrl: '', source: 'hosted' }, request: vi.fn() }) as VoicesClient;

const TTS: GateInput = { capabilities: ['tts'], push: { expo: false } };
const NO_TTS: GateInput = { capabilities: ['spoken_mode'], push: { expo: false } };
const CLIENT = { binary: vi.fn() };

beforeEach(() => {
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the voices cache', () => {
  it('reads each server once and keeps it', async () => {
    const load = vi.fn(async () => LIST);
    const cache = createVoicesCache(load);
    const a = clientAt('https://a.test');
    expect(await cache.get(a)).toBe(LIST);
    expect(await cache.get(a)).toBe(LIST);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.get(clientAt('https://b.test'));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reads again when asked fresh', async () => {
    const load = vi.fn(async () => LIST);
    const cache = createVoicesCache(load);
    const a = clientAt('https://a.test');
    await cache.get(a);
    await cache.get(a, true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('answers null for a failed read, logged, and tries again next time', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('503')).mockResolvedValue(LIST);
    const cache = createVoicesCache(load);
    const a = clientAt('https://a.test');
    expect(await cache.get(a)).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(await cache.get(a)).toBe(LIST);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('resolveServerVoice', () => {
  it('keeps the saved voice while the list offers it', () => {
    expect(resolveServerVoice('bm_george', voicesReady(LIST))).toBe('bm_george');
  });

  it("asks for the server's default when the saved voice is gone from the list", () => {
    expect(resolveServerVoice('am_gone', voicesReady(LIST))).toBeNull();
  });

  it('keeps the saved voice while the list is not known', () => {
    expect(resolveServerVoice('bm_george', VOICES_LOADING)).toBe('bm_george');
    expect(resolveServerVoice('bm_george', VOICES_UNAVAILABLE)).toBe('bm_george');
    expect(resolveServerVoice(null, voicesReady(LIST))).toBeNull();
  });
});

describe('serverSpeechFor', () => {
  it('gives the server voice when the server lists tts and Auto’s voice is kept', () => {
    const setting = { ...DEFAULT_VOICE_SETTING, serverVoice: 'bm_george', rate: 0.9 };
    expect(
      serverSpeechFor({ discovery: TTS, setting, voices: voicesReady(LIST), client: CLIENT }),
    ).toEqual({ voice: 'bm_george', speed: 0.9, client: CLIENT });
  });

  it("asks for the server's default with nothing saved", () => {
    const speech = serverSpeechFor({
      discovery: TTS,
      setting: DEFAULT_VOICE_SETTING,
      voices: VOICES_LOADING,
      client: CLIENT,
    });
    expect(speech).toMatchObject({ voice: null, speed: 1 });
  });

  it("gives none without tts (or before discovery), or with this phone's voice chosen", () => {
    const base = { setting: DEFAULT_VOICE_SETTING, voices: VOICES_OFF, client: CLIENT };
    expect(serverSpeechFor({ ...base, discovery: NO_TTS })).toBeUndefined();
    expect(serverSpeechFor({ ...base, discovery: null })).toBeUndefined();
    const phone = { ...DEFAULT_VOICE_SETTING, source: 'phone' as const };
    expect(serverSpeechFor({ ...base, discovery: TTS, setting: phone })).toBeUndefined();
  });
});

const WITH_PORTUGUESE: ServerVoiceList = {
  ...LIST,
  voices: [...LIST.voices, { id: 'pf_dora', name: 'Dora', accent: 'pt-BR', gender: 'female' }],
};

type Pending = { readonly run: () => void; readonly ms: number; cancelled: boolean };

/** A watch over a loader, its timers held by the test; `states` is what the screen heard. */
function watching(load: () => Promise<ServerVoiceList>) {
  const timers: Pending[] = [];
  const states: ServerVoicesState[] = [];
  const stop = watchServerVoices({
    cache: createVoicesCache(load),
    client: clientAt('https://a.test'),
    fresh: false,
    onState: (state) => states.push(state),
    later: (run, ms) => {
      const timer: Pending = { run, ms, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { timers, states, stop, settle };
}

/** What quick-ask hands the server for "I speak" Portuguese (Brazil) with this list state. */
function portugueseServer(voices: ServerVoicesState) {
  const saved = { ...DEFAULT_VOICE_SETTING, language: 'pt-BR' } as const;
  const spoken = spokenLanguage(saved, 'en-GB', voices);
  return serverSpeechFor({ ...spoken, discovery: TTS, client: CLIENT });
}

describe('a screen watching the list', () => {
  it('a failed read is read again until it loads: Portuguese then speaks with the server', async () => {
    const load = vi
      .fn<() => Promise<ServerVoiceList>>()
      .mockRejectedValueOnce(new Error('503 tts_unavailable'))
      .mockResolvedValue(WITH_PORTUGUESE);
    const w = watching(load);
    await w.settle();
    expect(w.states).toEqual([VOICES_UNAVAILABLE]);
    // Before the list loads, Portuguese (Brazil) can only speak with the phone's voice.
    expect(portugueseServer(w.states[0] ?? VOICES_LOADING)).toBeUndefined();
    expect(w.timers.map((timer) => timer.ms)).toEqual([SERVER_VOICES_RETRY_MS]);
    w.timers[0]?.run();
    await w.settle();
    expect(load).toHaveBeenCalledTimes(2);
    expect(w.states.at(-1)).toEqual(voicesReady(WITH_PORTUGUESE));
    expect(portugueseServer(w.states.at(-1) ?? VOICES_LOADING)?.voice).toBe('pf_dora');
    expect(w.timers).toHaveLength(1);
  });

  it('a list that loads is not read again', async () => {
    const load = vi.fn(async () => WITH_PORTUGUESE);
    const w = watching(load);
    await w.settle();
    expect(w.states).toEqual([voicesReady(WITH_PORTUGUESE)]);
    expect(w.timers).toEqual([]);
  });

  it('stopping the watch cancels the retry and hears nothing more', async () => {
    const load = vi.fn(async (): Promise<ServerVoiceList> => {
      throw new Error('network');
    });
    const w = watching(load);
    await w.settle();
    w.stop();
    expect(w.timers[0]?.cancelled).toBe(true);
    const late = watching(load);
    late.stop();
    await late.settle();
    expect(late.states).toEqual([]);
  });
});
