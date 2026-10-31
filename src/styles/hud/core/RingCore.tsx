// HUD's voice core (D54, D-ONE-VOICE): ring-specs.ts drawn by Skia in the colour it is given (the
// resolved accent: HUD's, Play's ember, Studio's orange or ink in A6), each ring's alpha a paint
// opacity. The five rings that turn do so on reanimated, each at its own period and way round, and
// the disc at the centre breathes; while loops may not run (Reduce Motion, HUD's motion off) every
// ring stands still at rest and the disc at full size. Decoration: no touches, hidden from
// VoiceOver (the state chip under it says what it shows). A6's voice screen may paint the rings'
// structure (the outer ring, the ticks, the dashed ring and the crosshair) in a line colour of its
// own, Studio's ink (KV9); their motion (the arcs, the segments, the pulse) keeps the colour. It may
// also fill the disc at the centre (the pulse's circle) over the pulse and the crosshair: Arcade's
// window, flat, for its sprite to stand on (US-022i). Candy's voice screen (US-023l) strokes every
// ring in a gradient, the card sets' starts swept round the centre (pink, violet, blue and back),
// turning with the ring it paints. Loops follow useVoiceCore (Arcade's and Candy's pause too).

import {
  BlurMask,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Skia,
  SweepGradient,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Easing, useDerivedValue } from 'react-native-reanimated';

import { blurSigma } from '../../mascot/geometry';
import { clearOf } from '../../tokens/voice-colours';
import {
  CSS_EASE_IN_OUT,
  arcGroups,
  ringSpecs,
  skiaAngle,
  type Crosshair,
  type RingArc,
  type RingPulse,
  type RingSpin,
  type RingStroke,
} from './ring-specs';
import { useLoop } from './use-loop';
import { useVoiceCore } from './use-voice-core';

const FULL_CIRCLE = 360;
/** The rings that are structure, not motion: lineColour paints them (and the crosshair). */
const STRUCTURE: ReadonlySet<string> = new Set(['outer', 'ticks', 'dashed']);
const TURN = 2 * Math.PI;
const PULSE_EASING = Easing.bezier(...CSS_EASE_IN_OUT);

function arcsPath(arcs: readonly RingArc[], centre: number, radius: number): SkPath {
  const path = Skia.Path.Make();
  const oval = Skia.XYWHRect(centre - radius, centre - radius, radius * 2, radius * 2);
  arcs.forEach((arc) => {
    if (arc.sweep >= FULL_CIRCLE) path.addCircle(centre, centre, radius);
    else path.addArc(oval, skiaAngle(arc.start), arc.sweep);
  });
  return path;
}

/** A turn every periodMs, its way round; at rest (0) while still. */
function useSpin(spin: RingSpin | null, loops: boolean) {
  const progress = useLoop(loops && spin !== null, spin?.periodMs ?? 1);
  const direction = spin?.direction ?? 1;
  return useDerivedValue(() => [{ rotate: direction * TURN * progress.get() }]);
}

type StrokeProps = {
  readonly stroke: RingStroke;
  readonly centre: number;
  readonly colour: string;
  readonly loops: boolean;
  /** The colours swept round the centre in place of `colour`, closed (the first again last). */
  readonly sweep?: readonly string[];
};

/** The sweep's shader for a ring's path; none without a sweep. */
function SweepPaint({ sweep, centre }: { readonly sweep?: readonly string[]; readonly centre: number }) {
  return sweep ? <SweepGradient c={vec(centre, centre)} colors={[...sweep]} /> : null;
}

function Stroke({ stroke, centre, colour, loops, sweep }: StrokeProps) {
  const groups = useMemo(
    () =>
      arcGroups(stroke.arcs).map((group) => ({
        alpha: group.alpha,
        path: arcsPath(group.arcs, centre, stroke.radius),
      })),
    [stroke, centre],
  );
  const transform = useSpin(stroke.spin, loops);
  const paint = {
    color: colour,
    style: 'stroke',
    strokeWidth: stroke.width,
    strokeCap: 'butt',
  } as const;
  return (
    <Group transform={transform} origin={vec(centre, centre)}>
      {stroke.glow > 0
        ? groups.map(({ alpha, path }) => (
            <Path key={`glow-${alpha}`} path={path} {...paint} opacity={alpha}>
              <SweepPaint sweep={sweep} centre={centre} />
              <BlurMask blur={blurSigma(stroke.glow)} style="normal" />
            </Path>
          ))
        : null}
      {groups.map(({ alpha, path }) => (
        <Path key={alpha} path={path} {...paint} opacity={alpha}>
          <SweepPaint sweep={sweep} centre={centre} />
          {stroke.dash ? <DashPathEffect intervals={[stroke.dash.on, stroke.dash.off]} /> : null}
        </Path>
      ))}
    </Group>
  );
}

type PulseProps = {
  readonly pulse: RingPulse;
  readonly centre: number;
  readonly colour: string;
  readonly loops: boolean;
};

/** 0.55 ↔ 1 and 0.96 ↔ 1.04 over the period (half each way); full size and opacity while still. */
function Pulse({ pulse, centre, colour, loops }: PulseProps) {
  const progress = useLoop(loops, pulse.periodMs / 2, { alternate: true, easing: PULSE_EASING });
  const [lowScale, highScale] = pulse.scale;
  const [lowOpacity, highOpacity] = pulse.opacity;
  const transform = useDerivedValue(() => [
    { scale: loops ? lowScale + (highScale - lowScale) * progress.get() : 1 },
  ]);
  const opacity = useDerivedValue(() =>
    loops ? lowOpacity + (highOpacity - lowOpacity) * progress.get() : 1,
  );
  const origin = vec(centre, centre);
  return (
    <Group transform={transform} origin={origin} opacity={opacity}>
      <Circle cx={centre} cy={centre} r={pulse.radius} opacity={pulse.alpha}>
        <RadialGradient
          c={origin}
          r={pulse.ray}
          colors={[colour, clearOf(colour)]}
          positions={[0, pulse.fadeEnd]}
        />
      </Circle>
    </Group>
  );
}

type CrosshairProps = { readonly crosshair: Crosshair; readonly colour: string };

/** Each line fades in to its middle alpha and out again along its length; it never moves. */
function CrosshairLines({ crosshair, colour }: CrosshairProps) {
  const clear = clearOf(colour);
  const [, middle] = crosshair.alphas;
  return (
    <>
      {crosshair.lines.map(({ key, x, y, width, height }) => {
        const end = key === 'vertical' ? vec(x, y + height) : vec(x + width, y);
        return (
          <Rect key={key} x={x} y={y} width={width} height={height} opacity={middle}>
            <LinearGradient start={vec(x, y)} end={end} colors={[clear, colour, clear]} />
          </Rect>
        );
      })}
    </>
  );
}

export type RingCoreProps = {
  /** The core's side in points (290 on the phone). */
  readonly size: number;
  /** The resolved accent, #rrggbb: every ring is this colour at its own alpha. */
  readonly colour: string;
  /** A6: the structure's colour (Studio's ink, #rrggbb); absent, the structure is `colour` too. */
  readonly lineColour?: string;
  /** The disc at the centre, filled flat (Arcade's window); absent, the pulse shows through. */
  readonly fill?: string;
  /** Every ring stroked in these colours swept round the centre (Candy's); absent, `colour`. */
  readonly gradient?: readonly string[];
};

/** The gradient closed into a loop for the sweep (its first colour again at the end). */
function closedSweep(gradient: readonly string[] | undefined): readonly string[] | undefined {
  const first = gradient?.[0];
  return gradient && first !== undefined ? [...gradient, first] : undefined;
}

export function RingCore({ size, colour, lineColour = colour, fill, gradient }: RingCoreProps) {
  const { loops } = useVoiceCore();
  const specs = useMemo(() => ringSpecs(size), [size]);
  const sweep = useMemo(() => closedSweep(gradient), [gradient]);
  return (
    <Canvas
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, top: 0, width: size, height: size }}
    >
      {specs.strokes.map((stroke) => (
        <Stroke
          key={stroke.key}
          stroke={stroke}
          centre={specs.centre}
          colour={STRUCTURE.has(stroke.key) ? lineColour : colour}
          loops={loops}
          sweep={sweep}
        />
      ))}
      <Pulse pulse={specs.pulse} centre={specs.centre} colour={colour} loops={loops} />
      <CrosshairLines crosshair={specs.crosshair} colour={lineColour} />
      {fill === undefined ? null : (
        <Circle cx={specs.centre} cy={specs.centre} r={specs.pulse.radius} color={fill} />
      )}
    </Canvas>
  );
}
