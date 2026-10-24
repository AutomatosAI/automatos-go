// The phone's style choice in the app's encrypted MMKV store (D59): the phone's own, never the
// server's. Pure over the KeyValueStorage port, so it runs in vitest; the style provider hands it
// the foundation's store (src/storage/mmkv.ts appStorage, as theme.tsx does for Light / Dark /
// System). The store is opened lazily, on the first read. A phone with nothing stored follows
// Studio ('Same as Studio', D-PHONE-CHOICE). A store that fails is logged: a failed read is
// Studio, a failed write keeps the new choice in memory for this launch.

import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { parsePhoneChoice, serialisePhoneChoice } from './choice';
import { DEFAULT_CHOICE } from './registry';
import type { PhoneChoice } from './style-id';

/** The MMKV key (beside the foundation's automatos.theme-choice). */
export const STYLE_CHOICE_KEY = 'styles.choice';

export function readStyleChoice(storage: KeyValueStorage): PhoneChoice {
  try {
    return parsePhoneChoice(storage.getItem(STYLE_CHOICE_KEY));
  } catch (error) {
    logger.warn('[styles] could not read the style choice; using Studio', error);
    return DEFAULT_CHOICE;
  }
}

/** true when the choice was saved; false (logged) when the store refused it. */
export function saveStyleChoice(storage: KeyValueStorage, choice: PhoneChoice): boolean {
  try {
    storage.setItem(STYLE_CHOICE_KEY, serialisePhoneChoice(choice));
    return true;
  } catch (error) {
    logger.warn('[styles] could not save the style choice; it applies until the app closes', error);
    return false;
  }
}

export type StyleChoiceStore = {
  /** The choice in memory, read from the store the first time. */
  readonly get: () => PhoneChoice;
  /** Holds the choice in memory and saves it; false when the save failed (logged). */
  readonly set: (choice: PhoneChoice) => boolean;
};

/**
 * One choice per store. `storage` is called on the first read or write, so a caller can pass the
 * foundation's appStorage and nothing touches the keychain until the choice is needed. A choice
 * is held as the next launch will read it back (an install id it cannot store is Studio).
 */
export function createStyleChoiceStore(storage: () => KeyValueStorage): StyleChoiceStore {
  let current: PhoneChoice | null = null;

  const open = (): KeyValueStorage | null => {
    try {
      return storage();
    } catch (error) {
      logger.warn('[styles] the style choice store is unavailable', error);
      return null;
    }
  };

  return Object.freeze({
    get: () => {
      if (current === null) {
        const opened = open();
        current = opened ? readStyleChoice(opened) : DEFAULT_CHOICE;
      }
      return current;
    },
    set: (choice: PhoneChoice) => {
      current = parsePhoneChoice(serialisePhoneChoice(choice));
      const opened = open();
      return opened ? saveStyleChoice(opened, current) : false;
    },
  });
}
