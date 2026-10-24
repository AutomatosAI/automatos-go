// The sticky tabs (handoff §2): Board · Calendar · Questions · Deliverables with a mono figure beside
// each word, the active one in ink over the accent rule. They sit above the tab's screen, so they
// never scroll away; the row scrolls sideways when large text makes it wider than the phone. A tap is
// decided from the live path (tabs.ts pressTab): a tab goes back to its screen or takes the live
// screen's place, so there is no history of tab switches to step back through, and Board from a
// detail opened from chat reaches the Board. A5 dresses the tabs per style (src/styles/dress/
// cc-dress.ts): the rule in the look's accent under Play and HUD, HUD's words in Geist Mono capitals,
// and the strip clear over Play's glow and HUD's grid.

import { usePathname, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { shellGround, shellTabPaint, type ShellTabs } from '../../styles/dress/cc-dress';
import { useShellDress } from '../../styles/dress/use-cc-dress';
import { useDress } from '../../styles/dress/use-dress';
import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { hitSlopFor } from '../../ui/paint';
import { SHELL_COPY } from '../strings';
import { TAB_STRIP } from './chrome';
import { pressTab, tabViews, type CcTab, type TabCounts, type TabView } from './tabs';

type TabProps = {
  readonly view: TabView;
  readonly tabs: ShellTabs;
  readonly onPress: () => void;
};

function Tab({ view, tabs, onPress }: TabProps) {
  const { colours, spacing } = useTokens();
  const { color, rule } = shellTabPaint(colours, tabs, view.selected);
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
          paddingHorizontal: tabs.tabPaddingX,
          borderBottomWidth: TAB_STRIP.rule,
          borderBottomColor: rule,
        },
      ]}
    >
      <Text level={TAB_STRIP.level} weight={TAB_STRIP.weight} style={[tabs.face, { color }]}>
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

/** `active` is the tab shown, or null for a detail with no tab under it. */
export type TabStripProps = { readonly active: CcTab | null; readonly counts: TabCounts };

export function TabStrip({ active, counts }: TabStripProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { colours } = useTokens();
  const { tabs } = useShellDress();
  const dress = useDress();
  return (
    <View
      style={{
        backgroundColor: shellGround(dress, colours[TAB_STRIP.ground]),
        borderBottomColor: colours[TAB_STRIP.border],
        borderBottomWidth: TAB_STRIP.ruleWidth,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={SHELL_COPY.tabsLabel}
        contentContainerStyle={{ gap: tabs.gap, paddingHorizontal: tabs.stripPaddingX }}
      >
        {tabViews(active, counts, pathname).map((view) => (
          <Tab key={view.tab} view={view} tabs={tabs} onPress={() => pressTab(view, router)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { flexDirection: 'row', alignItems: 'center' },
});
