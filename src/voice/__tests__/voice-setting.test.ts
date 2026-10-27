// Auto's voice setting on the phone's store (Settings → Voice): the default with nothing stored
// (Auto's server voice when offered, else Automatic, at the voice's own speed and pitch), a round
// trip through the store, a value saved before the server voice read with its new fields'
// defaults, anything unreadable read as the default, a speed or pitch outside its slider brought
// inside it in whole steps, and a store that fails logged without losing the choice for this launch.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { SPEECH_PITCH, SPEECH_PITCH_LIMITS, SPEECH_RATE, SPEECH_RATE_LIMITS } from '../config';
import {
  DEFAULT_VOICE_SETTING,
  VOICE_SETTING_VERSION,
  parseVoiceSetting,
  serialiseVoiceSetting,
  settleValue,
  speakOptionsFor,
  type VoiceSetting,
} from '../settings/voice-setting';
import { VOICE_SETTING_KEY, createVoiceSettingStore } from '../settings/voice-setting-store';

const DANIEL = 'com.apple.voice.enhanced.en-GB.Daniel';
/** The fields the server voice added, at their defaults (Auto's voice, the server's default). */
const SERVER_DEFAULTS = { source: 'server', serverVoice: null } as const;
/** A setting as before the server voice, with the new fields at their defaults. */
const phone = (voice: string | null, rate: number, pitch: number): VoiceSetting => ({
  ...SERVER_DEFAULTS,
  voice,
  rate,
  pitch,
});

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  const storage: KeyValueStorage = {
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      items.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      items.delete(key);
    }),
  };
  return { storage, items };
}

const stored = (fields: Record<string, unknown>) =>
  JSON.stringify({ v: VOICE_SETTING_VERSION, ...fields });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the default', () => {
  it('is Auto’s server voice (its default), else Automatic, at the voice’s own speed and pitch', () => {
    expect(DEFAULT_VOICE_SETTING).toEqual({
      source: 'server',
      serverVoice: null,
      voice: null,
      rate: SPEECH_RATE,
      pitch: SPEECH_PITCH,
    });
    expect(SPEECH_RATE).toBe(1);
    expect(SPEECH_PITCH).toBe(1);
  });

  it('is what a store with nothing in it reads', () => {
    const { storage } = memoryStorage();
    expect(createVoiceSettingStore(() => storage).get()).toEqual(DEFAULT_VOICE_SETTING);
  });

  it('has sliders from 0.8 to 1.2 in steps of 0.05', () => {
    expect(SPEECH_RATE_LIMITS).toEqual({ min: 0.8, max: 1.2, step: 0.05 });
    expect(SPEECH_PITCH_LIMITS).toEqual({ min: 0.8, max: 1.2, step: 0.05 });
  });
});

describe('a round trip through the store', () => {
  it('reads back what was saved, in a new store over the same storage (the next launch)', () => {
    const { storage, items } = memoryStorage();
    const setting: VoiceSetting = {
      source: 'phone',
      serverVoice: 'bm_george',
      voice: DANIEL,
      rate: 1.15,
      pitch: 0.9,
    };
    expect(createVoiceSettingStore(() => storage).set(setting)).toBe(true);
    expect(JSON.parse(items.get(VOICE_SETTING_KEY) ?? '')).toEqual({
      v: VOICE_SETTING_VERSION,
      ...setting,
    });
    expect(createVoiceSettingStore(() => storage).get()).toEqual(setting);
  });

  it('keeps Automatic as null', () => {
    const { storage } = memoryStorage();
    createVoiceSettingStore(() => storage).set(phone(null, 0.8, 1.2));
    expect(createVoiceSettingStore(() => storage).get()).toEqual(phone(null, 0.8, 1.2));
  });

  it('reads the store once, then answers from memory', () => {
    const { storage } = memoryStorage({
      [VOICE_SETTING_KEY]: stored({ voice: DANIEL, rate: 1, pitch: 1 }),
    });
    const store = createVoiceSettingStore(() => storage);
    expect(store.get()).toBe(store.get());
    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it('tells each listener of a change, until it unsubscribes', () => {
    const { storage } = memoryStorage();
    const store = createVoiceSettingStore(() => storage);
    const heard = vi.fn();
    const unsubscribe = store.subscribe(heard);
    store.set(phone(DANIEL, 1, 1));
    expect(heard).toHaveBeenCalledTimes(1);
    expect(store.get().voice).toBe(DANIEL);
    unsubscribe();
    store.set(DEFAULT_VOICE_SETTING);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual(DEFAULT_VOICE_SETTING);
  });

  it('holds frozen settings, never the object it was handed', () => {
    const { storage } = memoryStorage();
    const store = createVoiceSettingStore(() => storage);
    const handed = phone(DANIEL, 1, 1);
    store.set(handed);
    expect(store.get()).not.toBe(handed);
    expect(Object.isFrozen(store.get())).toBe(true);
  });
});

describe('corrupt data reads as the default', () => {
  it.each([
    ['not JSON', '{voice:'],
    ['JSON that is not an object', '"Daniel"'],
    ['another version', JSON.stringify({ v: 2, voice: DANIEL, rate: 1, pitch: 1 })],
    ['no version', JSON.stringify({ voice: DANIEL, rate: 1, pitch: 1 })],
    ['a number for the voice', stored({ voice: 7, rate: 1, pitch: 1 })],
    ['a blank voice', stored({ voice: '  ', rate: 1, pitch: 1 })],
    ['text for the rate', stored({ voice: DANIEL, rate: 'fast', pitch: 1 })],
    ['no pitch', stored({ voice: DANIEL, rate: 1 })],
  ])('%s', (_what, raw) => {
    const { storage } = memoryStorage({ [VOICE_SETTING_KEY]: raw });
    expect(createVoiceSettingStore(() => storage).get()).toEqual(DEFAULT_VOICE_SETTING);
    expect(parseVoiceSetting(raw)).toEqual(DEFAULT_VOICE_SETTING);
  });

  it('reads anything that is not a string as the default', () => {
    expect(parseVoiceSetting(null)).toEqual(DEFAULT_VOICE_SETTING);
    expect(parseVoiceSetting(undefined)).toEqual(DEFAULT_VOICE_SETTING);
    expect(parseVoiceSetting(42)).toEqual(DEFAULT_VOICE_SETTING);
  });

  it('ignores fields it does not know', () => {
    const raw = stored({ voice: DANIEL, rate: 1.1, pitch: 1, volume: 3 });
    expect(parseVoiceSetting(raw)).toEqual(phone(DANIEL, 1.1, 1));
  });
});

describe('a value saved before the server voice', () => {
  it('still reads, its phone voice, speed and pitch kept, with Auto’s voice by default', () => {
    const raw = stored({ voice: DANIEL, rate: 0.9, pitch: 1.1 });
    const { storage } = memoryStorage({ [VOICE_SETTING_KEY]: raw });
    expect(createVoiceSettingStore(() => storage).get()).toEqual({
      source: 'server',
      serverVoice: null,
      voice: DANIEL,
      rate: 0.9,
      pitch: 1.1,
    });
  });

  it('a bad source or server voice reads as its default alone', () => {
    const raw = stored({ voice: DANIEL, rate: 1, pitch: 1, source: 'robot', serverVoice: 42 });
    expect(parseVoiceSetting(raw)).toEqual(phone(DANIEL, 1, 1));
    const blank = stored({ voice: null, rate: 1, pitch: 1, source: 'phone', serverVoice: ' ' });
    expect(parseVoiceSetting(blank)).toEqual({ ...phone(null, 1, 1), source: 'phone' });
  });

  it('round-trips the new fields', () => {
    const setting: VoiceSetting = {
      source: 'server',
      serverVoice: 'af_heart',
      voice: null,
      rate: 1.05,
      pitch: 1,
    };
    expect(parseVoiceSetting(serialiseVoiceSetting(setting))).toEqual(setting);
    expect(JSON.parse(serialiseVoiceSetting(setting))).toMatchObject({
      v: 1,
      source: 'server',
      serverVoice: 'af_heart',
    });
  });

  it('settles anything but phone to the server voice, and a blank server voice to its default', () => {
    const odd = { ...phone(null, 1, 1), source: 'other', serverVoice: '  ' } as unknown;
    const { storage } = memoryStorage();
    const store = createVoiceSettingStore(() => storage);
    store.set(odd as VoiceSetting);
    expect(store.get()).toEqual(phone(null, 1, 1));
  });
});

describe('out-of-range values are brought inside the sliders', () => {
  it('clamps a stored speed or pitch to 0.8–1.2', () => {
    const raw = stored({ voice: DANIEL, rate: 3, pitch: 0.1 });
    expect(parseVoiceSetting(raw)).toEqual(phone(DANIEL, 1.2, 0.8));
  });

  it('takes a value between steps to the nearest step, to two places', () => {
    expect(settleValue(0.97, SPEECH_RATE_LIMITS)).toBe(0.95);
    expect(settleValue(1.13, SPEECH_PITCH_LIMITS)).toBe(1.15);
    expect(settleValue(0.8 + 3 * 0.05, SPEECH_RATE_LIMITS)).toBe(0.95);
    expect(settleValue(-5, SPEECH_RATE_LIMITS)).toBe(0.8);
  });

  it('clamps what is saved, too', () => {
    const { storage } = memoryStorage();
    const store = createVoiceSettingStore(() => storage);
    store.set(phone(` ${DANIEL} `, 9, 0.5));
    expect(store.get()).toEqual(phone(DANIEL, 1.2, 0.8));
    expect(parseVoiceSetting(serialiseVoiceSetting(phone('', 1, 1)))).toEqual(
      DEFAULT_VOICE_SETTING,
    );
  });
});

describe('a store that fails', () => {
  it('reads as the default, logged', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const store = createVoiceSettingStore(() => {
      throw new Error('keychain locked');
    });
    expect(store.get()).toEqual(DEFAULT_VOICE_SETTING);
    expect(warn).toHaveBeenCalledWith(
      '[voice] could not read the voice setting; using the default',
      expect.any(Error),
    );
  });

  it('keeps a setting it could not save for this launch, logged, and says so', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { storage } = memoryStorage();
    const failing: KeyValueStorage = {
      ...storage,
      setItem: () => {
        throw new Error('disk full');
      },
    };
    const store = createVoiceSettingStore(() => failing);
    expect(store.set(phone(DANIEL, 1.1, 1))).toBe(false);
    expect(store.get()).toEqual(phone(DANIEL, 1.1, 1));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('speakOptionsFor: what the speaker is given', () => {
  it('the language, the voice when there is one, and the saved rate and pitch', () => {
    const setting: VoiceSetting = phone(DANIEL, 0.9, 1.1);
    expect(speakOptionsFor('en-GB', DANIEL, setting)).toEqual({
      language: 'en-GB',
      voice: DANIEL,
      rate: 0.9,
      pitch: 1.1,
    });
    expect(speakOptionsFor('en-GB', undefined, DEFAULT_VOICE_SETTING)).toEqual({
      language: 'en-GB',
      rate: 1,
      pitch: 1,
    });
  });

  it("carries Auto's server voice when it is given, the phone voice kept for a fallback", () => {
    const client = { binary: vi.fn() };
    const server = { voice: 'af_heart', speed: 0.9, client };
    expect(speakOptionsFor('en-GB', DANIEL, phone(DANIEL, 0.9, 1.1), server)).toEqual({
      language: 'en-GB',
      voice: DANIEL,
      rate: 0.9,
      pitch: 1.1,
      server,
    });
  });
});
