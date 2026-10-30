// Candy's Auto on screen (PRD-001 §4.6.2, D-CAN-5; the kit's art/auto.tsx, ported): Skia draws
// autoParts(state) from the vendored geometry at the given size, the kit's 104-unit box scaled to
// it (56 on Today's header, 128 on the stage, 140 on the edges, inside the voice orb). Each shape is
// the vendored SVG path (an arch, a celebrating eye, filled even-odd); each paint a solid, a linear
// or a radial gradient, every colour through candyAutoColour (tokens/mascot-colours.ts); a part's
// glow is a blur of its shape behind it. While Candy moves he floats and blinks on the one clock
// (use-auto-motion.ts): the float moves the whole drawing, the blink scales the eyes about their
// centres; under Reduce Motion, the look's Motion paused, the pause control or `still` he is at
// rest with his eyes open. The canvas reaches past his square on every side so the float and the
// glows are never cut; layout sees only the square. VoiceOver hears 'Auto, {what he is doing}'
// (captionFor) unless the caller names him otherwise, or passes null where the words around say it.

import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Skia,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { captionFor } from '../../../core/frozen/lib/mascot/media';
import type { MascotName } from '../../../core/frozen/lib/mascot/types';
import { logger } from '../../../lib/logger';
import { candyAutoColour } from '../../tokens/mascot-colours';
import { CANDY_AUTO_COPY } from '../strings';
import { useCandyMotion } from '../use-candy-motion';
import { AUTO_BOX, EYE_PARTS, autoParts, type Paint, type Part } from './auto-geometry';
import { shapePath } from './auto-path';
import { useAutoMotion } from './use-auto-motion';

/** Room past the square on every side, in box units: the ball's glow (3σ of 3) over the float. */
const OVERFLOW_UNITS = 12;
/** The SVG's feGaussianBlur takes blur / 2 as its deviation; Skia's mask takes the same sigma. */
const GLOW_SIGMA = 0.5;

type DrawnPart = {
  readonly part: Part;
  readonly path: SkPath;
  readonly evenOdd: boolean;
  readonly blinks: boolean;
  /** The shape's centre, the blink's origin. */
  readonly centre: { readonly x: number; readonly y: number };
};

function drawnPart(part: Part): DrawnPart | null {
  const path = Skia.Path.MakeFromSVGString(shapePath(part.shape));
  if (!path) {
    logger.warn("[styles] Candy's Auto: a shape's path did not parse; it is left out", part.name);
    return null;
  }
  const { x, y, w, h } = part.shape;
  return {
    part,
    path,
    evenOdd: part.shape.kind === 'arch',
    blinks: EYE_PARTS.has(part.name),
    centre: { x: x + w / 2, y: y + h / 2 },
  };
}

function drawnParts(state: MascotName): readonly DrawnPart[] {
  return autoParts(state)
    .map(drawnPart)
    .filter((drawn): drawn is DrawnPart => drawn !== null);
}

function PaintLayer({ drawn, paint }: { readonly drawn: DrawnPart; readonly paint: Paint }) {
  const fillType = drawn.evenOdd ? 'evenOdd' : 'winding';
  if (paint.kind === 'solid') {
    const colour = candyAutoColour(paint.colour, paint.alpha);
    return <Path path={drawn.path} fillType={fillType} color={colour} />;
  }
  const colors = paint.stops.map((stop) => candyAutoColour(stop.colour, stop.alpha));
  const positions = paint.stops.map((stop) => stop.at);
  return (
    <Path path={drawn.path} fillType={fillType}>
      {paint.kind === 'linear' ? (
        <LinearGradient
          start={vec(paint.x1, paint.y1)}
          end={vec(paint.x2, paint.y2)}
          colors={colors}
          positions={positions}
        />
      ) : (
        <RadialGradient
          c={vec(paint.cx, paint.cy)}
          r={paint.r}
          colors={colors}
          positions={positions}
        />
      )}
    </Path>
  );
}

/** One part, its glow behind it, scaled about its centre by `eyeScale` (the blink: 1 but on eyes). */
const AutoPart = memo(function AutoPart({
  drawn,
  eyeScale,
}: {
  readonly drawn: DrawnPart;
  readonly eyeScale: number;
}) {
  const { part, centre } = drawn;
  const glow = part.glow;
  return (
    <Group origin={vec(centre.x, centre.y)} transform={[{ scaleY: eyeScale }]}>
      {glow ? (
        <Path
          path={drawn.path}
          fillType={drawn.evenOdd ? 'evenOdd' : 'winding'}
          color={candyAutoColour(glow.colour, glow.alpha)}
        >
          <BlurMask blur={glow.blur * GLOW_SIGMA} style="normal" />
        </Path>
      ) : null}
      {part.paints.map((paint, index) => (
        <PaintLayer key={index} drawn={drawn} paint={paint} />
      ))}
    </Group>
  );
});

export type CandyAutoProps = {
  /** Auto's state: one of the vendored mascot names. */
  readonly state: MascotName;
  /** His square's side in points. */
  readonly size: number;
  /** What VoiceOver hears: 'Auto, {captionFor(state)}' when omitted; null where words name him. */
  readonly label?: string | null;
  /** At rest whatever the motion (a gallery's stills, the picker's card). */
  readonly still?: boolean;
};

export function CandyAuto({ state, size, label, still = false }: CandyAutoProps) {
  const { moving } = useCandyMotion();
  const motion = useAutoMotion(moving && !still);
  const parts = useMemo(() => drawnParts(state), [state]);
  const scale = size / AUTO_BOX.size;
  const room = OVERFLOW_UNITS * scale;
  const name = label === undefined ? CANDY_AUTO_COPY.name(captionFor(state)) : label;
  const named = name !== null;
  const canvas = { left: -room, top: -room, width: size + room * 2, height: size + room * 2 };
  return (
    <View
      style={{ width: size, height: size }}
      pointerEvents="none"
      accessible={named}
      accessibilityRole={named ? 'image' : undefined}
      accessibilityLabel={name ?? undefined}
      accessibilityElementsHidden={!named}
      importantForAccessibility={named ? 'yes' : 'no-hide-descendants'}
    >
      <Canvas style={[styles.canvas, canvas]}>
        <Group
          transform={[
            { translateX: room },
            { translateY: room },
            { scale },
            { translateX: -AUTO_BOX.x },
            { translateY: motion.floatY - AUTO_BOX.y },
          ]}
        >
          {parts.map((drawn) => (
            <AutoPart
              key={drawn.part.name}
              drawn={drawn}
              eyeScale={drawn.blinks ? motion.eyeScale : 1}
            />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'absolute' },
});
