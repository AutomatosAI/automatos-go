// The flip (PRD-001 §4.6, D54): setStyle(choice) plays flip-plan.ts's plan — one selection tap
// (expo-haptics, in the binary since the scaffold), the choice stored on the phone (MMKV) and the
// whole app crossfaded into the new style over 180 ms (Crossfade.tsx; at once under Reduce
// Motion); a flip that enters Play also counts Auto's hello (the store's playEntries, read by the
// mascot as one 'app-open'). A flip to the choice already stored does nothing. Picking an
// installed theme also hands the store that theme's painting from the last read (US-016i), in the
// same swap, so the theme arrives in one crossfade.

import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

import { logger } from '../../lib/logger';
import type { PhoneChoice } from '../registry/style-id';
import { paintForChoice } from '../themes/plan';
import { useStyleRoot } from './context';
import { phoneFlipPlan } from './flip-plan';
import type { StyleStoreApi } from './store';

export type SetStyle = (choice: PhoneChoice) => void;

/** Stores the choice, with the painting it needs when it paints an installed theme. */
function storeChoice(store: StyleStoreApi, choice: PhoneChoice, hello: boolean): void {
  const state = store.getState();
  const paint = paintForChoice(choice, state.followed, state.themes);
  if (paint && paint.installId !== state.themePaint?.installId) state.setThemePaint(paint);
  state.setChoice(choice, { hello });
}

/** setStyle for the picker's cards (US-016h) and anything else that flips the phone's style. */
export function useSetStyle(): SetStyle {
  const { store, input, crossfade } = useStyleRoot();
  const { reduceMotion } = input;
  return useCallback(
    (choice: PhoneChoice) => {
      const state = store.getState();
      const plan = phoneFlipPlan(state.choice, choice, state.followed, reduceMotion);
      if (!plan.changed) return;
      Haptics.selectionAsync().catch((error: unknown) =>
        logger.warn('[styles] style haptic failed', error),
      );
      crossfade(() => storeChoice(store, plan.choice, plan.hello), plan.crossfadeMs);
    },
    [store, reduceMotion, crossfade],
  );
}
