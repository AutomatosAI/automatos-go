// Lost (PRD-001 §4.7 Edges, Ember 09, US-017f): an app link with no screen. On the style's ground
// for the screen, a huge '404' behind (the lostNumber slot in the ground mixed toward the text at
// 0.1: a mark, hidden from accessibility and not scaled by Dynamic Type) with Auto lost at 140 at
// its foot (Play; HUD when the look's auto is on; Studio only with a theme's mascot), 'This page
// wandered off.' (the screen slot, 44/0.95 in Play), "Auto looked everywhere. It's not here." and
// one way out: Back to chat (48, full width) → routes.home, through the gate. Arcade (US-022i): the
// '404' alone on the page (its lostNumber slot, sized for the screen, not a window), then a window
// with Auto's sprite lost at its head and the kit's own lines, 'You wandered off the map'. Candy
// (US-023l) the same way: the '404' alone (Outfit 600 180), then its window with the band across
// its top, Auto lost on it with his state word, and its kit's lines, 'This page isn't here'.

import { useRouter } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { Text as NativeText, StyleSheet, View } from 'react-native';

import { routes } from '../../navigation/routes';
import { Screen, Text } from '../../ui';
import { MASCOT_SIZES } from '../mascot/geometry';
import { Mascot } from '../mascot/Mascot';
import type { Layout } from '../registry/style-id';
import { useStyle } from '../theme';
import { ArcadeEdgeWindow } from './ArcadeEdgeWindow';
import { CandyEdgeWindow } from './CandyEdgeWindow';
import { LOST_EDGE, lostEdge, type LostEdge } from './edges';
import { EDGE_METRICS } from './metrics';
import { EdgeAction, EdgeActions, EdgeBrand, useEdgePaint } from './parts';

export type LostProps = {
  /** Back to chat; routes.home when omitted. */
  readonly onBack?: () => void;
};

/** The styles whose Auto is in Lost's window, so the '404' stands alone on the page. */
const WINDOWED: ReadonlySet<Layout> = new Set<Layout>(['arcade', 'candy']);

/**
 * The '404' behind, Auto lost at its foot; in Arcade and Candy the number alone (Auto is in the
 * window).
 */
function LostNumber() {
  const style = useStyle();
  const paint = useEdgePaint();
  const windowed = WINDOWED.has(style.layout);
  return (
    <View
      style={[styles.stage, windowed ? null : { height: EDGE_METRICS.lostStage }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <NativeText
        allowFontScaling={false}
        style={[style.type.display('lostNumber'), { color: paint.lostNumber }]}
      >
        {LOST_EDGE.number}
      </NativeText>
      {windowed ? null : (
        <View style={styles.auto} pointerEvents="none">
          <Mascot size={MASCOT_SIZES.lost} state="lost" />
        </View>
      )}
    </View>
  );
}

function LostWords({ words }: { readonly words: LostEdge }) {
  const style = useStyle();
  const paint = useEdgePaint();
  return (
    <>
      <Text
        accessibilityRole="header"
        style={[style.type.display('screen'), styles.centred, { color: paint.text }]}
      >
        {words.title}
      </Text>
      <Text
        style={[style.type.body(EDGE_METRICS.messageSize), styles.centred, { color: paint.text2 }]}
      >
        {words.message}
      </Text>
    </>
  );
}

/**
 * Arcade's window round the words, Auto's sprite lost at its head; Candy's, Auto lost on its band;
 * the words alone elsewhere.
 */
function LostFrame({ children }: { readonly children: ReactNode }) {
  const { layout } = useStyle();
  if (layout === 'candy') {
    return (
      <CandyEdgeWindow state="lost" centred>
        {children}
      </CandyEdgeWindow>
    );
  }
  if (layout !== 'arcade') return <>{children}</>;
  return (
    <ArcadeEdgeWindow state="lost" centred>
      {children}
    </ArcadeEdgeWindow>
  );
}

export function Lost({ onBack }: LostProps) {
  const router = useRouter();
  const { layout } = useStyle();
  const home = useCallback(() => router.replace(routes.home), [router]);
  return (
    <Screen scroll ground="lost" autoState="lost">
      <EdgeBrand />
      <View style={[styles.middle, { gap: EDGE_METRICS.gap }]}>
        <LostNumber />
        <LostFrame>
          <LostWords words={lostEdge(layout)} />
        </LostFrame>
      </View>
      <EdgeActions>
        <EdgeAction label={LOST_EDGE.back} onPress={onBack ?? home} />
      </EdgeActions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: EDGE_METRICS.padX,
  },
  stage: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'flex-end' },
  auto: { position: 'absolute', bottom: 0, alignSelf: 'center' },
  centred: { textAlign: 'center' },
});
