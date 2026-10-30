// The theme for the whole app (PRD-001 §4.6, D59): ThemeProvider holds the phone's Light / Dark /
// System choice and hands every layout its tokens through useTokens(). System follows the phone's
// appearance (useColorScheme re-renders on a change); a fixed choice is also set on the windows
// (Appearance.setColorScheme) so the keyboard, alerts and pickers match the app. The choice lives
// in the encrypted MMKV store; the logic is in theme-choice.ts with its tests.
//
// A5 (D54-D59) adds the phone's style beside it: the one style store (provider/store.ts: the style
// choice, Play's, HUD's and Arcade's looks, the cached theme painting, read from MMKV before the
// first frame, so a phone on Play never flashes Studio at launch), resolved by provider/resolve.ts
// into the ResolvedStyle useStyle() returns. useTokens() keeps its type and returns that style's
// tokens, so every screen repaints the moment the style flips (provider/flip.ts, crossfaded by
// provider/Crossfade.tsx). Light / Dark / System still drive Studio; Play paints its look's tone,
// HUD is always dark and Arcade paints its palette's tone. StyleScope (provider/StyleScope.tsx)
// paints a preview in another style.
// US-016i: the phone's choice may be 'Same as Studio' (the default), which paints what the
// workspace's active theme maps to (the store's followed, kept by ThemeSync); the cached theme
// painting's fonts are loaded here from their copies on the phone (themes/fonts.ts), so a theme's
// faces need no session at launch.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { useStore } from 'zustand';

import type { KeyValueStorage } from '../storage/encrypted-storage';
import { appStorage } from '../storage/mmkv';
import { paintedChoice, type Layout } from './registry/style-id';
import { StyleContext, StyleRootContext, type StyleRoot } from './provider/context';
import { CrossfadeRoot, useCrossfade } from './provider/Crossfade';
import { useReduceMotion } from './provider/reduce-motion';
import { resolveStyle, type ResolvedStyle, type StyleInput } from './provider/resolve';
import { appStyleSources, createStyleStore, type StyleStoreApi } from './provider/store';
import { useThemeFontLoader } from './themes/fonts';
import {
  appearanceOverride,
  readThemeChoice,
  resolveScheme,
  saveThemeChoice,
  type ThemeChoice,
} from './theme-choice';
import type { ColourScheme, Tokens } from './tokens';

export type Theme = {
  readonly choice: ThemeChoice;
  readonly scheme: ColourScheme;
  readonly tokens: Tokens;
  readonly setChoice: (choice: ThemeChoice) => void;
};

const ThemeContext = createContext<Theme | null>(null);

type ThemeProviderProps = {
  readonly children: ReactNode;
  /** The store for the choice; the app's encrypted MMKV store when omitted. */
  readonly storage?: KeyValueStorage;
};

/** The parts of the style store the app's style is resolved from, each its own subscription. */
function useStyleParts(store: StyleStoreApi) {
  const phoneChoice = useStore(store, (state) => state.choice);
  const followed = useStore(store, (state) => state.followed);
  const playLook = useStore(store, (state) => state.playLook);
  const hudLook = useStore(store, (state) => state.hudLooks.active);
  const arcadeLook = useStore(store, (state) => state.arcadeLooks.active);
  const themePaint = useStore(store, (state) => state.themePaint);
  const themeFonts = useStore(store, (state) => state.themeFonts);
  const choice = useMemo(() => paintedChoice(phoneChoice, followed), [phoneChoice, followed]);
  return { choice, playLook, hudLook, arcadeLook, themePaint, themeFonts };
}

export function ThemeProvider({ children, storage }: ThemeProviderProps) {
  const store = useMemo(() => storage ?? appStorage(), [storage]);
  const [choice, setChoiceState] = useState<ThemeChoice>(() => readThemeChoice(store));
  const system = useColorScheme();
  const styleStore = useMemo(() => createStyleStore(appStyleSources(() => store)), [store]);
  const {
    choice: styleChoice,
    playLook,
    hudLook,
    arcadeLook,
    themePaint,
    themeFonts,
  } = useStyleParts(styleStore);
  const reduceMotion = useReduceMotion();
  const crossfade = useCrossfade();
  useThemeFontLoader(styleStore);

  useEffect(() => {
    Appearance.setColorScheme(appearanceOverride(choice));
  }, [choice]);

  const setChoice = useCallback(
    (next: ThemeChoice) => {
      saveThemeChoice(store, next);
      setChoiceState(next);
    },
    [store],
  );

  const input = useMemo<StyleInput>(
    () => ({
      choice: styleChoice,
      studioScheme: choice,
      systemScheme: system,
      playLook,
      hudLook,
      arcadeLook,
      themePaint,
      themeFonts,
      reduceMotion,
    }),
    [
      styleChoice,
      choice,
      system,
      playLook,
      hudLook,
      arcadeLook,
      themePaint,
      themeFonts,
      reduceMotion,
    ],
  );
  const style = useMemo(() => resolveStyle(input), [input]);
  const root = useMemo<StyleRoot>(
    () => ({ store: styleStore, input, crossfade: crossfade.run }),
    [styleStore, input, crossfade.run],
  );

  const theme = useMemo<Theme>(() => {
    const scheme = resolveScheme(choice, system);
    return { choice, scheme, tokens: style.tokens, setChoice };
  }, [choice, system, style.tokens, setChoice]);

  return (
    <ThemeContext.Provider value={theme}>
      <StyleRootContext.Provider value={root}>
        <StyleContext.Provider value={style}>
          <CrossfadeRoot layer={crossfade.layer}>{children}</CrossfadeRoot>
        </StyleContext.Provider>
      </StyleRootContext.Provider>
    </ThemeContext.Provider>
  );
}

/** The choice, the scheme it resolves to and the setter (the Style and look page). */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used within ThemeProvider');
  return theme;
}

/** The style this subtree paints: the app's, or the nearest StyleScope's. */
export function useStyle(): ResolvedStyle {
  const style = useContext(StyleContext);
  if (!style) throw new Error('useStyle must be used within ThemeProvider');
  return style;
}

/** The layout this subtree paints: 'studio' (an installed theme too), 'play' or 'hud'. */
export function useLayout(): Layout {
  return useStyle().layout;
}

/** The tokens every layout reads: colours, radii, spacing, shadows and type. */
export function useTokens(): Tokens {
  return useStyle().tokens;
}
