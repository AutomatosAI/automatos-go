// The style provider's two contexts. StyleRootContext is the app's, set once by ThemeProvider
// (theme.tsx): the one store, the inputs the app's style resolves from and the crossfade a flip
// plays. StyleContext is the ResolvedStyle a subtree paints: the app's, or a StyleScope's own for
// a preview. useStyle(), useLayout() and useTokens() in theme.tsx read the nearest one.

import { createContext, useContext } from 'react';
import { useStore } from 'zustand';

import type { ResolvedStyle, StyleInput } from './resolve';
import type { StyleStore, StyleStoreApi } from './store';

/** Runs swap under a crossfade of durationMs (0: at once); Crossfade.tsx draws it. */
export type RunCrossfade = (swap: () => void, durationMs: number) => void;

export type StyleRoot = {
  readonly store: StyleStoreApi;
  /** What the app's style is resolved from (a StyleScope swaps the choice and the look). */
  readonly input: StyleInput;
  readonly crossfade: RunCrossfade;
};

export const StyleRootContext = createContext<StyleRoot | null>(null);

export const StyleContext = createContext<ResolvedStyle | null>(null);

export function useStyleRoot(): StyleRoot {
  const root = useContext(StyleRootContext);
  if (!root) throw new Error('the style hooks must be used within ThemeProvider');
  return root;
}

/** A slice of the app's style store (the look pages, the sync components); re-renders on change. */
export function useStyleStore<Slice>(select: (state: StyleStore) => Slice): Slice {
  return useStore(useStyleRoot().store, select);
}
