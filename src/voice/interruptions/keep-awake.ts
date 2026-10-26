// The screen stays on while voice works (KV12, US-019h). Hands-free means screen on, app open
// (decision 33): a phone that locks mid-hold or mid-reply sends the app to the background, and that
// ends the voice (KV10, KV11). The only file that imports expo-keep-awake (KV15): a dependency of
// expo 54 (~15.0.8 in node_modules/expo/package.json), autolinked into the foundation's binary and
// never added to package.json. One tag, so the voice never releases another screen's hold.
//   keepAwakeFor(state) is pure; useVoiceKeepAwake(state) holds the screen on while it is true and
//   releases it when it turns false and on unmount. A failure in either direction is logged, never
//   thrown: a phone that cannot hold its screen on still talks.

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

import { logger } from '../../lib/logger';
import type { VoicePhase, VoiceState } from '../machine/voice-state';

/** The voice's one keep-awake tag (expo-keep-awake counts holds per tag). */
export const VOICE_KEEP_AWAKE_TAG = 'automatos-go-voice';

/**
 * Auto has the turn or a hold is under way. Thinking counts: between the release and the speech,
 * and between sentence batches while the turn still streams (speaking → thinking → speaking), the
 * reply is still being spoken. Phase 2 adds Live.
 */
const AWAKE: ReadonlySet<VoicePhase> = new Set<VoicePhase>(['listening', 'thinking', 'speaking']);

/** The screen stays on while the mic is open or a reply is under way; idle and error let it sleep. */
export function keepAwakeFor(state: Pick<VoiceState, 'phase' | 'micOpen'>): boolean {
  return state.micOpen || AWAKE.has(state.phase);
}

/** Holds the screen on under the voice's tag; returns the release. */
export function holdScreenOn(): () => void {
  activateKeepAwakeAsync(VOICE_KEEP_AWAKE_TAG).catch((error: unknown) =>
    logger.warn('[voice] the screen could not be kept on', error),
  );
  return () => {
    deactivateKeepAwake(VOICE_KEEP_AWAKE_TAG).catch((error: unknown) =>
      logger.warn('[voice] the screen hold was not released', error),
    );
  };
}

/** The screen on while keepAwakeFor(state); released when it turns false and on unmount. */
export function useVoiceKeepAwake(state: Pick<VoiceState, 'phase' | 'micOpen'>): void {
  const awake = keepAwakeFor(state);
  useEffect(() => (awake ? holdScreenOn() : undefined), [awake]);
}
