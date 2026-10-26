// Settings → Voice's wiring: the phone's voices for its language (the one quick-ask speaks in), the
// saved setting (use-voice-setting.ts), and the sample line. Only wiring: the rows and words are
// view-model.ts's, the sample's sequencing sample-player.ts's.
//   The list is read afresh when the screen opens and each time the app comes back to the front
//   (the person may have downloaded a voice in the phone's Settings, as the help line says). A list
//   that fails to load is logged where it is read (speaker-core.ts) and leaves Automatic alone.
//   A tap on a voice saves it and plays the sample in it; a tap on the chosen one plays it again.
//   A slider shows its value while dragged and saves on release, then plays the sample. Reset saves
//   the default and plays it.
//   While open, the screen holds the speaker's one listener (a voice screen beneath it hears
//   nothing of the sample); going away stops the sample, then lets the listener go.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { logger } from '../../lib/logger';
import { SPEECH_PITCH_LIMITS, SPEECH_RATE_LIMITS } from '../config';
import { phoneLocale } from '../quick-ask/locale';
import type { RecognitionPlatform } from '../quick-ask/recognition-policy';
import { speaker } from '../speech/speaker';
import { AUTOMATIC_VOICE, type VoiceChoice } from '../speech/voice-choices';
import { VOICE_SETTINGS_COPY } from '../strings';
import { createSamplePlayer } from './sample-player';
import { useVoiceSetting, voiceSetting } from './use-voice-setting';
import { DEFAULT_VOICE_SETTING, settleValue, type VoiceSetting } from './voice-setting';
import {
  helpLine,
  soundSliders,
  voiceRows,
  type SoundKey,
  type SoundSlider,
  type VoiceRow,
} from './view-model';

const PLATFORM: RecognitionPlatform = Platform.OS === 'android' ? 'android' : 'ios';
const LIMITS = Object.freeze({ rate: SPEECH_RATE_LIMITS, pitch: SPEECH_PITCH_LIMITS });
const NO_CHOICES: readonly VoiceChoice[] = Object.freeze([AUTOMATIC_VOICE]);

export type VoiceSettingsView = Readonly<{
  rows: readonly VoiceRow[];
  sliders: readonly SoundSlider[];
  help: string;
  choose: (voice: string | null) => void;
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
      speaker.choicesFor(language).then(
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

/** The sample line in a setting's voice; stopped, and the speaker let go, when the screen goes. */
function useSample(language: string): (setting: VoiceSetting) => void {
  const player = useMemo(() => createSamplePlayer(speaker, VOICE_SETTINGS_COPY.sample), []);
  useEffect(() => {
    const unlisten = speaker.listen(() => undefined);
    return () => {
      player.stop();
      unlisten();
    };
  }, [player]);
  return useCallback(
    (setting: VoiceSetting) => void player.play(language, setting),
    [player, language],
  );
}

function without(moving: Moving, key: SoundKey): Moving {
  return Object.freeze(
    Object.fromEntries(Object.entries(moving).filter(([name]) => name !== key)),
  ) as Moving;
}

export function useVoiceSettings(): VoiceSettingsView {
  const language = useMemo(() => phoneLocale(), []);
  const setting = useVoiceSetting();
  const choices = useVoiceChoices(language);
  const play = useSample(language);
  const [moving, setMoving] = useState<Moving>({});
  const save = useCallback(
    (next: VoiceSetting) => {
      voiceSetting.set(next);
      play(voiceSetting.get());
    },
    [play],
  );
  return {
    rows: voiceRows(choices, setting.voice),
    sliders: soundSliders({ ...setting, ...moving }),
    help: helpLine(PLATFORM, language),
    choose: (voice) => save({ ...voiceSetting.get(), voice }),
    slide: (key, value) =>
      setMoving((now) => Object.freeze({ ...now, [key]: settleValue(value, LIMITS[key]) })),
    release: (key, value) => {
      setMoving((now) => without(now, key));
      save({ ...voiceSetting.get(), [key]: value });
    },
    reset: () => save(DEFAULT_VOICE_SETTING),
  };
}
