// The language hold to talk listens in and Auto speaks (27 Oct 2026): Settings → Voice's "I speak"
// and the EN/PT switch beside HOLD TO TALK. Pure: no React, React Native or Expo.
//   The choice: Automatic (the phone's first locale, the behaviour before the setting existed),
// English (the phone's own English when the phone is in English, else ENGLISH_FALLBACK_LOCALE), or
// Portuguese (Portugal) or (Brazil). Recognition listens in that locale (recognition-policy.ts) and
// the reply is spoken in it (language-voice.ts).
//   The switch: the listening language's two letters ('EN', 'PT'; Automatic on a French phone:
// 'FR'); a tap goes to English from anything that is not English, and from English to the
// Portuguese last chosen (Portugal's until Brazil's is picked). So it is there from the default
// state, Automatic, and one tap flips it.

import { ENGLISH_FALLBACK_LOCALE } from '../config';
import { languageName, languageOf } from '../quick-ask/recognition-policy';
import type { Portuguese, SpeakChoice, VoiceSetting } from '../settings/voice-setting';
import { LANGUAGE_COPY } from '../strings';

/** The Portuguese the switch goes to before one is chosen. */
export const DEFAULT_PORTUGUESE: Portuguese = 'pt-PT';

const ENGLISH = 'en';
const PORTUGUESE_LANGUAGE = 'pt';
const BRAZIL = 'br';

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

export function portugueseOf(setting: VoiceSetting): Portuguese {
  return setting.portuguese ?? DEFAULT_PORTUGUESE;
}

export function isPortuguese(choice: SpeakChoice): choice is Portuguese {
  return choice === 'pt-PT' || choice === 'pt-BR';
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

/** Which Portuguese a locale is: Brazil's for pt-BR, Portugal's for any other Portuguese; else null. */
export function portugueseFor(locale: string): Portuguese | null {
  const [language, ...rest] = normalise(locale).split('-');
  if (language !== PORTUGUESE_LANGUAGE) return null;
  return rest.includes(BRAZIL) ? 'pt-BR' : 'pt-PT';
}

/** A language by name for the copy: 'Portuguese (Portugal)' for pt-PT, else languageName's. */
export function spokenName(locale: string): string {
  const tag = normalise(locale);
  if (tag === 'pt-pt') return LANGUAGE_COPY.names['pt-PT'];
  if (tag === 'pt-br') return LANGUAGE_COPY.names['pt-BR'];
  return languageName(locale);
}

/** The setting with "I speak" chosen; a Portuguese also becomes the one the switch goes to. */
export function withSpeakChoice(setting: VoiceSetting, choice: SpeakChoice): VoiceSetting {
  return { ...setting, language: choice, ...(isPortuguese(choice) ? { portuguese: choice } : {}) };
}

/** What the switch's tap chooses: English from anything else, the chosen Portuguese from English. */
export function switchedChoice(setting: VoiceSetting, phone: string): SpeakChoice {
  return languageOf(listeningLocale(setting, phone)) === ENGLISH ? portugueseOf(setting) : 'en';
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
