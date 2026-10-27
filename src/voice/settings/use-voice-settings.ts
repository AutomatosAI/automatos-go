// Settings → Voice's wiring: the phone's voices for the language quick-ask speaks in ("I speak"),
// the saved setting (use-voice-setting.ts), and the sample line. Only wiring: the rows and words are
// view-model.ts's, the sample's sequencing sample-player.ts's.
//   The list is read afresh when the screen opens and each time the app comes back to the front
//   (the person may have downloaded a voice in the phone's Settings, as the help line says). A list
//   that fails to load is logged where it is read (speaker-core.ts) and leaves Automatic alone.
//   A tap on a voice saves it and plays the sample in it; a tap on the chosen one plays it again.
//   A slider shows its value while dragged and saves on release, then plays the sample. Reset saves
//   the default and plays it.
//   While open, the screen holds the speaker's one listener (a voice screen beneath it hears
//   nothing of the sample); going away stops the sample, then lets the listener go.
//   Auto's server voice (27 Oct 2026): when the server lists tts, its voices are read afresh on
//   open (use-server-voices.ts) and listed first (server-view-model.ts); a tap on one saves it and
//   plays the sample through the server, as quick-ask would speak (serverSpeechFor), the phone's
//   voice saying it when the server cannot. Speaks through the one voice out (voice-out.ts).
//   "I speak" (27 Oct 2026): the language rows first (language/language-rows.ts), with iOS's note
//   while the choice is not the iPhone's language; a tap saves the choice (withSpeakChoice) and
//   plays the sample in it. The voice part below is the chosen language's (language-voice.ts):
//   its server voices (Portuguese: only pt ones), its saved choice (as spokenLanguage resolves it),
//   and a tap saves that language's choice alone (withLanguageVoice). Speed and pitch are shared;
//   Reset to default resets the language's voice, speed and pitch, and keeps "I speak".

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useAppSession } from '../../app-state/session';
import { logger } from '../../lib/logger';
import { SPEECH_PITCH_LIMITS, SPEECH_RATE_LIMITS } from '../config';
import {
  languageNote,
  languageRows,
  serverNote,
  type LanguageRow,
} from '../language/language-rows';
import {
  defaultsToServer,
  hasServerDefault,
  resetLanguage,
  settingForLanguage,
  spokenLanguage,
  withLanguageVoice,
} from '../language/language-voice';
import { withSpeakChoice } from '../language/speak-language';
import { usePhoneLocale } from '../language/use-speak-language';
import type { RecognitionPlatform } from '../quick-ask/recognition-policy';
import { serverSpeechFor, type ServerVoicesState } from '../server/server-voices';
import { useServerVoices } from '../server/use-server-voices';
import { voiceOut } from '../speech/voice-out';
import { AUTOMATIC_VOICE, type VoiceChoice } from '../speech/voice-choices';
import { VOICE_SETTINGS_COPY } from '../strings';
import { createSamplePlayer } from './sample-player';
import {
  screenWords,
  serverVoiceRows,
  showsPhoneVoices,
  soundPart,
  withServerChoice,
  type ServerChoice,
  type ServerVoiceRow,
  type SoundPart,
} from './server-view-model';
import { useVoiceSetting, voiceSetting } from './use-voice-setting';
import { settleValue, type SpeakChoice, type VoiceSetting } from './voice-setting';
import { helpLine, voiceRows, type SoundKey, type VoiceRow } from './view-model';

const PLATFORM: RecognitionPlatform = Platform.OS === 'android' ? 'android' : 'ios';
const LIMITS = Object.freeze({ rate: SPEECH_RATE_LIMITS, pitch: SPEECH_PITCH_LIMITS });
const NO_CHOICES: readonly VoiceChoice[] = Object.freeze([AUTOMATIC_VOICE]);

/** The phone's voices: Automatic and the phone's list, with where to get a better one. */
export type PhonePart = Readonly<{ title: string; rows: readonly VoiceRow[]; help: string }>;

export type VoiceSettingsView = Readonly<{
  lede: string;
  /** "I speak": Automatic, English, Português (Portugal), Português (Brasil). */
  languages: readonly LanguageRow[];
  /** iOS, while the choice is not the iPhone's language: hold to talk works only in that one. */
  languageNote: string | null;
  chooseLanguage: (choice: SpeakChoice) => void;
  /** "Auto's voice" with the server's voices for the language; null when the server lists no tts. */
  server: readonly ServerVoiceRow[] | null;
  /** Above them for Portuguese (Portugal): the server has no European Portuguese voice. */
  serverNote: string | null;
  chooseServer: (choice: ServerChoice) => void;
  /** The phone's voices; null while Auto's server voice is chosen. */
  phone: PhonePart | null;
  choose: (voice: string | null) => void;
  sound: SoundPart;
  resetHint: string;
  slide: (key: SoundKey, value: number) => void;
  release: (key: SoundKey, value: number) => void;
  reset: () => void;
}>;

type Moving = Readonly<Partial<Record<SoundKey, number>>>;

/** The voices for the language: read on open and on each return to the front. */
function useVoiceChoices(language: string): readonly VoiceChoice[] {
  const [choices, setChoices] = useState<readonly VoiceChoice[]>(NO_CHOICES);
  useEffect(() => {
    let alive = true;
    const load = (): void => {
      voiceOut.choicesFor(language).then(
        (next) => {
          if (alive) setChoices(next);
        },
        (error: unknown) => logger.warn('[voice] the voice list did not load', error),
      );
    };
    load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, [language]);
  return choices;
}

/**
 * The sample line in a setting's voice, in its language (the server's voice when it offers one for
 * it and it is chosen); stopped, and the speaker let go, when the screen goes.
 */
function useSample(phone: string, all: ServerVoicesState): (saved: VoiceSetting) => void {
  const { discovery, client } = useAppSession();
  const player = useMemo(() => createSamplePlayer(voiceOut, VOICE_SETTINGS_COPY.sample), []);
  useEffect(() => {
    const unlisten = voiceOut.listen(() => undefined);
    return () => {
      player.stop();
      unlisten();
    };
  }, [player]);
  return useCallback(
    (saved: VoiceSetting) => {
      const { language, voices, setting } = spokenLanguage(saved, phone, all);
      const server = serverSpeechFor({ discovery, setting, voices, client });
      void player.play(language, setting, server);
    },
    [player, phone, all, discovery, client],
  );
}

function phonePart(
  voices: ServerVoicesState,
  setting: VoiceSetting,
  choices: readonly VoiceChoice[],
  language: string,
): PhonePart | null {
  if (!showsPhoneVoices(voices, setting)) return null;
  return Object.freeze({
    title: screenWords(voices).phoneTitle,
    rows: voiceRows(choices, setting.voice),
    help: helpLine(PLATFORM, language),
  });
}

function without(moving: Moving, key: SoundKey): Moving {
  return Object.freeze(
    Object.fromEntries(Object.entries(moving).filter(([name]) => name !== key)),
  ) as Moving;
}

/** Saves a setting and plays the sample with it; saves a choice for `language`'s voice alone. */
function useSave(phone: string, all: ServerVoicesState, language: string) {
  const play = useSample(phone, all);
  const save = useCallback(
    (next: VoiceSetting) => {
      voiceSetting.set(next);
      play(voiceSetting.get());
    },
    [play],
  );
  /** The language's saved choice (not as spoken: a default the list resolves is never written). */
  const mine = (): VoiceSetting => settingForLanguage(voiceSetting.get(), language);
  const keep = (chosen: VoiceSetting): void =>
    save(withLanguageVoice(voiceSetting.get(), language, chosen));
  return { save, mine, keep };
}

export function useVoiceSettings(): VoiceSettingsView {
  const phone = usePhoneLocale();
  const saved = useVoiceSetting();
  const all = useServerVoices(true);
  const { language, voices, setting } = spokenLanguage(saved, phone, all);
  const choices = useVoiceChoices(language);
  const { save, mine, keep } = useSave(phone, all, language);
  const [moving, setMoving] = useState<Moving>({});
  const words = screenWords(voices);
  return {
    lede: words.lede,
    languages: languageRows(saved, phone),
    languageNote: languageNote(PLATFORM, saved, phone),
    chooseLanguage: (choice) => save(withSpeakChoice(voiceSetting.get(), choice)),
    server: serverVoiceRows(voices, setting, hasServerDefault(language)),
    serverNote: serverNote(language, voices.kind !== 'off'),
    chooseServer: (choice) => keep(withServerChoice(mine(), choice)),
    phone: phonePart(voices, setting, choices, language),
    choose: (voice) => keep({ ...mine(), voice }),
    sound: soundPart(voices, { ...setting, ...moving }),
    resetHint: defaultsToServer(language) ? words.resetHint : VOICE_SETTINGS_COPY.resetHint,
    slide: (key, value) =>
      setMoving((now) => Object.freeze({ ...now, [key]: settleValue(value, LIMITS[key]) })),
    release: (key, value) => {
      setMoving((now) => without(now, key));
      save({ ...voiceSetting.get(), [key]: value });
    },
    reset: () => save(resetLanguage(voiceSetting.get(), language)),
  };
}
