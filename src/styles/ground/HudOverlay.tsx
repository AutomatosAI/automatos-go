// HUD's ground (D54), drawn by Skia from hudGroundPlan: layer 'ground' under the content — the
// radial glow, 320 x 320 at 50 % 40 % fading out by 70 %, and 1 pt grid lines every 32 pt in the
// grid colour; layer 'scanlines' over the content while the look's scan is on — a 1 pt line every
// 3 pt in black at 18 % (tokens/hud.ts). Static, never takes a touch, hidden from accessibility.

import { Canvas, Path, RadialGradient, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { gridBars, scanlineBars, type Bar, type HudGroundPlan } from './hud-ground';
import { radialGeometry, type Size } from './spots';
import { useLayoutSize } from './use-size';

/** One path of filled rectangles: a Skia path is built imperatively, once per size. */
function barsPath(bars: readonly Bar[]) {
  const path = Skia.Path.Make();
  bars.forEach((bar) => path.addRect(Skia.XYWHRect(bar.x, bar.y, bar.width, bar.height)));
  return path;
}

function Bars({ bars, colour }: { readonly bars: readonly Bar[]; readonly colour: string }) {
  const path = useMemo(() => barsPath(bars), [bars]);
  return <Path path={path} color={colour} />;
}

function Glow({ plan, size }: { readonly plan: HudGroundPlan; readonly size: Size }) {
  const geometry = radialGeometry(plan.spot, size);
  const centre = vec(geometry.cx, geometry.cy);
  return (
    <Rect x={0} y={0} width={size.width} height={size.height}>
      <RadialGradient
        c={centre}
        r={geometry.r}
        colors={[plan.colours.glow.centre, plan.colours.glow.edge]}
        positions={[...geometry.positions]}
        origin={centre}
        transform={[{ scaleY: geometry.scaleY }]}
      />
    </Rect>
  );
}

type LayerProps = { readonly plan: HudGroundPlan; readonly size: Size };

function GroundLayer({ plan, size }: LayerProps) {
  const bars = useMemo(() => gridBars(size), [size]);
  return (
    <>
      <Glow plan={plan} size={size} />
      {plan.grid ? <Bars bars={bars} colour={plan.colours.grid} /> : null}
    </>
  );
}

function ScanlineLayer({ plan, size }: LayerProps) {
  const bars = useMemo(() => scanlineBars(size), [size]);
  return <Bars bars={bars} colour={plan.colours.scanline} />;
}

export type HudOverlayLayer = 'ground' | 'scanlines';

export type HudOverlayProps = {
  readonly plan: HudGroundPlan;
  /** 'ground' goes under the content, 'scanlines' over it. */
  readonly layer: HudOverlayLayer;
};

export function HudOverlay({ plan, layer }: HudOverlayProps) {
  const [size, onLayout] = useLayoutSize();
  if (layer === 'scanlines' && !plan.scan) return null;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {size ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {layer === 'ground' ? (
            <GroundLayer plan={plan} size={size} />
          ) : (
            <ScanlineLayer plan={plan} size={size} />
          )}
        </Canvas>
      ) : null}
    </View>
  );
}
