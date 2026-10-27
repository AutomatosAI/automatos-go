// The server voice's player (27 Oct 2026): the server speaker's AudioPort bound to expo-audio. The
// only file that imports expo-audio (KV15). Thin on purpose: the module's calls, nothing decided
// here (the status folding is playback-status.ts's, the queue server-speaker.ts's).
//   prepare(): the audio mode for Auto's voice. iOS: category playback with duckOthers, so it plays
//   with the ringer switch on silent and lowers other apps' audio while Auto speaks; no recording
//   and no background (D33). The recognizer sets its own session (playAndRecord with
//   defaultToSpeaker and allowBluetooth) each time it starts, so hold to talk works after a reply.
//   play(): one player per file, keepAudioSessionActive so neither its pause nor its end
//   deactivates the session: expo-audio defers that deactivation by 100 ms, and it would land on
//   the recognizer's session when a press barges in (deactivating a session that is recording
//   stops the recognizer). The session is left active, as the recognizer leaves it; iOS ends it
//   when the app leaves the screen. stop() pauses and releases the player.

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import type { AudioPort, PlayHandlers } from './server-speaker-ports';
import { playbackListener } from './playback-status';

/** How often the player reports its status while playing (the start is seen within this). */
const STATUS_INTERVAL_MS = 100;

const PLAYBACK_MODE = Object.freeze({
  playsInSilentMode: true,
  interruptionMode: 'duckOthers',
  allowsRecording: false,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
} as const);

function play(uri: string, handlers: PlayHandlers): { readonly stop: () => void } {
  const player = createAudioPlayer(
    { uri },
    { updateInterval: STATUS_INTERVAL_MS, keepAudioSessionActive: true },
  );
  const subscription = player.addListener('playbackStatusUpdate', playbackListener(handlers));
  player.play();
  return Object.freeze({
    stop: () => {
      subscription.remove();
      player.pause();
      player.remove();
    },
  });
}

export const audioPlayer: AudioPort = Object.freeze({
  prepare: () => setAudioModeAsync(PLAYBACK_MODE),
  play,
});
