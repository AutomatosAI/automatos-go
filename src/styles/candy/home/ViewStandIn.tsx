// CANDY_STAND_IN US-023j: the home's Chat, Shelf and Team views until US-023h, US-023i and US-023j
// build them (each story stops using its own; US-023j, the last, deletes this file). Each is the page
// with its band, its title (the tab's word) and a line in Candy's words. The Chat view has the way
// back (the P2 mock has no tab bar: on a conversation's route, its Back; else Today) and takes Report
// this for Auto's bubbles to come; it shows no thread yet, so no AI label (that opens the thread).

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ThreadReport } from '../../../chat/report/report';
import { Text } from '../../../ui';
import { Band } from '../parts/Band';
import { PAGE_GUTTER } from '../parts/orb-model';
import { Pill } from '../parts/Pill';
import { useCandyPaint } from '../parts/use-candy-paint';
import {
  CANDY_CHAT_SOON_COPY,
  CANDY_COPY,
  CANDY_SHELF_SOON_COPY,
  CANDY_TEAM_SOON_COPY,
} from '../strings';
import { MenuCircle, type MenuCircleProps } from './MenuCircle';

const SOON = Object.freeze({ band: 300, top: 8, gap: 12 });

type SoonProps = {
  readonly title: string;
  readonly message: string;
  /** The room the floating tab bar takes at the view's foot (none on Chat). */
  readonly footRoom?: number;
  readonly children?: ReactNode;
};

function Soon({ title, message, footRoom = 0, children }: SoonProps) {
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

export type ChatStandInProps = {
  /** Report this on Auto's bubbles: the Chat view takes it (US-023h). */
  readonly report: ThreadReport;
  /** The way back: the conversation route's Back, or Today in place. */
  readonly onBack: () => void;
};

export function ChatStandIn({ onBack }: ChatStandInProps) {
  return (
    <Soon title={CANDY_COPY.tabs.chat} message={CANDY_CHAT_SOON_COPY.message}>
      <View style={styles.back}>
        <Pill label={CANDY_CHAT_SOON_COPY.back} onPress={onBack} />
      </View>
    </Soon>
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
  back: { alignSelf: 'flex-start' },
  menu: { alignSelf: 'flex-end' },
});
