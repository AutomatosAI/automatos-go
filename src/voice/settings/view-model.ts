// Settings → Voice's rows and words, pure: no React, React Native or Expo. The words are
// VOICE_SETTINGS_COPY's (src/voice/strings.ts).
//   Rows: Automatic, then the phone's voices (voiceChoices' order), each named and labelled with its
//   tier and accent ('Premium · English (US)'), since the list spans the language's regions. Automatic is selected when nothing is saved, or when the saved voice is not on the list (the
//   phone dropped it): quick-ask then speaks with pickVoice's, so the row says what you will hear.
//   Names: iOS may name a voice 'Ava (Premium)' while the row already says Premium, so the brackets
//   go; Google's voices are named by their code ('en-us-x-iol-local'), shown as 'Voice IOL (en-US)'.
//   Sliders: Speed and Pitch with their limits (config.ts), the value shown ('0.90×', 'Normal') and
//   the value in words for VoiceOver and TalkBack ('Slower, 0.9 times').

import { SPEECH_PITCH_LIMITS, SPEECH_RATE_LIMITS } from '../config';
import { languageName, type RecognitionPlatform } from '../quick-ask/recognition-policy';
import type { VoiceChoice } from '../speech/voice-choices';
import { VOICE_SETTINGS_COPY } from '../strings';
import type { VoiceSetting } from './voice-setting';

const COPY = VOICE_SETTINGS_COPY;

export type VoiceRow = Readonly<{
  key: string;
  title: string;
  summary: string;
  selected: boolean;
  /** What a tap saves: the voice's identifier, null for Automatic. */
  voice: string | null;
}>;

const TIER_IN_NAME = /\s*\((?:premium|enhanced)\)\s*$/i;
const GOOGLE_LOCAL = /^([a-z]{2,3})-([a-z]{2,3})-x-([a-z0-9]+)-local$/i;

const REGION_TAG = /^[a-z]{2}$|^\d{3}$/i;

/** A voice's accent from its language tag: 'en-US' → 'English (US)'; no region → 'English'. */
export function accentOf(language: string): string {
  const region = language
    .replace(/_/g, '-')
    .split('-')
    .slice(1)
    .find((part) => REGION_TAG.test(part));
  const name = languageName(language);
  return region ? `${name} (${region.toUpperCase()})` : name;
}

/** A voice's name as a row shows it. */
export function voiceName(name: string): string {
  const trimmed = name.trim();
  const google = GOOGLE_LOCAL.exec(trimmed);
  if (google) {
    const [, language = '', region = '', code = ''] = google;
    return `Voice ${code.toUpperCase()} (${language.toLowerCase()}-${region.toUpperCase()})`;
  }
  const bare = trimmed.replace(TIER_IN_NAME, '').trim();
  return bare || trimmed;
}

function choiceRow(choice: VoiceChoice, saved: string | null, offered: boolean): VoiceRow {
  if (choice.kind === 'automatic') {
    return Object.freeze({
      key: 'automatic',
      title: COPY.automatic,
      summary: COPY.automaticSummary,
      selected: !offered,
      voice: null,
    });
  }
  return Object.freeze({
    key: choice.identifier,
    title: voiceName(choice.name),
    summary: `${COPY.tiers[choice.tier]} · ${accentOf(choice.language)}`,
    selected: choice.identifier === saved,
    voice: choice.identifier,
  });
}

/** One row per choice; exactly one is selected. */
export function voiceRows(
  choices: readonly VoiceChoice[],
  saved: string | null,
): readonly VoiceRow[] {
  const offered = choices.some((choice) => choice.kind === 'voice' && choice.identifier === saved);
  return Object.freeze(choices.map((choice) => choiceRow(choice, saved, offered)));
}

/** Settled values are kept to two places, so 'normal' is exactly 1. */
const NORMAL = 1;

function times(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** The value beside a slider's name: 'Normal', or '0.90×'. */
export function shownValue(value: number): string {
  return value === NORMAL ? COPY.normal : `${value.toFixed(2)}×`;
}

export function speedWords(value: number): string {
  if (value === NORMAL) return COPY.normal;
  return value < NORMAL ? COPY.slower(times(value)) : COPY.faster(times(value));
}

export function pitchWords(value: number): string {
  if (value === NORMAL) return COPY.normal;
  return value < NORMAL ? COPY.lower(times(value)) : COPY.higher(times(value));
}

export type SoundKey = 'rate' | 'pitch';

export type SoundSlider = Readonly<{
  key: SoundKey;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  shown: string;
  words: (value: number) => string;
}>;

/** Speed, then Pitch, at the values the screen shows (a slider being dragged shows its own). */
export function soundSliders(setting: VoiceSetting): readonly SoundSlider[] {
  return Object.freeze([
    Object.freeze({
      key: 'rate',
      label: COPY.speed,
      ...SPEECH_RATE_LIMITS,
      value: setting.rate,
      shown: shownValue(setting.rate),
      words: speedWords,
    }),
    Object.freeze({
      key: 'pitch',
      label: COPY.pitch,
      ...SPEECH_PITCH_LIMITS,
      value: setting.pitch,
      shown: shownValue(setting.pitch),
      words: pitchWords,
    }),
  ]);
}

/** Where to get a better voice, in words for this phone (no link opens its settings). */
export function helpLine(platform: RecognitionPlatform, locale: string): string {
  return COPY.help[platform](languageName(locale));
}
