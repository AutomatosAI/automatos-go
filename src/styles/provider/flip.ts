// The flip (PRD-001 §4.6, D54): setStyle(choice) plays flip-plan.ts's plan — one selection tap
// (expo-haptics, in the binary since the scaffold), the choice stored on the phone (MMKV) and the
// whole app crossfaded into the new style over 180 ms (Crossfade.tsx; at once under Reduce
// Motion); a flip that enters Play also counts Auto's hello (the store's playEntries, read by the
// mascot as one 'app-open'). A flip to the style already shown does nothing.

import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

import { logger } from '../../lib/logger';
import type { StyleChoice } from '../registry/style-id';
import { useStyleRoot } from './context';
import { flipPlan } from './flip-plan';

export type SetStyle = (choice: StyleChoice) => void;

/** setStyle for the picker's cards (US-016h) and anything else that flips the phone's style. */
export function useSetStyle(): SetStyle {
  const { store, input, crossfade } = useStyleRoot();
  const { reduceMotion } = input;
  return useCallback(
    (choice: StyleChoice) => {
      const plan = flipPlan(store.getState().choice, choice, reduceMotion);
      if (!plan.changed) return;
      Haptics.selectionAsync().catch((error: unknown) =>
        logger.warn('[styles] style haptic failed', error),
      );
      crossfade(() => {
        store.getState().setChoice(plan.choice, { hello: plan.hello });
      }, plan.crossfadeMs);
    },
    [store, reduceMotion, crossfade],
  );
}
