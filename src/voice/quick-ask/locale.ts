// The language quick-ask listens and speaks in (KV4, US-019b): the phone's first locale from
// expo-localization, the same one text to speech uses (US-019d), else FALLBACK_LOCALE.

import { getLocales } from 'expo-localization';

import { FALLBACK_LOCALE } from '../config';

/** The phone's first locale as a BCP 47 tag ('en-GB'), else 'en-US'. */
export function phoneLocale(): string {
  const tag = getLocales()[0]?.languageTag?.trim();
  return tag ? tag : FALLBACK_LOCALE;
}
