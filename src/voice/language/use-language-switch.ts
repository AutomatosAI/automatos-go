// The EN/PT switch beside HOLD TO TALK, on a screen (27 Oct 2026): what languageSwitch says for the
// saved "I speak" (use-voice-setting.ts, so every reader hears a change at once), and the tap that
// saves the switched choice. Always there for someone who may talk, Automatic included, so one tap
// flips it from the default state; never for a viewer (HOLD TO TALK is off for them, D17). Only
// wiring: the rules are speak-language.ts's.

import { useCallback } from 'react';

import { useVoiceSetting, voiceSetting } from '../settings/use-voice-setting';
import {
  languageSwitch,
  switchedChoice,
  withSpeakChoice,
  type LanguageSwitchView,
} from './speak-language';
import { usePhoneLocale } from './use-speak-language';

export type LanguageSwitch = LanguageSwitchView & { readonly onPress: () => void };

/** The switch for someone who may talk (`shown`); undefined otherwise. */
export function useLanguageSwitch(shown: boolean): LanguageSwitch | undefined {
  const setting = useVoiceSetting();
  const phone = usePhoneLocale();
  const onPress = useCallback(() => {
    const saved = voiceSetting.get();
    voiceSetting.set(withSpeakChoice(saved, switchedChoice(saved, phone)));
  }, [phone]);
  if (!shown) return undefined;
  return { ...languageSwitch(setting, phone), onPress };
}
