// The language the server writes its copy in (PRD-268 §6.11: next_step, the brief, rule sentences):
// core reads Accept-Language and answers in English or Portuguese (Brazil), English by default.
// The client sends it from the person's "I speak" (Settings → Voice, src/voice/language), the
// same choice chat turns carry as their locale: English as 'en', Portuguese (Brazil) as 'pt-BR'.
// Automatic, or a choice this version does not know, sends no header, so the platform's own
// default stands. Pure: client.ts adds the header to every call it builds.

import { logger } from '../lib/logger';

export const ACCEPT_LANGUAGE_HEADER = 'Accept-Language';

/** The languages core writes its copy in. */
export type ServerLanguage = 'en' | 'pt-BR';

/** "I speak" as the shell reads it ('auto', 'en', 'pt-BR'); null or undefined when not known. */
export type LanguageGetter = () => string | null | undefined;

const SERVER_LANGUAGES: ReadonlyMap<string, ServerLanguage> = new Map<string, ServerLanguage>([
  ['en', 'en'],
  ['pt-BR', 'pt-BR'],
]);

/** The header's value for a choice: 'en' or 'pt-BR'; null for Automatic or anything else. */
export function acceptLanguageOf(choice: string | null | undefined): ServerLanguage | null {
  return choice ? (SERVER_LANGUAGES.get(choice) ?? null) : null;
}

/** The header for a choice, or no header at all. */
export function acceptLanguageHeaders(
  choice: string | null | undefined,
): Readonly<Record<string, string>> {
  const language = acceptLanguageOf(choice);
  return language === null ? {} : { [ACCEPT_LANGUAGE_HEADER]: language };
}

/** The getter's choice; one that throws sends no header (logged) and never fails the call. */
export function readLanguage(getLanguage: LanguageGetter | undefined): string | null {
  if (!getLanguage) return null;
  try {
    return getLanguage() ?? null;
  } catch (error) {
    logger.warn('[api] could not read the language; sending no Accept-Language', error);
    return null;
  }
}
