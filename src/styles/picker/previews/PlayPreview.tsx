// Play's preview: Ember's chat in miniature in the phone's own look — the look's page glow rising
// from the bottom (its capped glow, Ember 01's 30% 92%), a finished tool line as a pill chip, and
// Auto at 84 resting beside 'Ready.' in the look's display face. Auto is the stand-in of
// stand-ins.ts until US-017b's Mascot; his ring breathes on Ember's 2.4 s pulse while the preview
// may move.

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import type { Look } from '../../../core/web/lib/looks/types';
import { Text } from '../../../ui';
import { useStyle } from '../../theme';
import type { PlayVars } from '../../tokens/play';
import { PREVIEW_COPY } from '../../strings';
import { PREVIEW, playToolLine } from '../cards';
import { PreviewPulse } from '../PreviewPulse';
import { autoStandIn, autoStandInPaint, playGlowStops } from '../stand-ins';

const AUTO = autoStandIn(PREVIEW.autoSize);
const GLOW_START = Object.freeze({ x: 0.5, y: 0.2 });
const GLOW_END = Object.freeze({ x: 0.3, y: 0.92 });
const CHIP_BORDER = 1;

type AutoProps = { readonly look: Look; readonly vars: PlayVars; readonly animate: boolean };

function AutoStandIn({ look, vars, animate }: AutoProps) {
  const paint = autoStandInPaint(look, vars);
  const { ring, body, visor, eye } = AUTO;
  const eyeStyle = { width: eye, height: eye, borderRadius: eye / 2, backgroundColor: paint.eye };
  return (
    <View style={{ width: AUTO.box.width, height: AUTO.box.height }}>
      <PreviewPulse
        animate={animate}
        from={PREVIEW.playPulse.from}
        to={PREVIEW.playPulse.to}
        style={[
          styles.ring,
          {
            width: ring.width,
            height: ring.height,
            left: (AUTO.box.width - ring.width) / 2,
            borderWidth: ring.stroke,
            borderRadius: ring.height / 2,
            borderColor: paint.ring,
            backgroundColor: paint.ringGlow,
          },
        ]}
      />
      <View
        style={[
          styles.body,
          {
            width: body.width,
            height: body.height,
            bottom: body.bottom,
            left: (AUTO.box.width - body.width) / 2,
            borderWidth: body.edge,
            borderStyle: 'dashed',
            borderRadius: body.width / 2,
            borderColor: paint.bodyEdge,
            backgroundColor: paint.body,
          },
        ]}
      >
        <View
          style={[
            styles.visor,
            {
              width: visor.width,
              height: visor.height,
              borderRadius: visor.height / 2,
              backgroundColor: paint.visor,
            },
          ]}
        >
          <View style={eyeStyle} />
          <View style={eyeStyle} />
        </View>
      </View>
    </View>
  );
}

export function PlayPreview({ animate }: { readonly animate: boolean }) {
  const { play, playLook, type, tokens } = useStyle();
  const { spacing, radii } = tokens;
  if (!play || !playLook) return null;
  return (
    <View
      style={[
        styles.ground,
        { backgroundColor: play.groundBg, padding: spacing.space7, gap: spacing.space6 },
      ]}
    >
      <LinearGradient
        colors={playGlowStops(play)}
        start={GLOW_START}
        end={GLOW_END}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.chip,
          {
            backgroundColor: play.groundChip,
            borderColor: play.groundLine,
            borderWidth: CHIP_BORDER,
            borderRadius: radii.pill,
            paddingHorizontal: spacing.space5,
            paddingVertical: spacing.space2,
          },
        ]}
      >
        <Text style={[type.mono(PREVIEW.toolLineSize), { color: play.groundText2 }]}>
          {playToolLine()}
        </Text>
      </View>
      <View style={[styles.row, { gap: spacing.space6 }]}>
        <AutoStandIn look={playLook} vars={play} animate={animate} />
        <Text style={[type.display('status'), styles.status, { color: play.groundText }]}>
          {PREVIEW_COPY.play.status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { minHeight: PREVIEW.minHeight, justifyContent: 'flex-end' },
  chip: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center' },
  status: { flexShrink: 1 },
  ring: { position: 'absolute', bottom: 0 },
  body: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  visor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
});
