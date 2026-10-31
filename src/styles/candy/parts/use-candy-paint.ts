// What Candy's parts paint with, in React: the look on screen (Blush outside Candy, so a part drawn
// in a preview or another style's test still paints), its palette's variables, the style's type,
// the look's corners (rs) and its shadow. Every part reads its colours here or from
// tokens/candy-paint.ts, never a literal (D-TOKENS).

import { useMemo } from 'react';

import { useStyle } from '../../theme';
import { candyRadii, candyShadow, candyVars, type CandyShadow, type CandyVars } from '../../tokens/candy';
import type { StyleType } from '../../typeface/types';
import { CANDY_DEFAULT_LOOK, type CandyLook } from '../look-schema';

export type CandyPaint = {
  readonly look: CandyLook;
  readonly vars: CandyVars;
  readonly type: StyleType;
  /** The phone's cards, tiles and windows: round(r × 0.72). */
  readonly rs: number;
  /** Pills and the tab bar: fully round. */
  readonly round: number;
  readonly shadow: CandyShadow;
};

export function useCandyPaint(): CandyPaint {
  const style = useStyle();
  return useMemo(() => {
    const look = style.candyLook ?? CANDY_DEFAULT_LOOK;
    const radii = candyRadii(look);
    return {
      look,
      vars: style.candy ?? candyVars(look),
      type: style.type,
      rs: radii.card,
      round: radii.pill,
      shadow: candyShadow(look),
    };
  }, [style.candyLook, style.candy, style.type]);
}
