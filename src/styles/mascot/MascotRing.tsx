// The light ring under Auto (D-MASCOT): drawn by the app, not the clip, so it takes the style's
// colour (ring-palette.ts). Skia paints it as the web's CSS does, in CSS's order: the outer glow
// (box-shadow 0 0 22px, outside the ellipse only), the radial fill, the inset glow (inset 0 0 14px:
// everything outside the padding box, blurred, clipped inside it) and the 2 pt stroke (geometry.ts).
// While loops run it pulses as Ember's ring-pulse does (scale 1 → 1.06, opacity 0.8 → 1, 2.4 s
// ease-in-out, on reanimated); under Reduce Motion it stands still at its full size and opacity.
// Decoration: no touches, hidden from VoiceOver (the Mascot carries the name).

import {
  BlurMask,
  Canvas,
  Group,
  Oval,
  Path,
  RadialGradient,
  Skia,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ringColours } from '../tokens/mascot-colours';
import { RING_PULSE, RING_STROKE, type Box, type RingGeometry } from './geometry';

const PULSE_EASING = Easing.bezier(...RING_PULSE.easing);
const HALF_PERIOD_MS = RING_PULSE.periodMs / 2;

/** 0 → 1 → 0 over the pulse's period, forever; held at 0 (scale 1) and full opacity when still. */
function usePulse(pulse: boolean) {
  const progress = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (!pulse) return;
    progress.value = withRepeat(
      withTiming(1, { duration: HALF_PERIOD_MS, easing: PULSE_EASING }),
      -1,
      true,
    );
  }, [progress, pulse]);
  const transform = useDerivedValue(() => [{ scale: 1 + (RING_PULSE.scale - 1) * progress.value }]);
  const opacity = useDerivedValue(() =>
    pulse ? RING_PULSE.opacity + (1 - RING_PULSE.opacity) * progress.value : 1,
  );
  return { transform, opacity };
}

/** The canvas with the padding box cut out: the shape an inset shadow is the blur of. */
function insetShape(canvas: Box, inner: Box): SkPath {
  const path = Skia.Path.Make();
  path.addRect(Skia.XYWHRect(0, 0, canvas.width, canvas.height));
  path.addOval(Skia.XYWHRect(inner.x, inner.y, inner.width, inner.height));
  return path;
}

function ovalClip(box: Box): SkPath {
  const path = Skia.Path.Make();
  path.addOval(Skia.XYWHRect(box.x, box.y, box.width, box.height));
  return path;
}

export type MascotRingProps = {
  readonly ring: RingGeometry;
  /** The ring's #rrggbb for the state on screen. */
  readonly colour: string;
  /** Loops run: the ring pulses. */
  readonly pulse: boolean;
};

export function MascotRing({ ring, colour, pulse }: MascotRingProps) {
  const paints = useMemo(() => ringColours(colour), [colour]);
  const shapes = useMemo(
    () => ({ inset: insetShape(ring.canvas, ring.inner), clip: ovalClip(ring.inner) }),
    [ring],
  );
  const { transform, opacity } = usePulse(pulse);
  const { oval, stroke, centre } = ring;
  const origin = vec(centre.x, centre.y);
  return (
    <Canvas
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        left: ring.canvas.x,
        top: ring.canvas.y,
        width: ring.canvas.width,
        height: ring.canvas.height,
      }}
    >
      <Group transform={transform} origin={origin} opacity={opacity}>
        <Oval {...oval} color={paints.glow}>
          <BlurMask blur={ring.outerSigma} style="outer" />
        </Oval>
        <Oval {...oval}>
          <RadialGradient
            c={origin}
            r={ring.fill.r}
            colors={[paints.glow, paints.edge]}
            origin={origin}
            transform={[{ scaleY: ring.fill.scaleY }]}
          />
        </Oval>
        <Group clip={shapes.clip}>
          <Path path={shapes.inset} fillType="evenOdd" color={paints.glow}>
            <BlurMask blur={ring.innerSigma} style="normal" />
          </Path>
        </Group>
        <Oval {...stroke} color={paints.stroke} style="stroke" strokeWidth={RING_STROKE} />
      </Group>
    </Canvas>
  );
}
