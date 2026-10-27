// Which server voice quick-ask asks for: the server's list read once per server and kept (a failed
// read tried again, fresh on request); the saved voice while the list offers it, else the server's
// default; and Auto's server voice only when the server lists tts and the person keeps it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GateInput } from '../../api/capabilities';
import { logger } from '../../lib/logger';
import {
  VOICES_LOADING,
  VOICES_OFF,
  VOICES_UNAVAILABLE,
  createVoicesCache,
  resolveServerVoice,
  serverSpeechFor,
  voicesReady,
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
