// The hooks both places quick-ask is drawn share (US-019j, US-019k): the voice screen and HUD's home.
// They only wire; the words are voiceView's (KV8) and the core's props core-props.ts's.
//   useScreenReader: VoiceOver or TalkBack, read at mount and kept in step (HOLD TO TALK toggles
//   under one, KV5). useLevels: the waveform's run while the mic is open. useHold: HOLD TO TALK's
//   press in and out, and its toggle under a screen reader.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { logger } from '../../lib/logger';
import type { QuickAskView } from '../quick-ask/use-quick-ask';
import { nextLevels, toggleStep, type HoldHandlers } from './core-props';

/** VoiceOver or TalkBack is on, and stays in step while the screen is up. */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let current = true;
    AccessibilityInfo.isScreenReaderEnabled().then(
      (enabled) => {
        if (current) setOn(enabled);
      },
      (error: unknown) => logger.warn('[voice] the screen reader was not read', error),
    );
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);
  return on;
}

/** The waveform's run of levels while the mic is open; null once it closes. */
export function useLevels(level: number | null): readonly number[] | null {
  const [levels, setLevels] = useState<readonly number[] | null>(null);
  useEffect(() => setLevels((previous) => nextLevels(previous, level)), [level]);
  return levels;
}

/** What the hold reads of quick-ask: its press, its release and the phase the toggle follows. */
export type HoldSource = Pick<QuickAskView, 'press' | 'release' | 'voice'>;

/** HOLD TO TALK's hold, and its toggle under a screen reader. */
export function useHold(quick: HoldSource): HoldHandlers {
  const { press, release, voice } = quick;
  const onToggle = useCallback(
    () => (toggleStep(voice.phase) === 'release' ? release() : press()),
    [voice.phase, press, release],
  );
  return useMemo(
    () => ({ onPressIn: press, onPressOut: release, onToggle }),
    [press, release, onToggle],
  );
}
