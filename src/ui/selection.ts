// A text field's caret and selection, on iOS (selection.android.ts is Android's): both take one
// colour, the accent that reads (accent.ts). iOS draws the caret and the handles in it and washes
// the selected words with it by itself.

import type { Colours } from '../styles/tokens';
import { accentInk } from './accent';

export type SelectionProps = {
  readonly selectionColor: string;
  readonly cursorColor?: string;
  readonly selectionHandleColor?: string;
};

export function selectionProps(colours: Colours): SelectionProps {
  return { selectionColor: accentInk(colours) };
}
