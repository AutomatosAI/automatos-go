// The ground of Candy's home views (CANDY-LAYOUT §3 and §4; P1, P3 and P4): the page colour, on
// Vivid the aura's three blurred blobs over it (tokens/candy-paint.ts auraCircles: half the width,
// blur 40, at the top right, the right middle and the bottom left of the view), and the band's
// gradient behind the top of the view at a given height (440 on Today, 300 on Shelf and Team) with
// its lower edge curved, half the width by 14 % (Today) to 18 % (Shelf, Team) of its height
// (shapes.ts bandPath). Drawn by Skia to the size the view lays out at, behind everything in it.
// Decoration: no touches, hidden from VoiceOver.

import { BlurMask, Canvas, Circle, LinearGradient, Path, Rect, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLayoutSize } from '../../ground/use-size';
import type { Size } from '../../ground/spots';
import { auraCircles, bandGradient } from '../../tokens/candy-paint';
import { BAND_CURVE, bandPath } from './shapes';
import { useCandyPaint } from './use-candy-paint';
import { useSkiaPath } from './use-skia-path';

export type BandProps = {
  /** The band's height from the top of the view. */
  readonly height: number;
  /** The lower edge's depth as a share of the height: 0.14 (Today, the default) to 0.18. */
  readonly curve?: number;
};

type GroundProps = Required<BandProps> & { readonly area: Size };

function Ground({ area, height, curve }: GroundProps) {
  const { look, vars } = useCandyPaint();
  const band = useMemo(() => ({ w: area.width, h: height }), [area.width, height]);
  const gradient = useMemo(() => bandGradient(look, band), [look, band]);
  const aura = useMemo(
    () => auraCircles(look, { w: area.width, h: area.height }),
    [look, area.width, area.height],
  );
  const outline = useSkiaPath(bandPath(band, curve));
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={area.width} height={area.height} color={vars.page} />
      {aura.map((blob, index) => (
        <Circle key={index} c={vec(blob.c.x, blob.c.y)} r={blob.r} color={blob.colour}>
          <BlurMask blur={blob.blur} style="normal" />
        </Circle>
      ))}
      {outline ? (
        <Path path={outline}>
          <LinearGradient
            start={vec(gradient.start.x, gradient.start.y)}
            end={vec(gradient.end.x, gradient.end.y)}
            colors={[...gradient.colours]}
            positions={[...gradient.positions]}
          />
        </Path>
      ) : null}
    </Canvas>
  );
}

export function Band({ height, curve = BAND_CURVE.min }: BandProps) {
  const [area, onLayout] = useLayoutSize();
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {area ? <Ground area={area} height={height} curve={curve} /> : null}
    </View>
  );
}
