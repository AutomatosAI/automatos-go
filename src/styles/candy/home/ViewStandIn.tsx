// CANDY_STAND_IN US-023j: the home's Shelf and Team views until US-023i and US-023j build them (each
// story stops using its own; US-023j, the last, deletes this file). Each is the page with its band,
// its title (the tab's word) and a line in Candy's words.

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../../ui';
import { Band } from '../parts/Band';
import { PAGE_GUTTER } from '../parts/orb-model';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_COPY, CANDY_SHELF_SOON_COPY, CANDY_TEAM_SOON_COPY } from '../strings';
import { MenuCircle, type MenuCircleProps } from './MenuCircle';

const SOON = Object.freeze({ band: 300, top: 8, gap: 12 });

type SoonProps = {
  readonly title: string;
  readonly message: string;
  /** The room the floating tab bar takes at the view's foot. */
  readonly footRoom: number;
  readonly children?: ReactNode;
};

function Soon({ title, message, footRoom, children }: SoonProps) {
  const { vars, type } = useCandyPaint();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + SOON.top, paddingBottom: Math.max(footRoom, insets.bottom) };
  return (
    <ScrollView style={styles.view} contentContainerStyle={[styles.column, pad]}>
      <Band height={SOON.band} />
      {children}
      <Text accessibilityRole="header" style={[type.display('screen'), { color: vars.text }]}>
        {title}
      </Text>
      <Text style={[type.label, { color: vars.bandQuiet }]}>{message}</Text>
    </ScrollView>
  );
}

export type TabStandInProps = {
  readonly footRoom: number;
  /** The home menu at the top right, as on every view (D73). */
  readonly menu: MenuCircleProps;
};

export function ShelfStandIn({ footRoom, menu }: TabStandInProps) {
  return (
    <Soon title={CANDY_COPY.tabs.shelf} message={CANDY_SHELF_SOON_COPY.message} footRoom={footRoom}>
      <View style={styles.menu}>
        <MenuCircle {...menu} />
      </View>
    </Soon>
  );
}

export function TeamStandIn({ footRoom, menu }: TabStandInProps) {
  return (
    <Soon title={CANDY_COPY.tabs.team} message={CANDY_TEAM_SOON_COPY.message} footRoom={footRoom}>
      <View style={styles.menu}>
        <MenuCircle {...menu} />
      </View>
    </Soon>
  );
}

const styles = StyleSheet.create({
  view: { flex: 1 },
  column: { flexGrow: 1, paddingHorizontal: PAGE_GUTTER, gap: SOON.gap },
  menu: { alignSelf: 'flex-end' },
});
