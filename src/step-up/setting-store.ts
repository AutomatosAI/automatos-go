// The switch "Face ID before approve or answer" (D19): one item on the app's encrypted MMKV store
// (KP18: a non-secret switch), on by default. Only the word 'off' reads as off, so a missing,
// unknown or unreadable item asks first. Turning it off passes the check for 'settings_off' first
// (the passcode is the fallback; a phone with no passcode passes, as every gated write does);
// turning it on asks nothing. A later change wins over a check still open. A write the store
// refuses still holds for this launch, and the next launch reads the store again. Held after the
// first read, so useSyncExternalStore sees one value until it changes. Pure over its storage port:
// stepUpSetting wires the app's store, opened on first use.

import { logger } from '../lib/logger';
import type { KeyValueStorage } from '../storage/encrypted-storage';
import { appStorage } from '../storage/mmkv';
import { lets, SETTINGS_OFF_ACTION, type StepUpVerdict } from './policy';
import { STEP_UP_SETTING_REFUSAL_COPY } from './strings';

/** The MMKV key (D19's switch). */
export const STEP_UP_SETTING_KEY = 'stepUp.beforeApproveOrAnswer';

const OFF = 'off';
const ON = 'on';

/** The check turning the setting off passes first: the app's stepUp (step-up.ts). */
export type SettingCheck = (action: typeof SETTINGS_OFF_ACTION) => Promise<StepUpVerdict>;

/** Where the switch ended up, and what the check said (null: nothing was asked). */
export type SettingChange = Readonly<{ on: boolean; verdict: StepUpVerdict | null }>;

export type StepUpSetting = Readonly<{
  isOn: () => boolean;
  subscribe: (listener: () => void) => () => void;
  set: (on: boolean, check: SettingCheck) => Promise<SettingChange>;
}>;

export type StepUpSettingDeps = Readonly<{
  storage: () => Pick<KeyValueStorage, 'getItem' | 'setItem'>;
}>;

export function parseSetting(raw: string | null): boolean {
  return raw !== OFF;
}

/** The line a refused turn-off shows; null when nothing was asked or the check passed. */
export function settingRefusalCopy({ verdict }: SettingChange): string | null {
  if (verdict === null || lets(verdict)) return null;
  return STEP_UP_SETTING_REFUSAL_COPY[verdict];
}

async function checked(check: SettingCheck): Promise<StepUpVerdict> {
  try {
    return await check(SETTINGS_OFF_ACTION);
  } catch {
    logger.warn('[step-up] the check before turning the setting off failed');
    return 'unavailable';
  }
}

export function createStepUpSetting({ storage }: StepUpSettingDeps): StepUpSetting {
  let held: boolean | null = null;
  let changes = 0;
  let listeners: readonly (() => void)[] = [];

  const isOn = (): boolean => {
    if (held !== null) return held;
    try {
      held = parseSetting(storage().getItem(STEP_UP_SETTING_KEY));
    } catch {
      logger.warn('[step-up] the setting could not be read; asking first');
      held = true;
    }
    return held;
  };
  const write = (on: boolean): void => {
    try {
      storage().setItem(STEP_UP_SETTING_KEY, on ? ON : OFF);
    } catch {
      logger.warn('[step-up] the setting could not be saved; it holds for this launch');
    }
    held = on;
    for (const listener of listeners) listener();
  };

  return Object.freeze({
    isOn,
    subscribe: (listener: () => void) => {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((listed) => listed !== listener);
      };
    },
    set: async (on: boolean, check: SettingCheck): Promise<SettingChange> => {
      changes += 1;
      const mine = changes;
      if (on) {
        write(true);
        return { on: true, verdict: null };
      }
      const verdict = await checked(check);
      if (mine === changes && lets(verdict)) write(false);
      return { on: isOn(), verdict };
    },
  });
}

/** The app's switch, on the encrypted MMKV store. */
export const stepUpSetting: StepUpSetting = createStepUpSetting({ storage: appStorage });
