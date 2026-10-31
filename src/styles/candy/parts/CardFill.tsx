// A card gradient drawn with Skia inside a canvas (CANDY-LAYOUT §3; tokens/candy-paint.ts
// cardGradient): the linear gradient, then Vivid's two corner glows, then the white highlight, each
// a rectangle of the card's size with its shader, all clipped to the card's outline. The cards, the
// avatars and the Deliverables' squares share it.

import {
  Group,
  LinearGradient,
  RadialGradient,
  Rect,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';

import type { CardGradient, PaintSize, RadialPaint } from '../../tokens/candy-paint';

function Spot({ paint, size }: { readonly paint: RadialPaint; readonly size: PaintSize }) {
  return (
    <Rect x={0} y={0} width={size.w} height={size.h}>
      <RadialGradient
        c={vec(paint.c.x, paint.c.y)}
        r={paint.r}
        colors={[...paint.colours]}
        positions={[...paint.positions]}
      />
    </Rect>
  );
}

export type CardFillProps = {
  readonly gradient: CardGradient;
  readonly size: PaintSize;
  /** The outline the paint is clipped to; the whole rectangle while it has none. */
  readonly clip: SkPath | null;
};

export function CardFill({ gradient, size, clip }: CardFillProps) {
  const { linear, glows, highlight } = gradient;
  return (
    <Group clip={clip ?? undefined}>
      <Rect x={0} y={0} width={size.w} height={size.h}>
        <LinearGradient
          start={vec(linear.start.x, linear.start.y)}
          end={vec(linear.end.x, linear.end.y)}
          colors={[...linear.colours]}
          positions={[...linear.positions]}
        />
      </Rect>
      {glows.map((glow, index) => (
        <Spot key={index} paint={glow} size={size} />
      ))}
      <Spot paint={highlight} size={size} />
    </Group>
  );
}
