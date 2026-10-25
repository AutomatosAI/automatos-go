// Play's page glow (D54): playGlowPlan's layers as Skia radial gradients behind the screen — the
// look's glow at the level for Auto's state, and the coral snag layer — each fading to its new
// opacity over 600 ms on --pl-ease-out (at once under Reduce Motion: the plan's fadeMs is 0).
// Decoration: no touches, hidden from accessibility; Auto's caption is the glow's text twin.

import { Canvas, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { PLAY_GLOW_EASING, type LightLayer, type PlayGlowPlan } from './play-glow';
import { radialGeometry, type RadialGeometry, type Size } from './spots';
import { useLayoutSize } from './use-size';

const GLOW_EASING = Easing.bezier(...PLAY_GLOW_EASING);

/** A shared opacity that follows target, fading over fadeMs (0: at once). */
function useFade(target: number, fadeMs: number): SharedValue<number> {
  const opacity = useSharedValue(target);
  useEffect(() => {
    opacity.value =
      fadeMs > 0 ? withTiming(target, { duration: fadeMs, easing: GLOW_EASING }) : target;
  }, [opacity, target, fadeMs]);
  return opacity;
}

type LightProps = {
  readonly layer: LightLayer;
  readonly geometry: RadialGeometry;
  readonly size: Size;
  readonly fadeMs: number;
};

function Light({ layer, geometry, size, fadeMs }: LightProps) {
  const opacity = useFade(layer.opacity, fadeMs);
  const centre = vec(geometry.cx, geometry.cy);
  return (
    <Rect x={0} y={0} width={size.width} height={size.height} opacity={opacity}>
      <RadialGradient
        c={centre}
        r={geometry.r}
        colors={[layer.stops.centre, layer.stops.edge]}
        positions={[...geometry.positions]}
        origin={centre}
        transform={[{ scaleY: geometry.scaleY }]}
      />
    </Rect>
  );
}

export type PlayGlowProps = {
  /** groundPlan's Play plan; null where the screen draws no light. */
  readonly plan: PlayGlowPlan | null;
};

export function PlayGlow({ plan }: PlayGlowProps) {
  const [size, onLayout] = useLayoutSize();
  const geometry = useMemo(
    () => (plan && size ? radialGeometry(plan.spot, size) : null),
    [plan, size],
  );
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {plan && size && geometry ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Light layer={plan.light} geometry={geometry} size={size} fadeMs={plan.fadeMs} />
          {plan.snag ? (
            <Light layer={plan.snag} geometry={geometry} size={size} fadeMs={plan.fadeMs} />
          ) : null}
        </Canvas>
      ) : null}
    </View>
  );
}
