// Candy's orb (CANDY-LAYOUT §3 and §4 P1; the kit's art/orb.tsx and orb.module.css at 3920359d5):
// orbPaint at its side, drawn by Skia — the conic of the three cards' starts and a pink as a sweep
// from 210°, its pink blush and white gloss, the white 4 pt arc on its right and lower edge and the
// thin ring round it — over the palette's tinted shadow, with the figure (Outfit 700 60, white, its
// shadow) and the caption (Nunito 800 14) in the middle. The arc turns once every 20 s on Candy's
// one clock while Candy moves (useCandyMotion), and rests under Reduce Motion, the look's Motion,
// the pause control or `still`. The ball grows with Dynamic Type up to the room it has (orb-model.ts
// orbSide); the ring reaches past the square without taking layout. VoiceOver hears the figure
// and caption as one line ('3 need you').

import {
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Skia,
  SweepGradient,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Text } from '../../../ui';
import { SHARED_COLOURS } from '../../tokens/candy-catalogue';
import { orbPaint, type ArcPaint, type OrbPaint, type RadialPaint } from '../../tokens/candy-paint';
import { CANDY_LEADING, candyOrbFigure } from '../../typeface/candy-type';
import { clockMs } from '../auto/clock';
import { useCandyTick } from '../auto/use-auto-motion';
import { CANDY_COPY } from '../strings';
import { useCandyMotion } from '../use-candy-motion';
import {
  ORB,
  ORB_WORDS_SHADOW,
  ORB_WORDS_SHARE,
  PAGE_GUTTER,
  orbReach,
  orbSide,
  orbTurnAt,
  turnedArc,
} from './orb-model';
import { useCandyPaint } from './use-candy-paint';

const FIGURE = candyOrbFigure();
const WORDS_SHADOW = Object.freeze({
  textShadowColor: SHARED_COLOURS.figureShadow,
  textShadowOffset: Object.freeze({ width: 0, height: ORB_WORDS_SHADOW.offsetY }),
  textShadowRadius: ORB_WORDS_SHADOW.radius,
});

export type OrbProps = {
  /** The big number, as text ('3', or '—' while it is unknown). */
  readonly figure: string;
  readonly caption: string;
  /** The ball's side at the default text size; 200 (Today's) when omitted. */
  readonly size?: number;
  /** The widest the ball may grow; the screen less the page's gutters when omitted. */
  readonly room?: number;
  /** Never turns, whatever the motion. */
  readonly still?: boolean;
};

/** How far the arc has turned: on the clock while moving, at rest otherwise. */
function useOrbTurn(moving: boolean): number {
  const tick = useCandyTick(moving);
  return moving ? orbTurnAt(clockMs(tick)) : 0;
}

function Layer({ paint, side }: { readonly paint: RadialPaint; readonly side: number }) {
  return (
    <Circle cx={side / 2} cy={side / 2} r={side / 2}>
      <RadialGradient
        c={vec(paint.c.x, paint.c.y)}
        r={paint.r}
        colors={[...paint.colours]}
        positions={[...paint.positions]}
      />
    </Circle>
  );
}

function arcPath(arc: ArcPaint): SkPath {
  const path = Skia.Path.Make();
  const { x, y, width, height } = arc.rect;
  path.addArc(Skia.XYWHRect(x, y, width, height), arc.start, arc.sweep);
  return path;
}

function Ball({ paint, side, turn }: { readonly paint: OrbPaint; readonly side: number; readonly turn: number }) {
  const { sweep, halo, arc } = paint;
  const centre = vec(sweep.c.x, sweep.c.y);
  const path = useMemo(() => arcPath(turnedArc(arc, turn)), [arc, turn]);
  return (
    <>
      <Circle c={centre} r={side / 2}>
        <SweepGradient
          c={centre}
          colors={[...sweep.colours]}
          positions={[...sweep.positions]}
          origin={centre}
          transform={[{ rotate: sweep.rotate }]}
        />
      </Circle>
      <Layer paint={paint.blush} side={side} />
      <Layer paint={paint.gloss} side={side} />
      <Path path={path} style="stroke" strokeWidth={arc.strokeWidth} color={arc.colour} />
      <Circle
        c={vec(halo.c.x, halo.c.y)}
        r={halo.r}
        style="stroke"
        strokeWidth={halo.strokeWidth}
        color={halo.colour}
      />
    </>
  );
}

export function Orb({ figure, caption, size = ORB.size, room, still = false }: OrbProps) {
  const { look, vars, type, shadow } = useCandyPaint();
  const { moving } = useCandyMotion();
  const { width, fontScale } = useWindowDimensions();
  const side = orbSide(size, fontScale, room ?? width - PAGE_GUTTER * 2);
  const paint = useMemo(() => orbPaint(look, side), [look, side]);
  const turn = useOrbTurn(moving && !still);
  const reach = orbReach(paint, side);
  const canvas = { left: -reach, top: -reach, width: side + reach * 2, height: side + reach * 2 };
  const ink = { color: vars.cardInk, maxWidth: side * ORB_WORDS_SHARE };
  const captionFace = type.body(ORB.caption, 800, { leading: CANDY_LEADING.label });
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={CANDY_COPY.orbLabel(figure, caption)}
      style={{ width: side, height: side }}
    >
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: side / 2, backgroundColor: vars.g1a }, shadow]}
      />
      <Canvas pointerEvents="none" style={[styles.canvas, canvas]}>
        <Group transform={[{ translateX: reach }, { translateY: reach }]}>
          <Ball paint={paint} side={side} turn={turn} />
        </Group>
      </Canvas>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.words]}>
        <Text style={[FIGURE, WORDS_SHADOW, ink, styles.centred]}>{figure}</Text>
        <Text style={[captionFace, WORDS_SHADOW, ink, styles.centred]}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'absolute' },
  words: { alignItems: 'center', justifyContent: 'center' },
  centred: { textAlign: 'center' },
});
