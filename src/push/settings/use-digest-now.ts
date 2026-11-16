// "Send today's brief now": the app's one store (digest-now-store.ts) read with
// useSyncExternalStore, a press that POSTs through the foundation's client and toasts the 202, the
// last refusal (DigestNowButton says it to VoiceOver as it lands), and a clock read again each time
// the wait's minutes change, until it ends. Only wiring: the state, the guard and the words are
// digest-now.ts's.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useAppSession } from '../../app-state/session';
import { useToast } from '../../ui';
import { sendDigestNow } from '../api';
import { PUSH_DIGEST_NOW_COPY } from '../strings';
import { digestNowView, nextChangeIn, type DigestNowState } from './digest-now';
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

export function useDigestNow() {
  const { client } = useAppSession();
  const { show } = useToast();
  const state = useSyncExternalStore(digestNow.subscribe, digestNow.current, digestNow.current);
  const now = useWaitClock(state);
  const press = useCallback(() => {
    void digestNow
      .press(() => sendDigestNow(client))
      .then((outcome) => {
        if (outcome?.kind === 'queued') show(PUSH_DIGEST_NOW_COPY.queued);
      });
  }, [client, show]);
  return { view: digestNowView(state, now), press, refusal: state.refusal };
}
