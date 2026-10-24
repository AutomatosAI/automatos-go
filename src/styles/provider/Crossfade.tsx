// The flip's crossfade (D54): the whole app as it looks now is snapshotted into an image (Skia's
// makeImageFromView, in the build since the scaffold, KS7), laid over the app, the new style is
// painted underneath, and the image fades out. The image is on screen for FRAMES_BEFORE_SWAP
// frames before the swap, so the new style never shows first. A flip that comes while the
// snapshot is being taken replaces the waiting swap (the newest choice wins); one that comes while
// the image fades applies at once under it. No snapshot (a failed or empty one, an unmeasured
// root, a 0 ms flip under Reduce Motion) swaps at once. The overlay takes no touch and is hidden
// from accessibility; the snapshotted view is the provider's root, so the toast is in it too.

import { Canvas, Image, makeImageFromView, type SkImage } from '@shopify/react-native-skia';
import { useCallback, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { logger } from '../../lib/logger';
import type { RunCrossfade } from './context';

/** Frames the snapshot is drawn over the old style before the new one is painted beneath it. */
const FRAMES_BEFORE_SWAP = 2;
/** Frames after the overlay is gone before its image is freed (the canvas has let go of it). */
const FRAMES_BEFORE_FREE = 2;

type Size = { readonly width: number; readonly height: number };
type Phase = 'idle' | 'snapshot' | 'fading';

export type CrossfadeLayer = {
  readonly ref: RefObject<View | null>;
  readonly snapshot: SkImage | null;
  readonly opacity: SharedValue<number>;
  readonly size: Size;
  readonly onLayout: (event: LayoutChangeEvent) => void;
};

function afterFrames(count: number, run: () => void): void {
  if (count <= 0) {
    run();
    return;
  }
  requestAnimationFrame(() => afterFrames(count - 1, run));
}

function useSnapshotState() {
  const [snapshot, setSnapshot] = useState<SkImage | null>(null);
  const shown = useRef<SkImage | null>(null);
  const show = useCallback((image: SkImage) => {
    shown.current = image;
    setSnapshot(image);
  }, []);
  const clear = useCallback(() => {
    const image = shown.current;
    shown.current = null;
    setSnapshot(null);
    if (image) afterFrames(FRAMES_BEFORE_FREE, () => image.dispose());
  }, []);
  return { snapshot, show, clear };
}

/** The crossfade's runner and the layer CrossfadeRoot draws; ThemeProvider holds one. */
export function useCrossfade(): { readonly run: RunCrossfade; readonly layer: CrossfadeLayer } {
  const ref = useRef<View>(null);
  const { snapshot, show, clear } = useSnapshotState();
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const measured = useRef(false);
  const phase = useRef<Phase>('idle');
  const waiting = useRef<(() => void) | null>(null);
  const opacity = useSharedValue(0);

  const settle = useCallback(() => {
    phase.current = 'idle';
    clear();
  }, [clear]);

  const swapAndFade = useCallback(
    (durationMs: number) => {
      const swap = waiting.current;
      waiting.current = null;
      phase.current = 'fading';
      swap?.();
      opacity.value = withTiming(0, { duration: durationMs }, () => runOnJS(settle)());
    },
    [opacity, settle],
  );

  const run = useCallback<RunCrossfade>(
    (swap, durationMs) => {
      if (phase.current === 'snapshot') {
        waiting.current = swap;
        return;
      }
      if (durationMs <= 0 || phase.current === 'fading' || !measured.current) {
        swap();
        return;
      }
      phase.current = 'snapshot';
      waiting.current = swap;
      makeImageFromView(ref)
        .then((image) => {
          if (!image) throw new Error('the snapshot came back empty');
          opacity.value = 1;
          show(image);
          afterFrames(FRAMES_BEFORE_SWAP, () => swapAndFade(durationMs));
        })
        .catch((error: unknown) => {
          logger.warn('[styles] no snapshot for the crossfade; flipping at once', error);
          const pending = waiting.current;
          waiting.current = null;
          phase.current = 'idle';
          pending?.();
        });
    },
    [opacity, show, swapAndFade],
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    measured.current = width > 0 && height > 0;
    setSize({ width, height });
  }, []);

  const layer = useMemo<CrossfadeLayer>(
    () => ({ ref, snapshot, opacity, size, onLayout }),
    [snapshot, opacity, size, onLayout],
  );
  return { run, layer };
}

type CrossfadeRootProps = {
  readonly layer: CrossfadeLayer;
  readonly children: ReactNode;
};

/** The app under the snapshot it fades from. */
export function CrossfadeRoot({ layer, children }: CrossfadeRootProps) {
  const { opacity } = layer;
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View style={styles.fill}>
      <View ref={layer.ref} collapsable={false} style={styles.fill} onLayout={layer.onLayout}>
        {children}
      </View>
      {layer.snapshot ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, fade]}
        >
          <Canvas style={styles.fill}>
            <Image
              image={layer.snapshot}
              x={0}
              y={0}
              width={layer.size.width}
              height={layer.size.height}
              fit="fill"
            />
          </Canvas>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
