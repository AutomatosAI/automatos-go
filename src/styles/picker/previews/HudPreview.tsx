// HUD's preview: the phone core in miniature in the phone's own HUD look — 'AUTOMATOS //' in the
// look's display face ('//' in the accent), a 120 pt ring core and the state chip under it saying
// Auto's state in capitals. The core is the stand-in of stand-ins.ts until US-018b's RingCore; its
// pulse disc breathes on the core's 2.4 s loop while the preview may move.

import { StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { useStyle } from '../../theme';
import type { HudVars } from '../../tokens/hud';
import { PREVIEW_COPY } from '../../strings';
import { PREVIEW, hudChipWords } from '../cards';
import { PreviewPulse } from '../PreviewPulse';
import { ringStandIn, ringStandInPaint } from '../stand-ins';

const CORE = ringStandIn(PREVIEW.ringCore);

function circle(diameter: number) {
  return { width: diameter, height: diameter, borderRadius: diameter / 2 };
}

function RingStandIn({ vars, animate }: { readonly vars: HudVars; readonly animate: boolean }) {
  const paint = ringStandInPaint(vars);
  return (
    <View
      style={[
        styles.centre,
        circle(CORE.outer),
        { borderWidth: CORE.stroke, borderColor: paint.outer },
      ]}
    >
      <View
        style={[
          styles.centre,
          circle(CORE.dashed),
          { borderWidth: CORE.stroke, borderColor: paint.dashed, borderStyle: 'dashed' },
        ]}
      >
        <PreviewPulse
          animate={animate}
          from={PREVIEW.hudPulse.from}
          to={PREVIEW.hudPulse.to}
          style={[circle(CORE.disc), { backgroundColor: paint.disc }]}
        />
      </View>
    </View>
  );
}

function StateChip({ vars }: { readonly vars: HudVars }) {
  const { type } = useStyle();
  const { chip } = PREVIEW;
  return (
    <View
      style={[
        styles.chip,
        {
          borderWidth: chip.border,
          borderColor: vars.accentLine,
          paddingHorizontal: chip.padX,
          paddingVertical: chip.padY,
        },
      ]}
    >
      <Text
        style={[
          type.mono(chip.size, chip.weight, { trackingEm: chip.trackingEm }),
          { color: vars.accent },
        ]}
      >
        {hudChipWords()}
      </Text>
    </View>
  );
}

export function HudPreview({ animate }: { readonly animate: boolean }) {
  const { hud, type, tokens } = useStyle();
  const { spacing } = tokens;
  if (!hud) return null;
  const brand = type.display('brand');
  return (
    <View
      style={[
        styles.ground,
        { backgroundColor: hud.bg, padding: spacing.space7, gap: spacing.space3 },
      ]}
    >
      <Text style={[brand, styles.brand, { color: hud.text }]}>
        {`${PREVIEW_COPY.hud.brand} `}
        <Text style={[brand, { color: hud.accent }]}>{PREVIEW_COPY.hud.brandMark}</Text>
      </Text>
      <RingStandIn vars={hud} animate={animate} />
      <StateChip vars={hud} />
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { minHeight: PREVIEW.minHeight, alignItems: 'center' },
  brand: { alignSelf: 'stretch' },
  centre: { alignItems: 'center', justifyContent: 'center' },
  chip: { alignSelf: 'center' },
});
