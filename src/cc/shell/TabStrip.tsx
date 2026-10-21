// The sticky tabs (handoff §2): Board · Calendar · Questions · Deliverables with a mono figure beside
// each word, the active one in ink over the accent rule. They sit above the tab's screen, so they
// never scroll away; the row scrolls sideways when large text makes it wider than the phone. A tab
// replaces the screen under the shell (no history of tab switches to step back through).

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { hitSlopFor } from '../../ui/paint';
import { SHELL_COPY } from '../strings';
import { TAB_STRIP, tabPaint } from './chrome';
import { tabViews, type CcTab, type TabCounts, type TabView } from './tabs';

function Tab({ view, onPress }: { readonly view: TabView; readonly onPress: () => void }) {
  const { colours, spacing } = useTokens();
  const { color, rule } = tabPaint(colours, view.selected);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlopFor(TAB_STRIP.height)}
      accessibilityRole="tab"
      accessibilityLabel={view.accessibilityLabel}
      accessibilityState={{ selected: view.selected }}
      style={[
        styles.tab,
        {
          minHeight: TAB_STRIP.height,
          gap: spacing[TAB_STRIP.countGap],
          borderBottomWidth: TAB_STRIP.rule,
          borderBottomColor: rule,
        },
      ]}
    >
      <Text level={TAB_STRIP.level} weight={TAB_STRIP.weight} style={{ color }}>
        {view.word}
      </Text>
      {view.count === null ? null : (
        <Text variant="mono" tone="muted">
          {view.count}
        </Text>
      )}
    </Pressable>
  );
}

export type TabStripProps = { readonly active: CcTab; readonly counts: TabCounts };

export function TabStrip({ active, counts }: TabStripProps) {
  const router = useRouter();
  const { colours, spacing } = useTokens();
  return (
    <View
      style={{
        backgroundColor: colours[TAB_STRIP.ground],
        borderBottomColor: colours[TAB_STRIP.border],
        borderBottomWidth: TAB_STRIP.ruleWidth,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={SHELL_COPY.tabsLabel}
        contentContainerStyle={{
          gap: spacing[TAB_STRIP.gap],
          paddingHorizontal: spacing[TAB_STRIP.paddingX],
        }}
      >
        {tabViews(active, counts).map((view) => (
          <Tab
            key={view.tab}
            view={view}
            onPress={() => {
              if (!view.selected) router.replace(view.href);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { flexDirection: 'row', alignItems: 'center' },
});
