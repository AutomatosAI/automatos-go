// Lost (PRD-001 §4.7 Edges, Ember 09, US-017f): an app link with no screen. On the style's ground
// for the screen, a huge '404' behind (the lostNumber slot in the ground mixed toward the text at
// 0.1: a mark, hidden from accessibility and not scaled by Dynamic Type) with Auto lost at 140 at
// its foot (Play; HUD when the look's auto is on; Studio only with a theme's mascot), 'This page
// wandered off.' (the screen slot, 44/0.95 in Play), "Auto looked everywhere. It's not here." and
// one way out: Back to chat (48, full width) → routes.home, through the gate.

import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Text as NativeText, StyleSheet, View } from 'react-native';

import { routes } from '../../navigation/routes';
import { Screen, Text } from '../../ui';
import { MASCOT_SIZES } from '../mascot/geometry';
import { Mascot } from '../mascot/Mascot';
import { useStyle } from '../theme';
import { LOST_EDGE } from './edges';
import { EDGE_METRICS } from './metrics';
import { EdgeAction, EdgeActions, EdgeBrand, useEdgePaint } from './parts';

export type LostProps = {
  /** Back to chat; routes.home when omitted. */
  readonly onBack?: () => void;
};

function LostNumber() {
  const style = useStyle();
  const paint = useEdgePaint();
  return (
    <View
      style={[styles.stage, { height: EDGE_METRICS.lostStage }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <NativeText
        allowFontScaling={false}
        style={[style.type.display('lostNumber'), { color: paint.lostNumber }]}
      >
        {LOST_EDGE.number}
      </NativeText>
      <View style={styles.auto} pointerEvents="none">
        <Mascot size={MASCOT_SIZES.lost} state="lost" />
      </View>
    </View>
  );
}

export function Lost({ onBack }: LostProps) {
  const router = useRouter();
  const style = useStyle();
  const paint = useEdgePaint();
  const home = useCallback(() => router.replace(routes.home), [router]);
  return (
    <Screen scroll ground="lost" autoState="lost">
      <EdgeBrand />
      <View style={[styles.middle, { gap: EDGE_METRICS.gap }]}>
        <LostNumber />
        <Text
          accessibilityRole="header"
          style={[style.type.display('screen'), styles.centred, { color: paint.text }]}
        >
          {LOST_EDGE.title}
        </Text>
        <Text
          style={[style.type.body(EDGE_METRICS.messageSize), styles.centred, { color: paint.text2 }]}
        >
          {LOST_EDGE.message}
        </Text>
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
