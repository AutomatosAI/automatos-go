// A screen's frame: the safe area over the ground (--background), optionally scrolling so text at
// the accessibility sizes wraps and stays reachable (§4.6). A5 (D54): the ground is the dress's
// (src/styles/ground) — Studio's background, Play's page glow placed for the screen's kind at the
// level for Auto's state, HUD's glow and grid under the content and its scanlines over it — and
// the status bar takes the style's tone (expo-status-bar).

import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import type { MascotName } from '../core/web/lib/mascot/types';
import { statusBarStyle } from '../styles/ground/ground';
import { RESTING_STATE } from '../styles/ground/play-glow';
import { ScreenGround, ScreenOverlay, useGroundPlan } from '../styles/ground/ScreenGround';
import { DEFAULT_SCREEN_KIND, type ScreenKind } from '../styles/ground/spots';
import { useStyle } from '../styles/theme';
import type { SpaceName } from '../styles/tokens';

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom', 'left', 'right'];

export type ScreenProps = {
  readonly children: ReactNode;
  readonly edges?: readonly Edge[];
  /** Scrolls the content (forms, settings, long states); off for screens that own a list. */
  readonly scroll?: boolean;
  readonly padding?: SpaceName;
  readonly style?: StyleProp<ViewStyle>;
  /** Which screen this is: where Play's light sits (src/styles/ground/spots.ts); 'page' if omitted. */
  readonly ground?: ScreenKind;
  /** Auto's state: the level of Play's page glow; idle if omitted. */
  readonly autoState?: MascotName;
};

export function Screen({
  children,
  edges = DEFAULT_EDGES,
  scroll = false,
  padding,
  style,
  ground = DEFAULT_SCREEN_KIND,
  autoState = RESTING_STATE,
}: ScreenProps) {
  const { tone, tokens } = useStyle();
  const { colours, spacing } = tokens;
  const plan = useGroundPlan(ground, autoState);
  const inner = padding === undefined ? null : { padding: spacing[padding] };
  return (
    <View style={[styles.screen, { backgroundColor: colours.background }]}>
      <StatusBar style={statusBarStyle(tone)} />
      <ScreenGround plan={plan} />
      <SafeAreaView edges={edges} style={[styles.screen, style]}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.grow, inner]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.screen, inner]}>{children}</View>
        )}
      </SafeAreaView>
      <ScreenOverlay plan={plan} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  grow: { flexGrow: 1 },
});
