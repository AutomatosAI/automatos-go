// Auto's voice on this phone (Settings → Voice): which voice, how fast, how high. Pure: no React,
// React Native or Expo. Stored as a small versioned JSON value in the app's encrypted MMKV store
// (voice-setting-store.ts) and parsed with zod on the way back, unknown fields ignored. Nothing
// stored, or anything the parser cannot read (garbage, another version, a wrong type), is the
// default: Automatic (pickVoice, the behaviour before the setting existed) at the voice's own speed
// and pitch. A speed or pitch outside its slider's range is brought inside it, in whole steps.

import { z } from 'zod';

import { clampValue, sliderRange, type SliderLimits } from '../../ui/slider-model';
import { SPEECH_PITCH, SPEECH_PITCH_LIMITS, SPEECH_RATE, SPEECH_RATE_LIMITS } from '../config';
import type { SpeakOptions } from '../speech/speaker-core';

export type VoiceSetting = {
  /** The chosen voice's identifier (expo-speech's); null for Automatic. */
  readonly voice: string | null;
  readonly rate: number;
  readonly pitch: number;
};

/** The stored shape's version; a value written under any other version reads as the default. */
export const VOICE_SETTING_VERSION = 1;

export const DEFAULT_VOICE_SETTING: VoiceSetting = Object.freeze({
  voice: null,
  rate: SPEECH_RATE,
  pitch: SPEECH_PITCH,
});

/** Longer than any voice identifier the phones report (Apple's are under 64). */
const IDENTIFIER_MAX = 256;
/** Values are kept to two places, so 0.8 + 3 steps of 0.05 is 0.95, not 0.9500000000000001. */
const PLACES = 100;

const StoredSchema = z.object({
  v: z.literal(VOICE_SETTING_VERSION),
  voice: z.string().trim().min(1).max(IDENTIFIER_MAX).nullable(),
  rate: z.number().finite(),
  pitch: z.number().finite(),
});

/** The nearest whole step inside the limits, to two places. */
export function settleValue(value: number, limits: SliderLimits): number {
  const stepped = clampValue(value, sliderRange(limits));
  return Math.round(stepped * PLACES) / PLACES;
}

/** The setting with its speed and pitch inside their sliders' ranges; a blank voice is Automatic. */
export function settleSetting(setting: VoiceSetting): VoiceSetting {
  const voice = setting.voice?.trim();
  return Object.freeze({
    voice: voice ? voice : null,
    rate: settleValue(setting.rate, SPEECH_RATE_LIMITS),
    pitch: settleValue(setting.pitch, SPEECH_PITCH_LIMITS),
  });
}

export function serialiseVoiceSetting(setting: VoiceSetting): string {
  const { voice, rate, pitch } = settleSetting(setting);
  return JSON.stringify({ v: VOICE_SETTING_VERSION, voice, rate, pitch });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The stored string back to a setting: anything unreadable is the default, values clamped. */
export function parseVoiceSetting(raw: unknown): VoiceSetting {
  if (typeof raw !== 'string') return DEFAULT_VOICE_SETTING;
  const parsed = StoredSchema.safeParse(parseJson(raw));
  if (!parsed.success) return DEFAULT_VOICE_SETTING;
  const { voice, rate, pitch } = parsed.data;
  return settleSetting({ voice, rate, pitch });
}

/** What the speaker is given: the language, the voice when there is one, the saved rate and pitch. */
export function speakOptionsFor(
  language: string,
  voice: string | undefined,
  setting: VoiceSetting,
): SpeakOptions {
  return Object.freeze({
    language,
    ...(voice === undefined ? {} : { voice }),
    rate: setting.rate,
    pitch: setting.pitch,
  });
}
