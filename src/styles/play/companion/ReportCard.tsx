// The report Auto just made, inline in his reply (Ember 02; the web's deliverable-card.tsx at the
// pin): a radius-14 card on a 135° expo-linear-gradient from the accent at 0.16 to 0.03 with a
// 1 pt accent line at 0.4, 12 pad and 14 gap; a 64 x 80 paper in the sheet's colours (radius 5, the
// title at 11, a rule and a little chart, all decoration hidden from VoiceOver); the eyebrow
// 'REPORT · JUST NOW' in the label style and the accent text; the title in the card slot; and
// 'Open', the screen's one primary (44 high, radius 10: the dress's Play button). A card that just
// landed drops in 16 pt and overshoots to 1.04 over 420 ms (US-017g; none under Reduce Motion).

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

import { Button, Text } from '../../../ui';
import { PLAY_CHAT_COPY } from '../../strings';
import { COMPANION, reportEyebrow } from './model';
import { useCompanionPaint, type CompanionPaint } from './use-companion';

export type ReportCardProps = {
  readonly title: string;
  /** The line over the title; 'Report · just now' when omitted. */
  readonly eyebrow?: string;
  readonly onOpen: () => void;
  /** It just landed in the chat: it drops in (history never replays). */
  readonly drop?: boolean;
};

const { report, drop: land } = COMPANION;
/** CSS's 135°: from the top-left corner to the bottom-right. */
const GRADIENT_START = Object.freeze({ x: 0, y: 0 });
const GRADIENT_END = Object.freeze({ x: 1, y: 1 });
const LAST_BAR = report.bars.length - 1;
const LAND_EASING = Easing.out(Easing.cubic);

/** Ember's land: every frame names opacity, then translateY before scale, as reanimated asks. */
const LAND = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -land.distance }, { scale: land.from }] },
  [land.peakAt]: {
    opacity: 1,
    transform: [{ translateY: 0 }, { scale: land.overshoot }],
    easing: LAND_EASING,
  },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: LAND_EASING },
}).duration(land.durationMs);

function Paper({ title, paint }: { readonly title: string; readonly paint: CompanionPaint }) {
  const { vars, lines, style } = paint;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.paper,
        {
          width: report.paperWidth,
          height: report.paperHeight,
          borderRadius: report.paperRadius,
          padding: report.paperPad,
          gap: style.tokens.spacing.space1,
          backgroundColor: vars.sheetBg,
        },
      ]}
    >
      <Text
        numberOfLines={2}
        style={[style.type.body(report.paperTitle, 600), { color: vars.sheetText }]}
      >
        {title}
      </Text>
      <View style={{ height: report.paperRule, backgroundColor: lines.paperRule }} />
      <View style={[styles.chart, { height: report.chartHeight, gap: report.barGap }]}>
        {report.bars.map((share, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: report.chartHeight * share,
                backgroundColor: index === LAST_BAR ? vars.sheetAccent : lines.paperBar,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export function ReportCard({
  title,
  eyebrow = reportEyebrow(),
  onOpen,
  drop = false,
}: ReportCardProps) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const { vars, lines, style } = paint;
  const said = PLAY_CHAT_COPY.report;
  return (
    <Animated.View
      entering={drop && paint.loops ? LAND : undefined}
      style={[
        styles.card,
        {
          gap: report.gap,
          padding: report.pad,
          borderRadius: style.radii.card,
          borderColor: lines.accentLine,
        },
      ]}
    >
      <LinearGradient
        colors={lines.reportGradient}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={StyleSheet.absoluteFill}
      />
      <Paper title={title} paint={paint} />
      <View style={[styles.text, { gap: style.tokens.spacing.space4 }]}>
        <View style={{ gap: style.tokens.spacing.space1 }}>
          <Text style={[style.type.eyebrow, { color: vars.accentText }]}>{eyebrow}</Text>
          <Text style={[style.type.display('card'), { color: vars.groundText }]}>{title}</Text>
        </View>
        <View style={styles.open}>
          <Button label={said.open} accessibilityLabel={said.openLabel(title)} onPress={onOpen} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: 1, overflow: 'hidden' },
  paper: { flex: 0 },
  chart: { marginTop: 'auto', flexDirection: 'row', alignItems: 'flex-end' },
  bar: { flex: 1 },
  text: { flex: 1, justifyContent: 'space-between' },
  open: { alignSelf: 'flex-start' },
});
