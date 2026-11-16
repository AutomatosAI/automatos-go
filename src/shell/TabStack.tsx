// The stack inside a tab (the app standard's rule 5.4: one tab bar, and a stack in each tab): the
// tab's root and the screens pushed from it. It draws no header of the system's; a screen's
// header is the Header primitive. Pressing the open tab takes this stack back to its root: the
// tab bar sends the router's own tab-press event, and the router's stack answers it. A tab's
// route layout mounts it and exports TAB_STACK_SETTINGS (tabs.ts) as `unstable_settings`:
//
//   export const unstable_settings = TAB_STACK_SETTINGS;
//   export default function PlaceLayout() {
//     return <TabStack />;
//   }

import { Stack } from 'expo-router';

const SCREEN_OPTIONS = Object.freeze({ headerShown: false });

export function TabStack() {
  return <Stack screenOptions={SCREEN_OPTIONS} />;
}
