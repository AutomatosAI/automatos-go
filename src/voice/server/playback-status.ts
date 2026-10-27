// expo-audio's status updates as the server speaker's three play events (server-speaker.ts
// PlayHandlers), each said once per file. Pure: no React, React Native or Expo (audio-player.ts
// hands it the player's playbackStatusUpdate events).
//   playing: the first update that says the file is playing, with its duration when known.
//   ended: didJustFinish (AVPlayerItemDidPlayToEndTime; ExoPlayer's end). error: the player's
//   state says failed. After ended or error nothing more is said.

import type { PlayHandlers } from './server-speaker-ports';

/** The fields of expo-audio's AudioStatus this reads. */
export type PlaybackStatus = {
  readonly playing: boolean;
  readonly didJustFinish: boolean;
  readonly duration: number;
  readonly playbackState: string;
};

const FAILED = 'failed';

/** A listener for one player's status updates. */
export function playbackListener(handlers: PlayHandlers): (status: PlaybackStatus) => void {
  let playing = false;
  let over = false;
  return (status) => {
    if (over) return;
    if (status.playbackState === FAILED) {
      over = true;
      return handlers.onError();
    }
    if (status.playing && !playing) {
      playing = true;
      handlers.onPlaying(Number.isFinite(status.duration) ? status.duration : 0);
    }
    if (status.didJustFinish) {
      over = true;
      handlers.onEnded();
    }
  };
}
