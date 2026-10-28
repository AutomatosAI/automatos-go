// Auto's voice per language (27 Oct 2026): one voice choice for each language Auto speaks. Pure: no
// React, React Native or Expo.
//   English, and any language other than Portuguese (Automatic on a French phone), keep the
// setting's own source, serverVoice and voice, exactly as before "I speak": the server's default
// voice until one is chosen, from the server's whole list. Portuguese (Brazil), the one Portuguese
// the app speaks, has its own, in the setting's `voices`: Auto's server voice by default, its first
// pt-BR voice (pf_dora on Kokoro; the server's default is English, so it is never asked for); this
// phone's pt-BR voice when the server has none, when its list is not known yet and none was chosen,
// or when the person chooses the phone's.
//   Every reader takes the language's choice as a whole setting (settingForLanguage: its source,
// serverVoice and voice in the top-level fields), so speakOptionsFor, serverSpeechFor and the
// Settings rows read it unchanged; withLanguageVoice writes such a setting back to its language.
// Speed and pitch are one pair for every language.

import { SPEECH_PITCH, SPEECH_RATE } from '../config';
import { languageOf } from '../quick-ask/recognition-policy';
import { voicesReady, type ServerVoicesState } from '../server/server-voices';
import type { ServerVoice } from '../server/voice-api';
import type { LanguageVoice, Portuguese, VoiceSetting } from '../settings/voice-setting';
import { PORTUGUESE_CHOICE, listeningLocale, portugueseFor, sameLocale } from './speak-language';

/** Whose voice choice a locale speaks with: the setting's own ('main'), or a Portuguese's. */
export type VoiceKey = 'main' | Portuguese;

const PORTUGUESE_LANGUAGE = 'pt';

const MAIN_DEFAULT: LanguageVoice = Object.freeze({
  source: 'server',
  serverVoice: null,
  voice: null,
});

/** Portuguese's voice until one is chosen: Auto's server voice, its first pt-BR one. */
export const PORTUGUESE_VOICE_DEFAULTS: Readonly<Record<Portuguese, LanguageVoice>> = Object.freeze(
  { 'pt-BR': Object.freeze({ source: 'server', serverVoice: null, voice: null }) },
);

export function voiceKeyFor(locale: string): VoiceKey {
  return portugueseFor(locale) ?? 'main';
}

/** The language's voice choice, the default when none is saved. */
export function languageVoiceOf(setting: VoiceSetting, key: VoiceKey): LanguageVoice {
  if (key === 'main') return setting;
  return setting.voices?.[key] ?? PORTUGUESE_VOICE_DEFAULTS[key];
}

/** The language's default voice choice (Reset to default). */
export function defaultVoiceFor(locale: string): LanguageVoice {
  const key = voiceKeyFor(locale);
  return key === 'main' ? MAIN_DEFAULT : PORTUGUESE_VOICE_DEFAULTS[key];
}

/** The setting as the locale speaks it: the language's voice choice in its top-level fields. */
export function settingForLanguage(setting: VoiceSetting, locale: string): VoiceSetting {
  const key = voiceKeyFor(locale);
  if (key === 'main') return setting;
  const { source, serverVoice, voice } = languageVoiceOf(setting, key);
  return { ...setting, source, serverVoice, voice };
}

/** `setting` with `chosen`'s voice saved for the locale's language, and its speed and pitch. */
export function withLanguageVoice(
  setting: VoiceSetting,
  locale: string,
  chosen: VoiceSetting,
): VoiceSetting {
  const key = voiceKeyFor(locale);
  const { source, serverVoice, voice, rate, pitch } = chosen;
  if (key === 'main') return { ...setting, source, serverVoice, voice, rate, pitch };
  const voices = { ...setting.voices, [key]: { source, serverVoice, voice } };
  return { ...setting, rate, pitch, voices };
}

/** The language's voice, speed and pitch back to their defaults; the rest of the setting kept. */
export function resetLanguage(setting: VoiceSetting, locale: string): VoiceSetting {
  const reset = { ...setting, ...defaultVoiceFor(locale), rate: SPEECH_RATE, pitch: SPEECH_PITCH };
  return withLanguageVoice(setting, locale, reset);
}

/** The language's default is the server's voice (English and the rest), not the phone's. */
export function defaultsToServer(locale: string): boolean {
  return defaultVoiceFor(locale).source === 'server';
}

/** The language has a server default worth asking for: English and the rest, not Portuguese. */
export function hasServerDefault(locale: string): boolean {
  return voiceKeyFor(locale) === 'main';
}

function speaksPortuguese(voice: ServerVoice): boolean {
  return voice.accent !== null && languageOf(voice.accent) === PORTUGUESE_LANGUAGE;
}

/** The server's voices for the locale: its whole list (as before), only pt ones for Portuguese. */
export function serverVoicesFor(voices: ServerVoicesState, locale: string): ServerVoicesState {
  if (hasServerDefault(locale) || voices.kind !== 'ready') return voices;
  const offered = voices.list.voices.filter(speaksPortuguese);
  const { defaultId } = voices.list;
  return voicesReady(
    Object.freeze({
      defaultId: offered.some((voice) => voice.id === defaultId) ? defaultId : null,
      voices: Object.freeze(offered),
    }),
  );
}

/**
 * Portuguese's server voice: the saved one while offered, else the first pt-BR one (else the first
 * Portuguese one); null: none known.
 */
function portugueseServerVoice(saved: string | null, voices: ServerVoicesState): string | null {
  if (voices.kind !== 'ready') return saved;
  const offered = voices.list.voices;
  if (saved !== null && offered.some((voice) => voice.id === saved)) return saved;
  const brazil = offered.find(
    (voice) => voice.accent !== null && sameLocale(voice.accent, PORTUGUESE_CHOICE),
  );
  return (brazil ?? offered[0])?.id ?? null;
}

/**
 * The language's setting as it is spoken (`voices` from serverVoicesFor): English and the rest as
 * saved; a Portuguese with Auto's server voice names the voice, or speaks with the phone's when the
 * server has none for it (or its list is not known and none was chosen).
 */
export function spokenSetting(
  setting: VoiceSetting,
  voices: ServerVoicesState,
  locale: string,
): VoiceSetting {
  if (hasServerDefault(locale) || setting.source === 'phone' || voices.kind === 'off')
    return setting;
  const chosen = portugueseServerVoice(setting.serverVoice, voices);
  return chosen === null ? { ...setting, source: 'phone' } : { ...setting, serverVoice: chosen };
}

/** What a reply (or the sample) is spoken with: the language, its server voices, its choice. */
export type SpokenLanguage = Readonly<{
  /** "I speak"'s locale: recognition listens in it and the reply is spoken in it. */
  language: string;
  /** The server's voices for it (serverVoicesFor). */
  voices: ServerVoicesState;
  /** Its voice choice as spoken (spokenSetting over settingForLanguage), with speed and pitch. */
  setting: VoiceSetting;
}>;

/** The saved setting as quick-ask and the sample speak it, on a phone whose locale is `phone`. */
export function spokenLanguage(
  saved: VoiceSetting,
  phone: string,
  voices: ServerVoicesState,
): SpokenLanguage {
  const language = listeningLocale(saved, phone);
  const offered = serverVoicesFor(voices, language);
  return Object.freeze({
    language,
    voices: offered,
    setting: spokenSetting(settingForLanguage(saved, language), offered, language),
  });
}
