// The Tabs shell (the app standard's rule 5.4, decision D3): the router's own tab navigator, with
// the drawn TabBar as its `tabBar` renderer and no header of the system's, so there is one bar and
// a stack in each tab. The router owns the tabs and the stack inside each; the bar draws the app's
// own list (tabs.ts), in the app's order. Each tab's root screen draws the Header with `root`, and
// takes TAB_SCREEN_EDGES so the bar keeps the bottom edge.
//
// An app mounts it from its tabs' group layout, a route file that holds nothing else:
//
//   export default function TabsLayout() {
//     return <AppTabs tabs={tabsShown(APP_TABS, isOn)} />;
//   }
//
// where APP_TABS is the app's own list (three to five places: tabListFaults) and isOn says which
// of their features are on. Each place is a folder in that group whose _layout.tsx mounts
// TabStack and exports TAB_STACK_SETTINGS as `unstable_settings`. The template itself is the One
// home shell and mounts neither.

import { Tabs } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';

import { TabBar, type TabBarChrome, type TabSpec } from '../ui';

const SCREEN_OPTIONS = Object.freeze({ headerShown: false });

export type AppTabsProps = {
  /** The app's tabs, in order, already filtered (tabsShown): three to five (tabListFaults). */
  readonly tabs: readonly TabSpec<LucideIcon>[];
  /** The bar's shape and sizes; the template's docked bar (TAB_BAR_CHROME) when omitted. */
  readonly chrome?: TabBarChrome;
};

export function AppTabs({ tabs, chrome }: AppTabsProps) {
  return (
    <Tabs
      screenOptions={SCREEN_OPTIONS}
      tabBar={(props) => (
        <TabBar tabs={tabs} chrome={chrome} state={props.state} navigation={props.navigation} />
      )}
    >
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.route} name={tab.route} />
      ))}
    </Tabs>
  );
}
