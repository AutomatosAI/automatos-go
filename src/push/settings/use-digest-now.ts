// "Send today's brief now": the app's one store (digest-now-store.ts) read with
// useSyncExternalStore, a press that POSTs through the foundation's client, toasts the 202 and has
// VoiceOver read a refusal's line, and a clock read again each time the wait's minutes change, until
// it ends. Only wiring: the state, the guard and the words are digest-now.ts's.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { useAppSession } from '../../app-state/session';
import { useToast } from '../../ui';
import { sendDigestNow } from '../api';
import { PUSH_DIGEST_NOW_COPY } from '../strings';
import {
  digestNowView,
  nextChangeIn,
  refusalLine,
  type DigestNowOutcome,
  type DigestNowState,
} from './digest-now';
import { digestNow } from './digest-now-store';

/** Now, read again when the wait's minutes next change, so the button's words follow the wait. */
function useWaitClock(state: DigestNowState): number {
  const [, setTick] = useState(0);
  const now = Date.now();
  const wait = nextChangeIn(state, now);
  useEffect(() => {
    if (wait === null) return undefined;
    const timer = setTimeout(() => setTick((tick) => tick + 1), wait);
    return () => clearTimeout(timer);
  }, [wait]);
  return now;
}

/** VoiceOver hears a refusal's line as it appears (TalkBack through the line's live region). */
function announceRefusal(outcome: DigestNowOutcome): void {
  if (outcome.kind === 'queued' || Platform.OS !== 'ios') return;
  AccessibilityInfo.announceForAccessibility(refusalLine(outcome));
}

export function useDigestNow() {
  const { client } = useAppSession();
  const { show } = useToast();
  const state = useSyncExternalStore(digestNow.subscribe, digestNow.current, digestNow.current);
  const now = useWaitClock(state);
  const press = useCallback(() => {
    void digestNow
      .press(() => sendDigestNow(client))
      .then((outcome) => {
        if (!outcome) return;
        if (outcome.kind === 'queued') show(PUSH_DIGEST_NOW_COPY.queued);
        else announceRefusal(outcome);
      });
  }, [client, show]);
  return { view: digestNowView(state, now), press };
}
