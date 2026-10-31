// Candy's gradient card (CANDY-LAYOUT §3 and §4; the kit's ui/ui.module.css .card at 3920359d5): a
// box filled with the look's card gradient for its set (tokens/candy-paint.ts cardGradient: the
// linear, the highlight and Vivid's glows), drawn by Skia to the size the box lays out at and
// clipped to its corners — rs by default (round(r × 0.72)), any radius, or one per corner (the
// chat's stage: 0 0 40 40) — under the palette's tinted shadow (candyShadow: radius 20, offset
// (0, 14), the glow's alpha; Android's elevation 8). The box's own fill is the set's start colour,
// so the shadow has a shape to follow and the card reads before Skia's first frame. Children sit on
// top in the card's white ink's world: small white text only over the left 0–70 % (D-A11Y).

import { Canvas } from '@shopify/react-native-skia';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useLayoutSize } from '../../ground/use-size';
import { CARD_START_VARS } from '../../tokens/candy';
import { cardGradient, type CandySetIndex, type PaintSize } from '../../tokens/candy-paint';
import type { CandyLook } from '../look-schema';
import { CardFill } from './CardFill';
import { cornersPath, uniformCorners, type Corners } from './shapes';
import { useCandyPaint } from './use-candy-paint';
import { useSkiaPath } from './use-skia-path';

export type GradientCardProps = {
  /** Which of the look's three card gradients: 1, 2 or 3 in the palette's order (sets.ts). */
  readonly set: CandySetIndex;
  readonly children?: ReactNode;
  /** The card's own box: its width and height, margins, flex. */
  readonly style?: StyleProp<ViewStyle>;
  /** The content over the paint: padding, gap. */
  readonly contentStyle?: StyleProp<ViewStyle>;
  /** One radius for every corner; rs when omitted. */
  readonly radius?: number;
  /** A radius per corner, over `radius` (the stage's square top). */
  readonly corners?: Corners;
  /** The tinted shadow (on by default). */
  readonly shadow?: boolean;
};

function cornerStyle(corners: Corners): ViewStyle {
  return {
    borderTopLeftRadius: corners.topLeft,
    borderTopRightRadius: corners.topRight,
    borderBottomRightRadius: corners.bottomRight,
    borderBottomLeftRadius: corners.bottomLeft,
  };
}

type PaintProps = {
  readonly look: CandyLook;
  readonly set: CandySetIndex;
  readonly size: PaintSize;
  readonly corners: Corners;
};

function CardPaint({ look, set, size, corners }: PaintProps) {
  const gradient = useMemo(() => cardGradient(look, set, size), [look, set, size]);
  const clip = useSkiaPath(cornersPath(size, corners));
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <CardFill gradient={gradient} size={size} clip={clip} />
      </Canvas>
    </View>
  );
}

export function GradientCard({
  set,
  children,
  style,
  contentStyle,
  radius,
  corners,
  shadow = true,
}: GradientCardProps) {
  const paint = useCandyPaint();
  const [layout, onLayout] = useLayoutSize();
  const shape = useMemo(
    () => corners ?? uniformCorners(radius ?? paint.rs),
    [corners, radius, paint.rs],
  );
  const size = useMemo(
    () => (layout ? { w: layout.width, h: layout.height } : null),
    [layout],
  );
  const ground = paint.vars[CARD_START_VARS[set]];
  return (
    <View
      onLayout={onLayout}
      style={[cornerStyle(shape), { backgroundColor: ground }, shadow ? paint.shadow : null, style]}
    >
      {size ? <CardPaint look={paint.look} set={set} size={size} corners={shape} /> : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
});
