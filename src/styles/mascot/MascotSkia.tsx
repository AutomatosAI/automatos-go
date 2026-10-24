// Auto through Skia (KS11): every still (useImage), and on iOS a tinted shell's clip (useVideo on the
// same .mp4, while MASCOT_TINTED_CLIPS), drawn through <ColorMatrix> with the shell's matrix — the
// sleeping dim already composed into it (stage.ts) — since a native video view takes no filter.
// The still is the clip's poster: it shows until the clip's first frame and is hidden after it.
// A tinted clip has no loop flag either: near its end (nearClipEnd on the UI thread) it pauses and
// reports the run's boundary; a new run with the same file seeks to 0 and plays again, a new file
// mounts a new clip (keyed by file), and a finished one-shot stays paused on its last frame. Skia
// gives no 'ended', so a timer of the clip's length is the backstop (clip-boundary.ts).

import { Canvas, ColorMatrix, Image, useImage, useVideo } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Image as NativeImage, StyleSheet } from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import { logger } from '../../lib/logger';
import { CLIP_BACKSTOP_MS, nearClipEnd } from './clip-boundary';
import type { MascotFile } from './media';
import type { SkiaMedia } from './stage';

/** A bundled file's URI, resolved as Skia's useImage resolves a require(); a copy is its own URI. */
function fileUri(file: MascotFile): string {
  return typeof file === 'string' ? file : NativeImage.resolveAssetSource(file).uri;
}

const onStillError = (error: Error) => logger.warn("[styles] Auto's still did not load", error);

type Drawn = { readonly side: number; readonly matrix: readonly number[] };

/** Reports each run's boundary once, from the UI thread's check or the backstop timer. */
function useReportOnce(run: number, onBoundary: (run: number) => void) {
  const reported = useRef<number | null>(null);
  return useCallback(
    (ended: number) => {
      if (reported.current === ended || ended !== run) return;
      reported.current = ended;
      onBoundary(ended);
    },
    [run, onBoundary],
  );
}

type TintedClipProps = Drawn & {
  readonly clip: MascotFile;
  readonly poster: ReturnType<typeof useImage>;
  readonly run: number;
  readonly onBoundary: (run: number) => void;
};

function TintedClip({ clip, poster, side, matrix, run, onBoundary }: TintedClipProps) {
  const paused = useSharedValue(false);
  const seek = useSharedValue<number | null>(null);
  const uri = useMemo(() => fileUri(clip), [clip]);
  const video = useVideo(uri, { looping: false, paused, seek, volume: 0 });
  const { currentFrame, currentTime, duration } = video;
  const report = useReportOnce(run, onBoundary);
  const playing = useSharedValue(run);
  const started = useRef(run);

  useEffect(() => {
    if (started.current === run) return;
    started.current = run;
    playing.value = run;
    seek.value = 0;
    paused.value = false;
  }, [run, playing, seek, paused]);
  useEffect(() => {
    if (duration <= 0) return undefined;
    const timer = setTimeout(() => {
      paused.value = true;
      report(run);
    }, duration + CLIP_BACKSTOP_MS);
    return () => clearTimeout(timer);
  }, [duration, run, paused, report]);
  useAnimatedReaction(
    () => nearClipEnd(currentTime.value, duration),
    (atEnd, before) => {
      if (!atEnd || before === true || paused.value) return;
      paused.value = true;
      runOnJS(report)(playing.value);
    },
  );
  const posterOpacity = useDerivedValue(() => (currentFrame.value ? 0 : 1));
  const filter = useMemo(() => [...matrix], [matrix]);
  const box = { x: 0, y: 0, width: side, height: side, fit: 'contain' } as const;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image image={poster} {...box} opacity={posterOpacity}>
        <ColorMatrix matrix={filter} />
      </Image>
      <Image image={currentFrame} {...box}>
        <ColorMatrix matrix={filter} />
      </Image>
    </Canvas>
  );
}

export type MascotSkiaProps = {
  readonly media: SkiaMedia;
  /** The media box's side, in points (geometry.ts media). */
  readonly side: number;
  readonly run: number;
  readonly onBoundary: (run: number) => void;
};

export function MascotSkia({ media, side, run, onBoundary }: MascotSkiaProps) {
  const still = useImage(media.still, onStillError);
  const filter = useMemo(() => [...media.matrix], [media.matrix]);
  if (media.clip !== null) {
    return (
      <TintedClip
        key={fileUri(media.clip)}
        clip={media.clip}
        poster={still}
        side={side}
        matrix={media.matrix}
        run={run}
        onBoundary={onBoundary}
      />
    );
  }
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image image={still} x={0} y={0} width={side} height={side} fit="contain">
        <ColorMatrix matrix={filter} />
      </Image>
    </Canvas>
  );
}
