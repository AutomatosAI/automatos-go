// Face ID before approve or answer, for React (D19): useStepUp().guard(action, run) is what A2's
// and A3's approve and answer buttons call (US-015e), and useStepUpSetting() is the switch on
// Settings → Notifications (US-014f), with usePhoneSecurity() for its no-passcode line. guard runs
// run() only after a pass; a refusal sends nothing and its line shows through the foundation's
// Toast. Only wiring: the logic is guard.ts, setting-store.ts and step-up.ts.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useToast } from '../ui';
import { createGuard, type Guard } from './guard';
import { settingRefusalCopy, stepUpSetting, type SettingChange } from './setting-store';
import { phoneSecurity, stepUp } from './step-up';

export type StepUpApi = Readonly<{ guard: Guard }>;

/** The gate for this screen's writes; only inside the app's ToastProvider. */
export function useStepUp(): StepUpApi {
  const { show } = useToast();
  return useMemo(() => ({ guard: createGuard({ check: stepUp, notify: show }) }), [show]);
}

export type StepUpSettingApi = Readonly<{
  on: boolean;
  /** Turning it off asks first (its refusal shows as a toast); turning it on asks nothing. */
  set: (on: boolean) => Promise<SettingChange>;
}>;

/**
 * Whether the phone has a passcode or Face ID (null until read, or unreadable); read again when the
 * app comes back, so a passcode set in the phone's Settings shows at once.
 */
export function usePhoneSecurity(): boolean | null {
  const [secure, setSecure] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const read = () => {
      void phoneSecurity().then((value) => {
        if (live) setSecure(value);
      });
    };
    read();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => {
      live = false;
      listener.remove();
    };
  }, []);
  return secure;
}

export function useStepUpSetting(): StepUpSettingApi {
  const on = useSyncExternalStore(stepUpSetting.subscribe, stepUpSetting.isOn, stepUpSetting.isOn);
  const { show } = useToast();
  const set = useCallback(
    async (next: boolean) => {
      const change = await stepUpSetting.set(next, stepUp);
      const refusal = settingRefusalCopy(change);
      if (refusal) show(refusal);
      return change;
    },
    [show],
  );
  return useMemo(() => ({ on, set }), [on, set]);
}
