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
//   stops the recognizer). stop() pauses and releases the player.
//   release(): the run is over (server-speaker.ts decides when; never between sentences, never at
//   a barge-in): the mode goes back to mixing (playback with mixWithOthers, so nothing is ducked
//   even while the session stays up), then the session is deactivated with
//   notifyOthersOnDeactivation (setIsAudioActiveAsync(false)), which ends the ducking and tells
//   the person's music or podcast it may resume at full volume.

import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';

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

/** Between runs: other audio mixes at full volume, nothing ducked. */
const RELEASED_MODE = Object.freeze({
  playsInSilentMode: true,
  interruptionMode: 'mixWithOthers',
  allowsRecording: false,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
} as const);

async function release(): Promise<void> {
  await setAudioModeAsync(RELEASED_MODE);
  await setIsAudioActiveAsync(false);
}

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
  release,
  play,
});
