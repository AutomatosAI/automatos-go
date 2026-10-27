// The language hold to talk listens in and Auto speaks, on a screen (27 Oct 2026): the saved "I
// speak" (use-voice-setting.ts, so a change re-renders every reader) over the phone's first locale,
// read once per screen. Only wiring: the rules are speak-language.ts's.

import { useMemo } from 'react';

import { phoneLocale } from '../quick-ask/locale';
import { useVoiceSetting } from '../settings/use-voice-setting';
import { listeningLocale } from './speak-language';

/** The phone's first locale, read once per screen. */
export function usePhoneLocale(): string {
  return useMemo(() => phoneLocale(), []);
}

/** The locale hold to talk listens in ("I speak"), and the phone's own. */
export function useListening(): { readonly listening: string; readonly phone: string } {
  const setting = useVoiceSetting();
  const phone = usePhoneLocale();
  return { listening: listeningLocale(setting, phone), phone };
}
