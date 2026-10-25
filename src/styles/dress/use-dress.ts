// The dress a subtree wears (dress.ts): useDress() reads the nearest style (the app's, or a
// StyleScope's preview) and builds its dress once per resolved style object, so a screen's
// memoised styles hold until the style changes. InPanelContext tells a button it sits in a panel
// (HUD's buttons are 46 high there); the Card primitive provides it.

import { createContext, useContext } from 'react';

import { useStyle } from '../theme';
import { oncePerObject } from '../tokens/style-tokens';
import { dressOf, type Dress } from './dress';

const dressOfStyle = oncePerObject(dressOf);

export function useDress(): Dress {
  return dressOfStyle(useStyle());
}

export const InPanelContext = createContext(false);

/** True inside a Card (a panel); false elsewhere. */
export function useInPanel(): boolean {
  return useContext(InPanelContext);
}
