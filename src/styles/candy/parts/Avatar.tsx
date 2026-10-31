// Candy's avatar (CANDY-LAYOUT §4 P1 and P4; the kit's agents/agent-card.tsx at 3920359d5): a
// circle with a name's initial (sets.ts initialOf), drawn by Skia — an active one's face its card
// gradient (cardGradient for its set, clipped round) with the initial in the card ink, a resting
// one's the chip fill with the initial quiet — and, when ringed (Team's active row), a 3 pt ring
// (the three cards' starts as a sweep while active, the line colour while resting) and a 3 pt gap
// in the ground under it (avatar-model.ts). Decoration: the name beside it carries the words, so
// VoiceOver skips it.

import { Canvas, Circle, Group, SweepGradient, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { cardGradient } from '../../tokens/candy-paint';
import { candyAvatarInitial } from '../../typeface/candy-type';
import { initialOf, type CardSet } from '../sets';
import { CardFill } from './CardFill';
import { AVATAR_RING, avatarMetrics, avatarPaint, type AvatarState } from './avatar-model';
import { circlePath } from './shapes';
import { useCandyPaint } from './use-candy-paint';
import { useSkiaPath } from './use-skia-path';

const INITIAL_SCALING = Object.freeze({
  // D38: a decorative initial inside a fixed circle (the name beside it is the words); 2× still fits it.
  maxFontSizeMultiplier: 2,
});

export type AvatarProps = {
  readonly name: string;
  /** The whole circle's diameter, ring and gap included. */
  readonly size: number;
  /** Which of the look's card gradients an active face wears (cardSetOf its place in the list). */
  readonly set?: CardSet;
  readonly state?: AvatarState;
  /** The 3 pt ring and its gap (Team's active row). */
  readonly ring?: boolean;
  /** What the avatar sits on, for the gap inside the ring: the page (the default) or a window. */
  readonly ground?: 'page' | 'win';
};

function Ring({ size, sweep, colour }: { readonly size: number; readonly sweep: readonly string[] | null; readonly colour: string }) {
  const centre = vec(size / 2, size / 2);
  if (!sweep) return <Circle c={centre} r={size / 2} color={colour} />;
  return (
    <Circle c={centre} r={size / 2}>
      <SweepGradient
        c={centre}
        colors={[...sweep]}
        positions={[...AVATAR_RING.positions]}
        origin={centre}
        transform={[{ rotate: AVATAR_RING.rotate }]}
      />
    </Circle>
  );
}

export function Avatar({ name, size, set = 1, state = 'active', ring = false, ground = 'page' }: AvatarProps) {
  const { look, vars } = useCandyPaint();
  const metrics = avatarMetrics(size, ring);
  const paint = avatarPaint(state);
  const { face } = metrics;
  const faceSize = useMemo(() => ({ w: face, h: face }), [face]);
  const gradient = useMemo(
    () => (paint.gradient ? cardGradient(look, set, faceSize) : null),
    [paint.gradient, look, set, faceSize],
  );
  const clip = useSkiaPath(circlePath(face));
  const initial = useMemo(() => candyAvatarInitial(metrics.initial), [metrics.initial]);
  const inset = metrics.ring + metrics.gap;
  const sweep = paint.sweep?.map((stop) => vars[stop]) ?? null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {ring ? <Ring size={size} sweep={sweep} colour={vars[paint.ringFill]} /> : null}
        {ring ? <Circle cx={size / 2} cy={size / 2} r={size / 2 - metrics.ring} color={vars[ground]} /> : null}
        <Group transform={[{ translateX: inset }, { translateY: inset }]}>
          {gradient ? (
            <CardFill gradient={gradient} size={faceSize} clip={clip} />
          ) : (
            <Circle cx={face / 2} cy={face / 2} r={face / 2} color={vars[paint.face]} />
          )}
        </Group>
      </Canvas>
      <View style={[StyleSheet.absoluteFill, styles.centre]}>
        <Text {...INITIAL_SCALING} style={[initial, { color: vars[paint.ink] }]}>
          {initialOf(name)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});
