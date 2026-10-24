// Auto's untinted clip on iOS (KS11): the HEVC-alpha .mp4 through expo-video's VideoView, a native
// view with a transparent background, so his alpha shows the ground. Muted, no controls, no
// fullscreen, no picture in picture, no AirPlay, no Live Text on a resting frame; it mixes with the
// phone's own audio and never keeps the screen awake. No loop flag: one player for the stage, and at
// each clip boundary the driver says what happens (use-mascot.ts) — a new run with the same file
// plays it again from the start, a new file replaces the player's source (replaceAsync), and a
// one-shot that finished rests on its last frame. The boundary is timeUpdate (every 250 ms) inside
// the vendored BOUNDARY_MS of the end, with playToEnd as the backstop, once per run (the web's
// hooks/use-mascot-player.ts). A clip that will not load calls onError: the Mascot shows stills.

import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { atClipBoundary } from '../../core/web/lib/mascot/player';
import { logger } from '../../lib/logger';
import type { MascotFile } from './media';

/** timeUpdate every 250 ms: at most as far apart as the web's timeupdate. */
const TIME_UPDATE_SECONDS = 0.25;
const NO_FULLSCREEN = Object.freeze({ enable: false });

function setUp(player: VideoPlayer): void {
  player.muted = true;
  player.audioMixingMode = 'mixWithOthers';
  player.keepScreenOnWhilePlaying = false;
  player.allowsExternalPlayback = false;
  player.timeUpdateEventInterval = TIME_UPDATE_SECONDS;
  player.play();
}

export type MascotClipProps = {
  readonly clip: MascotFile;
  /** The run of the clip on screen (run.ts): a new run plays from the start. */
  readonly run: number;
  readonly onBoundary: (run: number) => void;
  readonly onError: () => void;
};

/** Plays the clip again or swaps the source when the run moves on; the player stays the same. */
function usePlayRuns(player: VideoPlayer, clip: MascotFile, run: number, onError: () => void) {
  const playing = useRef({ clip, run });
  useEffect(() => {
    const was = playing.current;
    if (was.clip === clip && was.run === run) return;
    playing.current = { clip, run };
    if (was.clip === clip) {
      player.replay();
      return;
    }
    player
      .replaceAsync(clip)
      .then(() => player.play())
      .catch((error: unknown) => {
        logger.warn("[styles] Auto's clip could not be loaded, so he is a still", error);
        onError();
      });
  }, [player, clip, run, onError]);
}

export function MascotClip({ clip, run, onBoundary, onError }: MascotClipProps) {
  const [first] = useState(clip);
  const player = useVideoPlayer(first, setUp);
  usePlayRuns(player, clip, run, onError);

  const reported = useRef<number | null>(null);
  const reportAt = useCallback(
    (seconds: number) => {
      if (reported.current === run || !atClipBoundary(seconds, player.duration)) return;
      reported.current = run;
      onBoundary(run);
    },
    [player, run, onBoundary],
  );
  useEventListener(player, 'timeUpdate', ({ currentTime }) => reportAt(currentTime));
  useEventListener(player, 'playToEnd', () => reportAt(player.currentTime));
  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status !== 'error') return;
    logger.warn("[styles] Auto's clip did not play, so he is a still", error);
    onError();
  });

  return (
    <VideoView
      player={player}
      style={styles.clip}
      pointerEvents="none"
      nativeControls={false}
      contentFit="contain"
      fullscreenOptions={NO_FULLSCREEN}
      allowsPictureInPicture={false}
      startsPictureInPictureAutomatically={false}
      allowsVideoFrameAnalysis={false}
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
});
