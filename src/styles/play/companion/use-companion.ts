// The Companion's paint in React: the resolved style's Play variables, the lines
// tokens/companion-colours.ts derives from them, Ember's text-3 (the look's faded meta text) and
// whether loops may run (Reduce Motion stops the spinner, the caret and the rise). Null outside
// Play: the Companion is Play's layout, so a piece rendered elsewhere draws nothing.

import { useMemo } from 'react';

import type { ResolvedStyle } from '../../provider/resolve';
import { useStyle } from '../../theme';
import { companionColours } from '../../tokens/companion-colours';
import type { CompanionColourSource } from './paint';

export type CompanionPaint = CompanionColourSource & {
  readonly style: ResolvedStyle;
  readonly loops: boolean;
};

export function useCompanionPaint(): CompanionPaint | null {
  const style = useStyle();
  return useMemo(() => {
    if (!style.play) return null;
    return {
      vars: style.play,
      lines: companionColours(style.play),
      text3: style.tokens.colours.fg3,
      style,
      loops: style.motion.loops,
    };
  }, [style]);
}
