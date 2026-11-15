// HUD's core folded away on HUD's home (15 Nov 2026): the person's choice to hide the rings and Auto
// for more room for the transcript, kept on the phone in the app's encrypted MMKV store under
// 'styles.hud.coreFolded', beside HUD's looks, and held by the style store (provider/store.ts) so it
// survives a relaunch. Stored as Arcade's and Candy's pause flags are (arcade/motion-pause.ts's
// keyed flag: only 'true' is folded; a store that fails is logged, a failed read shows the core, a
// failed write keeps the choice for this launch). Folded, nothing in the core moves, so the fold is
// also the home's way to stop it (WCAG 2.2.2: pause, stop or hide). Pure over the KeyValueStorage
// port: no React, React Native, Expo or Skia.

import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { keyedMotionPause, type MotionPauseSource } from '../arcade/motion-pause';
import { HUD_CORE_COPY } from '../strings';

/** The MMKV key (beside styles.hud.looks). */
export const HUD_CORE_FOLDED_KEY = 'styles.hud.coreFolded';

const HUD_CORE_FOLD = keyedMotionPause(HUD_CORE_FOLDED_KEY, "HUD's core fold");

/** HUD's fold over one store, opened on the first read or write (as the looks stores are). */
export function createHudCoreFoldSource(storage: () => KeyValueStorage): MotionPauseSource {
  return HUD_CORE_FOLD.source(storage);
}

/** HIDE AUTO's words and what VoiceOver hears, by whether the core is folded (CoreFold.tsx). */
export function foldButtonView(folded: boolean): Readonly<{ text: string; label: string }> {
  return folded
    ? Object.freeze({ text: HUD_CORE_COPY.showAuto, label: HUD_CORE_COPY.showAutoLabel })
    : Object.freeze({ text: HUD_CORE_COPY.hideAuto, label: HUD_CORE_COPY.hideAutoLabel });
}
