// A text field's caret and selection, on Android. Android paints selectionColor as the highlight
// itself, behind the selected words, so it is a wash of the accent that keeps those words readable;
// the caret and the handles are the accent that reads (accent.ts).

import type { Colours } from '../styles/tokens';
import { accentInk } from './accent';
import { tint } from './paint';
import type { SelectionProps } from './selection';

/** How much of the accent lies behind selected words. */
export const SELECTION_WASH = 0.3;

export function selectionProps(colours: Colours): SelectionProps {
  const ink = accentInk(colours);
  return {
    selectionColor: tint(ink, SELECTION_WASH),
    cursorColor: ink,
    selectionHandleColor: ink,
  };
}
