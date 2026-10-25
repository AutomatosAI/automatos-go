// The phone's Reduce Motion (D-A11Y): every loop in every style stops and stills show while it is
// on. The foundation has no hook of its own (its sheets read Reanimated's useReducedMotion, which
// reads once and never hears a change), so this one starts from that synchronous read — the first
// frame is already right — and then follows AccessibilityInfo.isReduceMotionEnabled and its
// 'reduceMotionChanged' event, so turning it on in Settings stops the loops without a relaunch.

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { logger } from '../../lib/logger';

export function useReduceMotion(): boolean {
  const atLaunch = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState(atLaunch);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (live) setReduceMotion(enabled);
      })
      .catch((error: unknown) => logger.warn('[styles] could not read Reduce Motion', error));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (live) setReduceMotion(enabled);
    });
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
