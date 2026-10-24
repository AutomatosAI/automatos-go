// The phone's own voice for Auto's reply (KV6, US-019d). Pure: no React, React Native or Expo.
// pickVoice reads expo-speech's getAvailableVoicesAsync list: the voices for the exact locale first
// (language and region; a script subtag such as zh-Hans is ignored), then for its language; within
// them the best quality first; none → undefined, and the engine speaks with its default voice for
// the language.
//   iOS: every AVSpeechSynthesisVoice is on the phone. Apple's own voices only (com.apple.voice.*,
//   com.apple.ttsbundle.*): speechVoices() also lists the novelty and Eloquence voices at Default
//   quality. Premium (reported as Default: SpeechModule.swift:66 maps only .enhanced) before Enhanced
//   before Default.
//   Android: expo-speech exposes no network flag, so the voice's name decides (Google TTS names
//   each 'en-us-x-iol-local' or 'en-us-x-iol-network'): only names with 'local' and never
//   'network'; Enhanced (above QUALITY_NORMAL, SpeechModule.kt:87) first.

import type { RecognitionPlatform } from '../quick-ask/recognition-policy';

/** The fields of expo-speech's Voice this picks by. */
export type SpeechVoice = {
  readonly identifier: string;
  readonly name: string;
  readonly quality: string;
  readonly language: string;
};

const ENHANCED = 'Enhanced';
const APPLE_VOICES: readonly string[] = ['com.apple.voice.', 'com.apple.ttsbundle.'];
const APPLE_PREMIUM = '.premium.';

/** java.util.Locale's old language codes (before Java 17), which Android's voices may report. */
const LEGACY_LANGUAGES: Readonly<Record<string, string>> = Object.freeze({
  iw: 'he',
  in: 'id',
  ji: 'yi',
});
const REGION = /^(?:[a-z]{2}|\d{3})$/;

type LocaleKey = { readonly language: string; readonly region: string };

/** 'en_GB', 'EN-gb' and 'en-Latn-GB' alike → en + gb; 'iw-IL' → he + il. */
function localeKey(tag: string): LocaleKey {
  const [first = '', ...rest] = tag.trim().replace(/_/g, '-').toLowerCase().split('-');
  const language = Object.prototype.hasOwnProperty.call(LEGACY_LANGUAGES, first)
    ? (LEGACY_LANGUAGES[first] as string)
    : first;
  return { language, region: rest.find((part) => REGION.test(part)) ?? '' };
}

function usable(voice: SpeechVoice, platform: RecognitionPlatform): boolean {
  if (platform === 'android') {
    const name = voice.name.toLowerCase();
    return name.includes('local') && !name.includes('network');
  }
  return APPLE_VOICES.some((prefix) => voice.identifier.startsWith(prefix));
}

function rank(voice: SpeechVoice, platform: RecognitionPlatform): number {
  if (platform === 'ios' && voice.identifier.includes(APPLE_PREMIUM)) return 2;
  return voice.quality === ENHANCED ? 1 : 0;
}

function best(
  voices: readonly SpeechVoice[],
  platform: RecognitionPlatform,
): SpeechVoice | undefined {
  return voices.reduce<SpeechVoice | undefined>(
    (top, voice) =>
      top === undefined || rank(voice, platform) > rank(top, platform) ? voice : top,
    undefined,
  );
}

/** The identifier of the phone's best voice for the locale, else undefined (the engine's default). */
export function pickVoice(
  voices: readonly SpeechVoice[],
  locale: string,
  platform: RecognitionPlatform,
): string | undefined {
  const wanted = localeKey(locale);
  const candidates = voices
    .filter((voice) => usable(voice, platform))
    .map((voice) => ({ voice, key: localeKey(voice.language) }));
  const sameLanguage = candidates.filter(({ key }) => key.language === wanted.language);
  const exact = sameLanguage.filter(({ key }) => key.region === wanted.region);
  const group = exact.length > 0 ? exact : sameLanguage;
  return best(
    group.map(({ voice }) => voice),
    platform,
  )?.identifier;
}
