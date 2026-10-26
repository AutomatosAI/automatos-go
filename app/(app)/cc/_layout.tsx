// The Command Centre's frame (handoff §2, US-010b): the top bar (back to Auto, the live stream's
// word) and the sticky tabs with their figures, over the tab's own screen. The head (the dateline in
// the phone's timezone, the title, the lede) is drawn by each tab at the top of its list
// (src/cc/shell/TabHead.tsx, the lede handed down here), so it scrolls away with the tab and a
// 375 x 667 phone keeps its height for the tab. The top bar and the tabs never scroll away; a
// ticket, a social post or a Deliverable opens over the tab it came from, which the shell keeps
// showing; the ticket and the social post are sheets over it (SHEET_ROUTE_OPTIONS). One opened from
// outside the tabs (chat, the needs strip) is this stack's first screen, with no tab under it: no
// tab shows selected, and every tab, Board too, goes to its screen. The words and figures are
// src/cc/shell's (pure, tested); the live word reads the foundation's one stream. In Play the Shelf
// and a Deliverable draw their own header, way back and bottom bar (Ember 04-05, KS10), so the top
// bar, head and tabs step aside there (src/styles/homes/use-play-layout.ts). Under Play and HUD the
// tab's screen is clear, so the style's ground (Play's glow, HUD's grid) runs under it
// (src/styles/dress/cc-dress.ts shellGround).
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { ShellHeadProvider } from '../../../src/cc/shell/TabHead';
import { TabStrip } from '../../../src/cc/shell/TabStrip';
import { TopBar } from '../../../src/cc/shell/TopBar';
import { useShellFigures, useShellTab } from '../../../src/cc/shell/use-shell';
import { SHEET_ROUTE_OPTIONS } from '../../../src/cc/use-sheet-route';
import { shellGround } from '../../../src/styles/dress/cc-dress';
import { useDress } from '../../../src/styles/dress/use-dress';
import { useShellStepsAside } from '../../../src/styles/homes/use-play-layout';
import { useTokens } from '../../../src/styles/theme';
import { Screen } from '../../../src/ui';

/** The top bar paints the status bar's inset itself (the chrome runs to the top edge). */
const EDGES: readonly Edge[] = ['left', 'right', 'bottom'];

export default function CommandCentreLayout() {
  const { colours } = useTokens();
  const ground = shellGround(useDress(), colours.background);
  const tab = useShellTab();
  const { lede, counts } = useShellFigures();
  const aside = useShellStepsAside();
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      // a tab replaces the screen under the shell: no slide between tabs
      animation: 'none' as const,
      contentStyle: { backgroundColor: ground },
    }),
    [ground],
  );
  return (
    <Screen edges={EDGES}>
      {aside ? null : (
        <>
          <TopBar />
          <TabStrip active={tab} counts={counts} />
        </>
      )}
      <View style={styles.body}>
        <ShellHeadProvider lede={aside ? null : lede}>
          <Stack screenOptions={screenOptions}>
            <Stack.Screen name="ticket/[taskId]" options={SHEET_ROUTE_OPTIONS} />
            <Stack.Screen name="social/[postId]" options={SHEET_ROUTE_OPTIONS} />
          </Stack>
        </ShellHeadProvider>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
});
