// Candy's floating tab bar (CANDY-LAYOUT §4; P1, P3, P4; the kit's frame/tab-bar.tsx at
// 3920359d5): a window-filled pill 18 pt from each side and 22 pt above the bottom inset, under the
// palette's tinted shadow, holding Today, Chat, the voice control it is given (raised 18 pt in a
// 64 pt white surround with a 3 pt accent ring drawn behind it, never over it, so its own caption
// and Stop show as it draws them), Shelf and Team. Each tab is a circle with its dot over its word,
// a tab for VoiceOver with its selected state; the view on screen fills with the accent.
// tabBarMetrics (tab-bar.ts) sizes it for the phone's text size: a tab never wider than its column
// nor under 44 pt, its word free to wrap, so the bar grows taller and never wider; its height counts
// the lines the words wrap to (tabWordLines), so the room the home keeps is the bar's own. The bar
// keeps room above its pill for the raised voice (voiceOver), so the voice lies inside the bar's own
// box and takes a touch at every point. The home places the bar and pads its views by tabBarSpace.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../../ui';
import { candyTabLabel } from '../../typeface/candy-type';
import { CANDY_COPY } from '../strings';
import {
  CANDY_TABS,
  TAB_BAR,
  VOICE_SURROUND,
  tabBarMetrics,
  tabPaint,
  voiceOver,
  type CandyTab,
  type TabBarMetrics,
} from './tab-bar';
import { useCandyPaint } from './use-candy-paint';

const LABEL = candyTabLabel();
const PRESSED_OPACITY = 0.7;

export type TabBarProps = {
  /** The view on screen (selected); null when it is none of the four. */
  readonly active: CandyTab | null;
  readonly onSelect: (tab: CandyTab) => void;
  /** The voice control for the raised centre (the home's hold to talk); none for a viewer. */
  readonly children?: ReactNode;
};

type TabProps = {
  readonly tab: CandyTab;
  readonly active: CandyTab | null;
  readonly metrics: TabBarMetrics;
  readonly over: number;
  readonly onSelect: (tab: CandyTab) => void;
};

function Tab({ tab, active, metrics, over, onSelect }: TabProps) {
  const { vars } = useCandyPaint();
  const paint = tabPaint(tab, active);
  const word = CANDY_COPY.tabs[tab];
  const { width, minHeight, radius } = metrics.item;
  return (
    <View style={[styles.column, { paddingTop: over + TAB_BAR.padV }]}>
      <Pressable
        onPress={() => onSelect(tab)}
        accessibilityRole="tab"
        accessibilityLabel={word}
        accessibilityState={{ selected: tab === active }}
        style={({ pressed }) => [
          styles.item,
          { width, minHeight, borderRadius: radius, opacity: pressed ? PRESSED_OPACITY : 1 },
          paint.fill ? { backgroundColor: vars[paint.fill] } : null,
        ]}
      >
        <View style={[styles.dot, { backgroundColor: vars[paint.dot] }]} />
        <Text style={[LABEL, styles.word, { color: vars[paint.ink] }]}>{word}</Text>
      </Pressable>
    </View>
  );
}

/** The raised centre: the surround behind, the control on top, centred 18 pt over the pill's middle. */
function Voice({ over, children }: { readonly over: number; readonly children?: ReactNode }) {
  const { vars } = useCandyPaint();
  const place = { marginTop: over / 2 - TAB_BAR.raise - VOICE_SURROUND / 2 };
  return (
    <View pointerEvents="box-none" style={styles.centre}>
      {children ? (
        <View pointerEvents="box-none" style={[styles.voice, place]}>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.surround, { backgroundColor: vars.win, borderColor: vars.accent }]}
          />
          {children}
        </View>
      ) : null}
    </View>
  );
}

export function TabBar({ active, onSelect, children }: TabBarProps) {
  const { vars, round, shadow } = useCandyPaint();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const metrics = tabBarMetrics(fontScale, width);
  const over = voiceOver(metrics);
  const [today, chat, shelf, team] = CANDY_TABS;
  const tab = (id: CandyTab) => (
    <Tab tab={id} active={active} metrics={metrics} over={over} onSelect={onSelect} />
  );
  return (
    <View pointerEvents="box-none" style={[styles.frame, { bottom: insets.bottom + TAB_BAR.bottom }]}>
      <View
        pointerEvents="none"
        style={[styles.pill, { top: over, borderRadius: round, backgroundColor: vars.win }, shadow]}
      />
      <View
        accessibilityRole="tablist"
        accessibilityLabel={CANDY_COPY.tabsLabel}
        pointerEvents="box-none"
        style={[styles.row, { minHeight: over + metrics.barMinHeight }]}
      >
        {tab(today)}
        {tab(chat)}
        <Voice over={over}>{children}</Voice>
        {tab(shelf)}
        {tab(team)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', left: TAB_BAR.side, right: TAB_BAR.side },
  pill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  row: { flexDirection: 'row', paddingHorizontal: TAB_BAR.padH },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: TAB_BAR.padV,
  },
  item: { alignItems: 'center', justifyContent: 'center', gap: TAB_BAR.gap },
  dot: { width: TAB_BAR.dot, height: TAB_BAR.dot, borderRadius: TAB_BAR.dot / 2 },
  word: { textAlign: 'center' },
  centre: { width: TAB_BAR.centre, alignItems: 'center' },
  voice: {
    position: 'absolute',
    top: '50%',
    left: (TAB_BAR.centre - VOICE_SURROUND) / 2,
    width: VOICE_SURROUND,
    height: VOICE_SURROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surround: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: VOICE_SURROUND,
    height: VOICE_SURROUND,
    borderRadius: VOICE_SURROUND / 2,
    borderWidth: TAB_BAR.ring,
  },
});
