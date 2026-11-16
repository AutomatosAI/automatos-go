// The one tab bar (the app standard's rule 5.4, decision D3): drawn from the tokens, never the
// system's, and mounted as the router's own `tabBar` renderer (expo-router's Tabs, through
// src/shell/AppTabs.tsx), so the router still owns the tabs and their stacks. The app hands it its
// own list, already filtered, five at the most; how few is the app's to hold (tab-bar.ts has the
// whole contract). Every tab shows its word; the selected one carries a rule above it and a
// heavier face, not colour alone; each is a "tab" to VoiceOver, with its selected state, inside a
// "tablist". The bar sits inside the safe area, is not drawn while the keyboard is up, and grows
// taller with its words. Whether it is docked or floats, how a floating bar is inset, and every
// size are the chrome's (TabBarChrome: the app's, the template's TAB_BAR_CHROME when not given).
// Pressing a tab sends the router's own tab-press event, so pressing the selected one takes its
// stack back to its root. A listed tab the router has no route for is handed to the log as an
// error, and thrown in a development build. The logic is in tab-bar.ts (pure, tested).

import type { Tabs } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { logger } from '../lib/logger';
import { useTokens } from '../styles/theme';
import { Text } from './Text';
import { ICON_STROKE } from './paint';
import {
  TAB_BAR_CHROME,
  TAB_LABEL_SCALING,
  TAB_MARK,
  missingTabs,
  refuseMissingTabs,
  tabBarFrame,
  tabBarHidden,
  tabInk,
  tabItems,
  tabMinHeight,
  tabPress,
  tabTone,
  type TabBarChrome,
  type TabItem,
  type TabSpec,
} from './tab-bar';
import { useKeyboardHeight } from './use-keyboard-height';

/** What the router hands the function given to its `tabBar`. */
type RouterTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export type TabBarProps = Pick<RouterTabBarProps, 'state' | 'navigation'> & {
  /** The app's tabs, in order, already filtered: five at the most (tab-bar.ts TABS_MOST). */
  readonly tabs: readonly TabSpec<LucideIcon>[];
  /** The bar's shape and sizes; the template's docked bar when omitted. */
  readonly chrome?: TabBarChrome;
};

/**
 * How a fault in the list is made loud: an error to the app's log (which says nothing in a release
 * build, src/lib/logger.ts), and a thrown error in a development build.
 */
const FAULTS = Object.freeze({
  development: typeof __DEV__ !== 'undefined' && __DEV__,
  log: (message: string) => logger.error(message),
});

type TabButtonProps = {
  readonly item: TabItem<LucideIcon>;
  readonly chrome: TabBarChrome;
  readonly onPress: () => void;
  readonly onLongPress: () => void;
};

function TabButton({ item, chrome, onPress, onLongPress }: TabButtonProps) {
  const { colours, radii, spacing } = useTokens();
  const Icon = item.icon;
  const ink = tabInk(colours, item.selected);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: item.selected }}
      style={[
        styles.tab,
        {
          minHeight: tabMinHeight(chrome.minHeight),
          gap: spacing.space1,
          paddingBottom: spacing.space1,
        },
      ]}
    >
      <View
        style={[
          styles.mark,
          { backgroundColor: item.selected ? ink : 'transparent', borderRadius: radii.full },
        ]}
      />
      <Icon size={chrome.iconSize} color={ink} strokeWidth={ICON_STROKE} />
      <Text
        {...TAB_LABEL_SCALING}
        level={chrome.labelLevel}
        weight={item.selected ? chrome.labelWeight.selected : chrome.labelWeight.rest}
        tone={tabTone(item.selected)}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

export function TabBar({ tabs, chrome = TAB_BAR_CHROME, state, navigation }: TabBarProps) {
  const { colours, radii, spacing } = useTokens();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  refuseMissingTabs(missingTabs(tabs, state), FAULTS);
  if (tabBarHidden(keyboard)) return null;

  const frame = tabBarFrame(chrome, insets.bottom);
  const inset = frame.inset === null ? 0 : spacing[frame.inset];
  const press = (item: TabItem<LucideIcon>) => {
    const sent = tabPress(item, state.key);
    const event = navigation.emit({
      type: 'tabPress',
      target: sent.target,
      canPreventDefault: true,
      data: sent.data,
    });
    if (sent.jump !== null && !event.defaultPrevented) navigation.dispatch(sent.jump);
  };
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        frame.rule === 'around' ? styles.ruleAround : styles.ruleTop,
        {
          backgroundColor: colours[chrome.ground],
          borderColor: colours[chrome.rule],
          borderRadius: frame.radius === null ? 0 : radii[frame.radius],
          paddingBottom: frame.paddingBottom,
          paddingLeft: insets.left + spacing.space1,
          paddingRight: insets.right + spacing.space1,
          marginBottom: frame.marginBottom + inset,
          marginHorizontal: inset,
        },
      ]}
    >
      {tabItems(tabs, state).map((item) => (
        <TabButton
          key={item.key}
          item={item}
          chrome={chrome}
          onPress={() => press(item)}
          onLongPress={() => navigation.emit({ type: 'tabLongPress', target: item.key })}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row' },
  ruleTop: { borderTopWidth: 1 },
  ruleAround: { borderWidth: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  mark: { width: TAB_MARK.width, height: TAB_MARK.height },
});
