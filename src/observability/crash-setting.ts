// The user's 'Send crash reports' switch (R03, KR7): on unless the user turned it off, so a fresh
// install reports crashes and the choice survives every launch after. It is read at module load,
// before the root layout renders, so it needs a store that answers synchronously and that the
// reinstall gate (KC9) does not guard: a plain MMKV file of its own (index.ts), never the encrypted
// store, whose key lives in the keychain the gate wipes first. One non-sensitive word is kept; the
// file is deleted with the app, so a reinstall starts with the default again. Pure over the store.

import { logger } from '../lib/logger';
import type { KeyValueStorage } from '../storage/encrypted-storage';

/** The switch's own MMKV file (plain: it holds one word, no personal data). */
export const CRASH_SETTING_STORE_ID = 'automatos-go.crash-reports';
export const CRASH_SETTING_KEY = 'crash-reports.enabled.v1';

const ON = 'on';
const OFF = 'off';

/** Missing or garbage → on (the default); only the word the switch writes for off turns it off. */
export function parseCrashSetting(raw: string | null | undefined): boolean {
  return raw !== OFF;
}

export function serializeCrashSetting(on: boolean): string {
  return on ? ON : OFF;
}

export type CrashSetting = {
  readonly crashReportsEnabled: () => boolean;
  readonly setCrashReportsEnabled: (on: boolean) => void;
};

/**
 * The switch over a store opened on the first read. The value is read once and kept for the
 * launch. A store that cannot be read means the user's choice is unknown: off for this launch,
 * because a report sent against an 'off' would break the promise the switch makes.
 */
export function createCrashSetting(open: () => KeyValueStorage): CrashSetting {
  let store: KeyValueStorage | undefined;
  let current: boolean | undefined;
  const storage = (): KeyValueStorage => (store ??= open());
  return Object.freeze({
    crashReportsEnabled: () => (current ??= readSetting(storage)),
    setCrashReportsEnabled: (on: boolean) => {
      current = on;
      writeSetting(storage, on);
    },
  });
}

function readSetting(storage: () => KeyValueStorage): boolean {
  try {
    return parseCrashSetting(storage().getItem(CRASH_SETTING_KEY));
  } catch (error) {
    logger.warn('[crash-reports] the switch could not be read; off for this launch', error);
    return false;
  }
}

function writeSetting(storage: () => KeyValueStorage, on: boolean): void {
  try {
    storage().setItem(CRASH_SETTING_KEY, serializeCrashSetting(on));
  } catch (error) {
    // the choice still holds for this launch; the next launch reads what was saved before
    logger.warn('[crash-reports] the switch could not be saved', error);
  }
}
