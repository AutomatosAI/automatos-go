// The language hold to talk listens in and Auto speaks (27 Oct 2026): Settings → Voice's "I speak"
// and the EN/PT switch beside HOLD TO TALK. Pure: no React, React Native or Expo.
//   The choice: Automatic (the phone's first locale, the behaviour before the setting existed),
// English (the phone's own English when the phone is in English, else ENGLISH_FALLBACK_LOCALE), or
// Portuguese (Brazil), the one Portuguese the app speaks (Gerard, 27 Oct 2026). Recognition listens
// in that locale (recognition-policy.ts) and the reply is spoken in it (language-voice.ts).
//   The switch: the listening language's two letters ('EN', 'PT'; Automatic on a French phone:
// 'FR'); a tap goes to English from anything that is not English, and from English to Portuguese
// (Brazil). So it is there from the default state, Automatic, and one tap flips it.

import { ENGLISH_FALLBACK_LOCALE } from '../config';
import { languageName, languageOf } from '../quick-ask/recognition-policy';
import type { Portuguese, SpeakChoice, VoiceSetting } from '../settings/voice-setting';
import { LANGUAGE_COPY } from '../strings';

/** The Portuguese the app speaks, and the one the switch goes to from English. */
export const PORTUGUESE_CHOICE: Portuguese = 'pt-BR';

const ENGLISH = 'en';
const PORTUGUESE_LANGUAGE = 'pt';

/** 'en_GB' and 'EN-gb' alike → 'en-gb'. */
function normalise(tag: string): string {
  return tag.trim().replace(/_/g, '-').toLowerCase();
}

/** The same locale, whatever its case or separator. */
export function sameLocale(a: string, b: string): boolean {
  return normalise(a) === normalise(b);
}

export function speakChoiceOf(setting: VoiceSetting): SpeakChoice {
  return setting.language ?? 'auto';
}

export function isPortuguese(choice: SpeakChoice): choice is Portuguese {
  return choice === PORTUGUESE_CHOICE;
}

/** The locale a choice listens and speaks in, on a phone whose first locale is `phone`. */
export function choiceLocale(choice: SpeakChoice, phone: string): string {
  if (choice === 'auto') return phone;
  if (choice === 'en') return languageOf(phone) === ENGLISH ? phone : ENGLISH_FALLBACK_LOCALE;
  return choice;
}

/** The locale hold to talk listens in and Auto speaks, from the saved choice. */
export function listeningLocale(setting: VoiceSetting, phone: string): string {
  return choiceLocale(speakChoiceOf(setting), phone);
}

/**
 * The Portuguese voice and sample a locale speaks with: Brazil's for any Portuguese (a phone in
 * Portugal's on Automatic included: the app speaks Brazil's only); null for another language.
 */
export function portugueseFor(locale: string): Portuguese | null {
  return languageOf(locale) === PORTUGUESE_LANGUAGE ? PORTUGUESE_CHOICE : null;
}

/** A language by name for the copy: 'Portuguese (Brazil)' for pt-BR, else languageName's. */
export function spokenName(locale: string): string {
  return normalise(locale) === normalise(PORTUGUESE_CHOICE)
    ? LANGUAGE_COPY.names[PORTUGUESE_CHOICE]
    : languageName(locale);
}

/** The setting with "I speak" chosen. */
export function withSpeakChoice(setting: VoiceSetting, choice: SpeakChoice): VoiceSetting {
  return { ...setting, language: choice };
}

/** What the switch's tap chooses: English from anything else, Portuguese (Brazil) from English. */
export function switchedChoice(setting: VoiceSetting, phone: string): SpeakChoice {
  return languageOf(listeningLocale(setting, phone)) === ENGLISH ? PORTUGUESE_CHOICE : 'en';
}

/** The EN/PT switch: its letters, what VoiceOver says, and what a tap chooses. */
export type LanguageSwitchView = Readonly<{
  /** The listening language's two letters, in capitals: 'EN', 'PT'. */
  text: string;
  /** 'Speaking English. Switch to Portuguese'. */
  label: string;
  hint: string;
  next: SpeakChoice;
}>;

export function languageSwitch(setting: VoiceSetting, phone: string): LanguageSwitchView {
  const now = listeningLocale(setting, phone);
  const next = switchedChoice(setting, phone);
  return Object.freeze({
    text: languageOf(now).toUpperCase(),
    label: LANGUAGE_COPY.switchLabel(languageName(now), languageName(choiceLocale(next, phone))),
    hint: LANGUAGE_COPY.switchHint,
    next,
  });
}
