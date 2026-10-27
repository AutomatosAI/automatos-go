// Auto's voice on this phone (Settings → Voice): which voice, how fast, how high. Pure: no React,
// React Native or Expo. Stored as a small versioned JSON value in the app's encrypted MMKV store
// (voice-setting-store.ts) and parsed with zod on the way back, unknown fields ignored. Nothing
// stored, or anything the parser cannot read (garbage, another version, a wrong type), is the
// default: Auto's server voice when the server offers one (its default voice), else Automatic
// (pickVoice, the behaviour before the setting existed), at the voice's own speed and pitch. A
// speed or pitch outside its slider's range is brought inside it, in whole steps.
//   source and serverVoice came with the server voice (27 Oct 2026) under the same version: a value
// saved before them reads with their defaults (source 'server', the server's default voice) and
// keeps its phone voice, speed and pitch; a bad value in either reads as its default alone.
//   language, portuguese and voices came with "I speak" (27 Oct 2026), also under the same version
// and kept only when they are not their defaults: absent, the language is Automatic (the phone's,
// as before), the EN/PT switch goes to Portuguese (Portugal), and each Portuguese has its default
// voice. The top-level source, serverVoice and voice stay the voice for English and for any language
// other than Portuguese (language-voice.ts), so a value saved before reads exactly as it did. A bad
// value in any of the three reads as its default alone.

import { z } from 'zod';

import { clampValue, sliderRange, type SliderLimits } from '../../ui/slider-model';
import { SPEECH_PITCH, SPEECH_PITCH_LIMITS, SPEECH_RATE, SPEECH_RATE_LIMITS } from '../config';
import type { ServerSpeech } from '../server/server-speaker-ports';
import type { SpeakOptions } from '../speech/speaker-core';

/** Whose voice Auto speaks in: the server's (when it offers one) or this phone's. */
export type VoiceSource = 'server' | 'phone';

/** Settings → Voice's "I speak": the phone's language (Automatic), English, or a Portuguese. */
export type SpeakChoice = 'auto' | 'en' | 'pt-PT' | 'pt-BR';

/** The two Portuguese the app speaks: Portugal's and Brazil's. */
export type Portuguese = 'pt-PT' | 'pt-BR';

/** One language's voice: Auto's server voice (an id, or the language's default) or this phone's. */
export type LanguageVoice = {
  readonly source: VoiceSource;
  readonly serverVoice: string | null;
  readonly voice: string | null;
};

export type VoiceSetting = {
  /** 'server': Auto's server voice whenever the server lists tts; 'phone': this phone's always. */
  readonly source: VoiceSource;
  /** The chosen server voice's id; null for the server's default. */
  readonly serverVoice: string | null;
  /** The chosen phone voice's identifier (expo-speech's); null for Automatic. */
  readonly voice: string | null;
  /** Speed, for both voices (sent to the server as speed). */
  readonly rate: number;
  /** Pitch, for the phone's voice only. */
  readonly pitch: number;
  /** "I speak"; absent is 'auto' (the phone's language). */
  readonly language?: SpeakChoice;
  /** The Portuguese the EN/PT switch goes to; absent is 'pt-PT'. */
  readonly portuguese?: Portuguese;
  /** Each Portuguese's own voice; absent is that language's default (language-voice.ts). */
  readonly voices?: Readonly<Partial<Record<Portuguese, LanguageVoice>>>;
};

export const SPEAK_CHOICES: readonly SpeakChoice[] = Object.freeze([
  'auto',
  'en',
  'pt-PT',
  'pt-BR',
]);
export const PORTUGUESE: readonly Portuguese[] = Object.freeze(['pt-PT', 'pt-BR']);

/** The stored shape's version; a value written under any other version reads as the default. */
export const VOICE_SETTING_VERSION = 1;

export const DEFAULT_VOICE_SETTING: VoiceSetting = Object.freeze({
  source: 'server',
  serverVoice: null,
  voice: null,
  rate: SPEECH_RATE,
  pitch: SPEECH_PITCH,
});

/** Longer than any voice identifier the phones report (Apple's are under 64). */
const IDENTIFIER_MAX = 256;
/** Values are kept to two places, so 0.8 + 3 steps of 0.05 is 0.95, not 0.9500000000000001. */
const PLACES = 100;

const identifier = z.string().trim().min(1).max(IDENTIFIER_MAX);

const LanguageVoiceSchema = z.object({
  source: z.enum(['server', 'phone']),
  serverVoice: identifier.nullable(),
  voice: identifier.nullable(),
});

const StoredSchema = z.object({
  v: z.literal(VOICE_SETTING_VERSION),
  voice: identifier.nullable(),
  rate: z.number().finite(),
  pitch: z.number().finite(),
  // Added with the server voice: absent (an older value) or unreadable → the default.
  source: z.enum(['server', 'phone']).optional().catch(undefined),
  serverVoice: identifier.nullable().optional().catch(null),
  // Added with "I speak": absent (an older value) or unreadable → the default.
  language: z.enum(['auto', 'en', 'pt-PT', 'pt-BR']).optional().catch(undefined),
  portuguese: z.enum(['pt-PT', 'pt-BR']).optional().catch(undefined),
  voices: z
    .object({
      'pt-PT': LanguageVoiceSchema.optional().catch(undefined),
      'pt-BR': LanguageVoiceSchema.optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
});

/** The nearest whole step inside the limits, to two places. */
export function settleValue(value: number, limits: SliderLimits): number {
  const stepped = clampValue(value, sliderRange(limits));
  return Math.round(stepped * PLACES) / PLACES;
}

function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function settleVoice(voice: LanguageVoice): LanguageVoice {
  return Object.freeze({
    source: voice.source === 'phone' ? 'phone' : 'server',
    serverVoice: trimmed(voice.serverVoice),
    voice: trimmed(voice.voice),
  });
}

type LanguageFields = Pick<VoiceSetting, 'language' | 'portuguese' | 'voices'>;

/** "I speak"'s fields that are not their defaults (absent is the default: nothing is written). */
function languageFields(setting: VoiceSetting): LanguageFields {
  const { language, portuguese, voices = {} } = setting;
  const kept = PORTUGUESE.flatMap((key) => {
    const voice = voices[key];
    return voice ? [[key, settleVoice(voice)] as const] : [];
  });
  return {
    ...(language && language !== 'auto' ? { language } : {}),
    ...(portuguese === 'pt-BR' ? { portuguese } : {}),
    ...(kept.length > 0 ? { voices: Object.freeze(Object.fromEntries(kept)) } : {}),
  };
}

/**
 * The setting with its speed and pitch inside their sliders' ranges; a blank phone voice is
 * Automatic, a blank server voice the server's default, anything but 'phone' the server's voice;
 * "I speak"'s fields only where they are not their defaults.
 */
export function settleSetting(setting: VoiceSetting): VoiceSetting {
  return Object.freeze({
    ...settleVoice(setting),
    rate: settleValue(setting.rate, SPEECH_RATE_LIMITS),
    pitch: settleValue(setting.pitch, SPEECH_PITCH_LIMITS),
    ...languageFields(setting),
  });
}

export function serialiseVoiceSetting(setting: VoiceSetting): string {
  const { source, serverVoice, voice, rate, pitch, ...language } = settleSetting(setting);
  return JSON.stringify({
    v: VOICE_SETTING_VERSION,
    voice,
    rate,
    pitch,
    source,
    serverVoice,
    ...language,
  });
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
  const { voice, rate, pitch, source, serverVoice, language, portuguese, voices } = parsed.data;
  return settleSetting({
    source: source ?? DEFAULT_VOICE_SETTING.source,
    serverVoice: serverVoice ?? null,
    voice,
    rate,
    pitch,
    ...(language ? { language } : {}),
    ...(portuguese ? { portuguese } : {}),
    ...(voices ? { voices } : {}),
  });
}

/**
 * What the speaker is given: the language, the phone voice when there is one, the saved rate and
 * pitch, and Auto's server voice when it is given (serverSpeechFor: offered and chosen). The phone
 * voice stays in it: reply-voice.ts speaks a turn the server voice failed with it.
 */
export function speakOptionsFor(
  language: string,
  voice: string | undefined,
  setting: VoiceSetting,
  server?: ServerSpeech,
): SpeakOptions {
  return Object.freeze({
    language,
    ...(voice === undefined ? {} : { voice }),
    rate: setting.rate,
    pitch: setting.pitch,
    ...(server === undefined ? {} : { server }),
  });
}
