// The Command Centre's frame (handoff §2, US-010b): the top bar (back to Auto, the live stream's
// word), the head (the dateline in the phone's timezone, the title, the lede) and the sticky tabs
// with their figures, over the tab's own screen. The tabs never scroll away; a ticket, a social post
// or a Deliverable opens over the tab it came from, which the shell keeps showing; the ticket and the
// social post are sheets over it (SHEET_ROUTE_OPTIONS). One opened from outside the tabs (chat, the
// needs strip) is this stack's first screen, with no tab under it: no tab shows selected, and every
// tab, Board too, goes to its screen. The words and figures are src/cc/shell's (pure, tested); the
// live word reads the foundation's one stream.
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Head } from '../../../src/cc/shell/Head';
import { TabStrip } from '../../../src/cc/shell/TabStrip';
import { TopBar } from '../../../src/cc/shell/TopBar';
import { useShellFigures, useShellTab } from '../../../src/cc/shell/use-shell';
import { SHEET_ROUTE_OPTIONS } from '../../../src/cc/use-sheet-route';
import { useTokens } from '../../../src/styles/theme';
import { Screen } from '../../../src/ui';

/** The top bar paints the status bar's inset itself (the chrome runs to the top edge). */
const EDGES: readonly Edge[] = ['left', 'right', 'bottom'];

export default function CommandCentreLayout() {
  const { colours } = useTokens();
  const tab = useShellTab();
  const { lede, counts } = useShellFigures();
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      // a tab replaces the screen under the shell: no slide between tabs
      animation: 'none' as const,
      contentStyle: { backgroundColor: colours.background },
    }),
    [colours.background],
  );
  return (
    <Screen edges={EDGES}>
      <TopBar />
      <Head lede={lede} />
      <TabStrip active={tab} counts={counts} />
      <View style={styles.body}>
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="ticket/[taskId]" options={SHEET_ROUTE_OPTIONS} />
          <Stack.Screen name="social/[postId]" options={SHEET_ROUTE_OPTIONS} />
        </Stack>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
});
