// Settings → Voice's "I speak" (27 Oct 2026): its rows and its note, pure (no React, React Native or
// Expo). The words are LANGUAGE_COPY's (src/voice/strings.ts).
//   Rows: Automatic (the phone's language, named with its accent: 'English (GB)'), English (the
// English it listens in: the phone's own, else British), Português (Brasil); exactly one selected.
// A tap saves the choice (withSpeakChoice) and plays the sample in it.
//   The note, iOS only: while the choice listens in another language than the iPhone's own, iOS
// recognises it on the iPhone when that language's dictation is installed and otherwise on Apple's
// servers (recognition-policy.ts), and the note says so before any press.

import { languageName, type RecognitionPlatform } from '../quick-ask/recognition-policy';
import { accentOf } from '../settings/view-model';
import { SPEAK_CHOICES, type SpeakChoice, type VoiceSetting } from '../settings/voice-setting';
import { LANGUAGE_COPY } from '../strings';
import {
  choiceLocale,
  isPortuguese,
  listeningLocale,
  sameLocale,
  speakChoiceOf,
  spokenName,
} from './speak-language';

const COPY = LANGUAGE_COPY;

export type LanguageRow = Readonly<{
  key: SpeakChoice;
  title: string;
  summary: string;
  selected: boolean;
}>;

function summaryOf(choice: SpeakChoice, phone: string): string {
  if (choice === 'auto') return COPY.automaticSummary(accentOf(phone));
  if (isPortuguese(choice)) return COPY.names[choice];
  return accentOf(choiceLocale(choice, phone));
}

/** One row per choice, in SPEAK_CHOICES' order; the saved one selected. */
export function languageRows(setting: VoiceSetting, phone: string): readonly LanguageRow[] {
  const saved = speakChoiceOf(setting);
  return Object.freeze(
    SPEAK_CHOICES.map((choice) =>
      Object.freeze({
        key: choice,
        title: COPY.choices[choice],
        summary: summaryOf(choice, phone),
        selected: choice === saved,
      }),
    ),
  );
}

/** iOS, while the choice is not the iPhone's own language: where it is recognised. */
export function languageNote(
  platform: RecognitionPlatform,
  setting: VoiceSetting,
  phone: string,
): string | null {
  const listening = listeningLocale(setting, phone);
  if (platform !== 'ios' || sameLocale(listening, phone)) return null;
  return COPY.iosNote(languageName(listening), spokenName(listening));
}
