// What Arcade's parts paint with, in React: the look on screen (Overworld outside Arcade, so a part
// drawn in a preview or a test of another style still paints), its palette's variables, and the
// style's type. Every part reads its colours here, never a literal (D-TOKENS).

import { useMemo } from 'react';

import { useStyle } from '../../theme';
import { arcadeVars, type ArcadeVars } from '../../tokens/arcade';
import type { StyleType } from '../../typeface/types';
import { ARCADE_DEFAULT_LOOK, type ArcadeLook } from '../look-schema';

export type ArcadePaint = {
  readonly look: ArcadeLook;
  readonly vars: ArcadeVars;
  readonly type: StyleType;
};

export function useArcadePaint(): ArcadePaint {
  const style = useStyle();
  return useMemo(() => {
    const look = style.arcadeLook ?? ARCADE_DEFAULT_LOOK;
    return { look, vars: style.arcade ?? arcadeVars(look), type: style.type };
  }, [style.arcadeLook, style.arcade, style.type]);
}
