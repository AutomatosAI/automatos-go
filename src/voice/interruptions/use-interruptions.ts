// Interruptions on a screen (US-019h): AppState's changes into quick-ask's interrupt, which runs the
// interruption policy over the one reducer's state and does what it says (quick-ask-interrupt.ts).
// The recognizer's errors reach the same policy inside the engine, through its one recognizer
// listener (use-quick-ask.ts): the recognizer and the speaker take one listener each, so a second
// subscription here would replace quick-ask's. The speaker has no interruption to report: expo-speech
// 14.0.8 calls back per utterance only (iOS didCancel; Android onStop and onError), and speaker-core
// folds a failed utterance into the run's end, so a run that fails ends and nothing resumes it.
// Every listener is removed on unmount; nothing is read at mount (a screen that mounts is on screen).

import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { InterruptionEvent } from './interruption-policy';

export function useInterruptions(interrupt: (event: InterruptionEvent) => void): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) =>
      interrupt({ type: 'app', status }),
    );
    return () => subscription.remove();
  }, [interrupt]);
}
