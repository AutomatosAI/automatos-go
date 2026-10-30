// Arcade's one container (README 'Windows'; the design kit's ui/ui.module.css .window and the
// dialogue's speaker tag): a square window in the look's window style — Classic a 2 pt border, a
// 2 pt gap of the window's ground and a second 2 pt border, a 1 pt light and dark bevel inside and
// a 6 pt drop shadow; Thin one 2 pt line and a 4 pt shadow (window-frame.ts) — on its ground (the
// window colour, or the page for an inset), with the look's scanlines behind its content only.
// An optional title tab in Press Start 2P sits over the top edge in the accent, as the dialogue's
// AUTO tag does; it is a header for VoiceOver. The rings and shadow are part of the window's own
// box, so a layout spacing windows measures them. A `fill` window (the home's story, US-022g) is as
// tall as the box its style gives it, its content bounded by it, so a list inside it scrolls.

import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '../../../ui';
import { arcadeWindowFrame, type ArcadeVars } from '../../tokens/arcade';
import { Scanlines } from './Scanlines';
import { useArcadePaint } from './use-arcade-paint';
import { scanPlan, windowRings, type WindowGround } from './window-frame';

/** The tab: left inset and padding as the kit's speaker tag, overlapping the top edge by 16 pt. */
const TAB = Object.freeze({ inset: 16, padV: 8, padH: 12, ring: 2, overlap: 16 });

export type ArcadeWindowProps = {
  readonly children?: ReactNode;
  /** The title tab's words ('AUTO'); no tab when omitted. */
  readonly title?: string;
  /** The window's ground: 'win' (the default) or 'page'. */
  readonly ground?: WindowGround;
  /** The window's own box: margins, flex. */
  readonly style?: StyleProp<ViewStyle>;
  /** The content inside the rings: padding, gap. */
  readonly contentStyle?: StyleProp<ViewStyle>;
  /** Its height is its box's, never its content's: a list inside scrolls. */
  readonly fill?: boolean;
};

/** The bevel inside the border: light on the top and left, dark on the bottom and right. */
function bevel(width: number, vars: ArcadeVars): ViewStyle {
  return {
    borderWidth: width,
    borderTopColor: vars.bevl,
    borderLeftColor: vars.bevl,
    borderBottomColor: vars.bevd,
    borderRightColor: vars.bevd,
  };
}

function TitleTab({ title }: { readonly title: string }) {
  const { vars, type } = useArcadePaint();
  return (
    <View style={[styles.tab, { backgroundColor: vars.win, borderColor: vars.bd }]}>
      <Text accessibilityRole="header" style={[type.label, { color: vars.ac }]}>
        {title}
      </Text>
    </View>
  );
}

export function ArcadeWindow({
  children,
  title,
  ground = 'win',
  style,
  contentStyle,
  fill = false,
}: ArcadeWindowProps) {
  const { look, vars } = useArcadePaint();
  const box = fill ? styles.bounded : styles.fill;
  const rings = windowRings(arcadeWindowFrame(look));
  const plan = useMemo(() => scanPlan(look, ground), [look, ground]);
  const titled = title !== undefined && title.length > 0;
  return (
    <View style={style}>
      {titled ? <TitleTab title={title} /> : null}
      <View
        style={[
          box,
          { paddingRight: rings.drop, paddingBottom: rings.drop },
          titled ? styles.overTab : null,
        ]}
      >
        <View
          pointerEvents="none"
          style={[styles.shadow, { top: rings.drop, left: rings.drop, backgroundColor: vars.sh }]}
        />
        <View
          style={[
            box,
            { borderWidth: rings.outer, padding: rings.gap },
            { borderColor: vars.bd, backgroundColor: vars.win },
          ]}
        >
          <View
            style={[
              box,
              { borderWidth: rings.border },
              { borderColor: vars.bd, backgroundColor: vars[ground] },
            ]}
          >
            <View
              style={[
                box,
                bevel(rings.bevel, vars),
                titled ? styles.underTab : null,
                contentStyle,
              ]}
            >
              <Scanlines plan={plan} />
              {children}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    zIndex: 1,
    alignSelf: 'flex-start',
    marginLeft: TAB.inset,
    paddingVertical: TAB.padV,
    paddingHorizontal: TAB.padH,
    borderWidth: TAB.ring,
  },
  fill: { flexGrow: 1 },
  bounded: { flex: 1 },
  shadow: { position: 'absolute', right: 0, bottom: 0 },
  overTab: { marginTop: -TAB.overlap },
  underTab: { paddingTop: TAB.overlap },
});
