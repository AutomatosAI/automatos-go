// The Timing block's data and whether it shows (voice latency A-5).
//   Shown, with no gesture, in a development build and on the `testflight` update channel
//   (eas.json's testflight profile); absent from a `production` build, so nothing hidden ships to a
//   store. The turns are the app's voice timing's (timing.ts): in memory, newest first.

import * as Updates from 'expo-updates';
import { useSyncExternalStore } from 'react';

import { voiceTiming } from './timing';
import type { TurnTiming } from './voice-timing';

/** The update channel TestFlight builds are made on (eas.json build.testflight.channel). */
const TESTFLIGHT_CHANNEL = 'testflight';

/** Whether Settings → Voice shows the Timing block on this build. */
export function timingShown(): boolean {
  return __DEV__ || Updates.channel === TESTFLIGHT_CHANNEL;
}

/** The voice turns timed since the app was opened, newest first; re-read as they change. */
export function useTimings(): readonly TurnTiming[] {
  return useSyncExternalStore(voiceTiming.subscribe, voiceTiming.recent);
}
