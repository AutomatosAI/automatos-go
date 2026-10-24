// Face ID before approve or answer, for React (D19): useStepUp().guard(action, run) is what A2's
// and A3's approve and answer buttons call (US-015e), and useStepUpSetting() is the switch on
// Settings → Notifications (US-014f). guard runs run() only after a pass; a refusal sends nothing
// and its line shows through the foundation's Toast. Only wiring: the logic is guard.ts,
// setting-store.ts and step-up.ts.

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useToast } from '../ui';
import { createGuard, type Guard } from './guard';
import { settingRefusalCopy, stepUpSetting, type SettingChange } from './setting-store';
import { stepUp } from './step-up';

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
