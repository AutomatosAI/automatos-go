// The theme for the whole app (PRD-001 §4.6, D59): ThemeProvider holds the phone's Light / Dark /
// System choice and hands every layout its tokens through useTokens(). System follows the phone's
// appearance (useColorScheme re-renders on a change); a fixed choice is also set on the windows
// (Appearance.setColorScheme) so the keyboard, alerts and pickers match the app. The choice lives
// in the encrypted MMKV store; the logic is in theme-choice.ts with its tests. Studio is the only
// style in this wave; A5 adds the style choice beside this one.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import type { KeyValueStorage } from '../storage/encrypted-storage';
import { appStorage } from '../storage/mmkv';
import {
  appearanceOverride,
  readThemeChoice,
  resolveScheme,
  saveThemeChoice,
  type ThemeChoice,
} from './theme-choice';
import { tokensFor, type ColourScheme, type Tokens } from './tokens';

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

export function ThemeProvider({ children, storage }: ThemeProviderProps) {
  const store = useMemo(() => storage ?? appStorage(), [storage]);
  const [choice, setChoiceState] = useState<ThemeChoice>(() => readThemeChoice(store));
  const system = useColorScheme();

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

  const theme = useMemo<Theme>(() => {
    const scheme = resolveScheme(choice, system);
    return { choice, scheme, tokens: tokensFor('studio', scheme), setChoice };
  }, [choice, system, setChoice]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** The choice, the scheme it resolves to and the setter (the Style and look page). */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used within ThemeProvider');
  return theme;
}

/** The tokens every layout reads: colours, radii, spacing, shadows and type. */
export function useTokens(): Tokens {
  return useTheme().tokens;
}
