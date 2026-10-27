// Settings → Voice's "I speak" (27 Oct 2026): its rows, pure (no React, React Native or Expo). The
// words are LANGUAGE_COPY's (src/voice/strings.ts).
//   Rows: Automatic (the phone's language, named with its accent: 'English (GB)'), English (the
// English it listens in: the phone's own, else British), Português (Portugal), Português (Brasil);
// exactly one selected. A tap saves the choice (withSpeakChoice) and plays the sample in it.

import { accentOf } from '../settings/view-model';
import { SPEAK_CHOICES, type SpeakChoice, type VoiceSetting } from '../settings/voice-setting';
import { LANGUAGE_COPY } from '../strings';
import { choiceLocale, isPortuguese, speakChoiceOf } from './speak-language';

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
