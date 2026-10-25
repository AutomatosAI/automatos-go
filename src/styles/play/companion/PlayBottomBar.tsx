// Play's bottom bar on Conversations and the Shelf (Ember 03-04, KS10): 'Chats' · 'Shelf' ·
// 'Centre' over a 1 pt line of the ground's text at 0.08; each place 48 high and at least 96 wide,
// the one you are on in Geist 600 14 with a 6 pt accent dot, the others Geist 500 14 in text2.
// Centre is the Command Centre and carries the foundation's CountBadge with the server's one
// needs-you number (useNeedsYou), so it cannot disagree with any other counter.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useNeedsYou } from '../../../api/needs-you';
import { CountBadge, Text } from '../../../ui';
import { COMPANION, PLAY_TAB_ROUTES, tabViews, type PlayTab, type TabView } from './model';
import { useCompanionPaint, type CompanionPaint } from './use-companion';

export type PlayBottomBarProps = {
  /** The place on screen. */
  readonly active: PlayTab;
};

const { bar } = COMPANION;

type TabProps = {
  readonly view: TabView;
  readonly paint: CompanionPaint;
  readonly onPress: () => void;
};

function Tab({ view, paint, onPress }: TabProps) {
  const { vars, style } = paint;
  const face = style.type.body(bar.size, view.selected ? 600 : 500);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={view.label}
      accessibilityState={{ selected: view.selected }}
      style={({ pressed }) => [
        styles.tab,
        {
          gap: style.tokens.spacing.space3,
          opacity: pressed && !view.selected ? COMPANION.pressedOpacity : 1,
        },
      ]}
    >
      {view.selected ? (
        <View
          style={{
            width: bar.dot,
            height: bar.dot,
            borderRadius: bar.dot / 2,
            backgroundColor: vars.accent,
          }}
        />
      ) : null}
      <Text style={[face, { color: view.selected ? vars.groundText : vars.groundText2 }]}>
        {view.text}
      </Text>
      <CountBadge count={view.count} />
    </Pressable>
  );
}

export function PlayBottomBar({ active }: PlayBottomBarProps) {
  const paint = useCompanionPaint();
  const router = useRouter();
  const { total } = useNeedsYou();
  if (!paint) return null;
  const { spacing } = paint.style.tokens;
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          paddingHorizontal: spacing.space5,
          paddingTop: spacing.space3,
          borderTopColor: paint.lines.headerLine,
        },
      ]}
    >
      {tabViews(active, total).map((view) => (
        <Tab
          key={view.tab}
          view={view}
          paint={paint}
          onPress={() => {
            if (!view.selected) router.navigate(PLAY_TAB_ROUTES[view.tab]);
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1 },
  tab: {
    minHeight: bar.itemHeight,
    minWidth: bar.itemMinWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
