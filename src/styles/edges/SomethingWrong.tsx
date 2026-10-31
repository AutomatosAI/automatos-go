// Something went wrong (PRD-001 §4.7 Edges, Ember 08, US-017f): a step failed in a way the server
// or the stream caused. On the style's ground for the screen (Play's coral light), the snag card —
// radius 14 in Play, a bracket panel under '✕ SNAG' in HUD, Studio's card; a 1 pt error line at 0.4
// and 18 inside — titled 'I hit a snag.' (Play: the snag slot, 28/1, in the error text), the API
// taxonomy's words for the error (never internals), Try again and an optional second way forward;
// under it Auto's row, 'Hm.' and his caption (Play's AutoRow; HUD's state chip and Auto when the
// look's auto is on). Arcade (US-022i) draws the card as a window tabbed '✕ SNAG' with Auto's sprite
// in oops and its word at its head, the title in HP red, and no row under it. Candy (US-023l)
// draws it as its window, the band across its top with Auto in oops and his state word ('✕ Oops')
// on it, the title in Candy's red, and no row under it. The words are edges.ts
// somethingWrongEdge's.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Screen, Text } from '../../ui';
import { StateChip } from '../hud/core/StateChip';
import { MASCOT_SIZES } from '../mascot/geometry';
import { Mascot } from '../mascot/Mascot';
import { AutoRow } from '../play/companion/AutoRow';
import { useStyle } from '../theme';
import { ArcadeEdgeWindow } from './ArcadeEdgeWindow';
import { CandyEdgeWindow } from './CandyEdgeWindow';
import { somethingWrongEdge, type SomethingWrongEdge } from './edges';
import { EDGE_METRICS } from './metrics';
import { EdgeAction, EdgeBrand, useEdgePaint } from './parts';

export type SomethingWrongProps = {
  /** What failed: its kind picks the words (src/api/strings.ts), nothing else of it is shown. */
  readonly error: unknown;
  /** Try again: the step tried again. */
  readonly onRetry: () => void;
  /** A second way forward under Try again (the gate's way out, a chat's other path). */
  readonly secondary?: ReactNode;
};

const { snag } = EDGE_METRICS;

function SnagAuto() {
  const style = useStyle();
  if (style.layout === 'play') return <AutoRow state="oops" />;
  if (style.layout !== 'hud') return null;
  return (
    <View style={[styles.hudAuto, { gap: snag.gap }]}>
      <Mascot size={MASCOT_SIZES.autoRow} state="oops" />
      <StateChip state="oops" />
    </View>
  );
}

type SnagCardProps = { readonly view: SomethingWrongEdge; readonly children: ReactNode };

/**
 * The snag card: Arcade's window with Auto at its head, Candy's with Auto on its band; the style's
 * Card (HUD's line) elsewhere.
 */
function SnagCard({ view, children }: SnagCardProps) {
  const style = useStyle();
  const paint = useEdgePaint();
  if (style.layout === 'arcade') {
    return (
      <ArcadeEdgeWindow state="oops" title={view.panel} titleLabel={view.panelLabel}>
        {children}
      </ArcadeEdgeWindow>
    );
  }
  if (style.layout === 'candy') return <CandyEdgeWindow state="oops">{children}</CandyEdgeWindow>;
  return (
    <Card padding="space8" radius="card" style={{ borderColor: paint.snagLine }}>
      <View style={{ gap: snag.gap }}>
        {style.layout === 'hud' ? (
          <Text
            accessibilityLabel={view.panelLabel}
            style={[style.type.display('panel'), { color: paint.snagTitle }]}
          >
            {view.panel}
          </Text>
        ) : null}
        {children}
      </View>
    </Card>
  );
}

export function SomethingWrong({ error, onRetry, secondary }: SomethingWrongProps) {
  const style = useStyle();
  const paint = useEdgePaint();
  const view = somethingWrongEdge(error);
  const message = style.type.body(snag.messageSize, 400, { leading: snag.messageLeading });
  return (
    <Screen scroll ground="something-wrong" autoState="oops">
      <EdgeBrand />
      <View style={[styles.middle, { gap: EDGE_METRICS.gap }]}>
        <SnagCard view={view}>
          <Text
            accessibilityRole="header"
            style={[style.type.display('snag'), { color: paint.snagTitle }]}
          >
            {view.title}
          </Text>
          <Text style={[message, { color: paint.text }]}>{view.message}</Text>
          <EdgeAction label={view.retry} onPress={onRetry} />
          {secondary}
        </SnagCard>
        <SnagAuto />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: EDGE_METRICS.padX,
    paddingBottom: EDGE_METRICS.action.padBottom,
  },
  hudAuto: { alignItems: 'center' },
});
