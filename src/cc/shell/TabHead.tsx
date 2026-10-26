// The Command Centre's head where it scrolls (handoff §2): the shell keeps the top bar and the tabs
// sticky, and each tab draws the head (the dateline, the title and the lede, unchanged) at the top
// of its own list, so on a 375 x 667 phone it scrolls away with the tab's content instead of
// holding ~140 pt of the screen. The shell hands the lede down (ShellHeadProvider), so its figures
// are read once; outside the shell, and where the shell steps aside (Play's Shelf), nothing shows.
// A tab that has nothing to list yet (loading, an error) shows the head over its state (TabFrame).

import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Head } from './Head';
import type { LedePart } from './lede';

const ShellLede = createContext<readonly LedePart[] | null>(null);

export type ShellHeadProviderProps = {
  /** The shell's lede; null where the shell steps aside. */
  readonly lede: readonly LedePart[] | null;
  readonly children: ReactNode;
};

export function ShellHeadProvider({ lede, children }: ShellHeadProviderProps) {
  return <ShellLede.Provider value={lede}>{children}</ShellLede.Provider>;
}

export type TabHeadProps = {
  /** The list's own side padding, which the head reaches past to the screen's edges (Calendar's). */
  readonly bleed?: number;
};

/** The head, at the top of a tab's list: what the shell drew over the tabs. */
export function TabHead({ bleed = 0 }: TabHeadProps) {
  const lede = useContext(ShellLede);
  if (!lede) return null;
  if (bleed === 0) return <Head lede={lede} />;
  return (
    <View style={{ marginHorizontal: -bleed }}>
      <Head lede={lede} />
    </View>
  );
}

/** A tab with no list yet: the head over its loading or error state. */
export function TabFrame({ children }: { readonly children: ReactNode }) {
  return (
    <View style={styles.frame}>
      <TabHead />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
});
