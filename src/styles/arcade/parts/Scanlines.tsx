// A window's scanlines (README 'Look and feel', PRD-001 §4.6.1): drawn by Skia behind the window's
// content, never over it, from window-frame.ts scanPlan — a line every period counted from the
// bottom (ground/hud-ground.ts scanlineBars, CSS's repeating-linear-gradient at 0deg) in the tone's
// ink at the look's alpha, with no antialiasing so each line sits on whole points. Nothing at Off
// or where a line would take a text colour below AA. Static, never takes a touch, hidden from
// VoiceOver. ArcadeWindow places it; nothing else does (scanlines live inside a window only).

import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { scanlineBars } from '../../ground/hud-ground';
import type { Size } from '../../ground/spots';
import { useLayoutSize } from '../../ground/use-size';
import type { ScanPlan } from './window-frame';

/** One path of the lines: a Skia path is built imperatively, once per size and plan. */
function linesPath(size: Size, plan: ScanPlan) {
  const path = Skia.Path.Make();
  scanlineBars(size, plan.period, plan.line).forEach((bar) =>
    path.addRect(Skia.XYWHRect(bar.x, bar.y, bar.width, bar.height)),
  );
  return path;
}

function Lines({ size, plan }: { readonly size: Size; readonly plan: ScanPlan }) {
  const path = useMemo(() => linesPath(size, plan), [size, plan]);
  return <Path path={path} color={plan.colour} antiAlias={false} />;
}

export type ScanlinesProps = {
  /** The window's plan (window-frame.ts scanPlan); null draws nothing. */
  readonly plan: ScanPlan | null;
};

export function Scanlines({ plan }: ScanlinesProps) {
  const [size, onLayout] = useLayoutSize();
  if (!plan) return null;
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
          <Lines size={size} plan={plan} />
        </Canvas>
      ) : null}
    </View>
  );
}
