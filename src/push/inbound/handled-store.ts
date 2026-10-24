// The responses already handled, across launches (PRD-001 §4.8): dedupe.ts's list in ONE MMKV item
// (HANDLED_KEYS_ITEM: keys only — never a payload, a question or a reply), read once per store and
// kept in memory, so a store that fails still handles each response once until the app quits.
// claim() checks and marks in one synchronous step: the cold start's read and the listener's copy
// of the same response can never both pass. PushRoot passes appStorage() (src/storage/mmkv.ts);
// sign-out's local teardown (US-014g) calls clear().

import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { HANDLED_KEYS_ITEM } from '../config';
import {
  handledKeysFrom,
  storedHandledKeys,
  wasHandled,
  withHandled,
  type HandledKeys,
} from './dedupe';

export type HandledStore = Readonly<{
  /** true the first time a key is claimed (it is then remembered); false every time after. */
  claim: (key: string) => boolean;
  /** Forgets every key, stored and in memory. */
  clear: () => void;
}>;

function readStored(storage: Pick<KeyValueStorage, 'getItem'>): HandledKeys {
  try {
    return handledKeysFrom(storage.getItem(HANDLED_KEYS_ITEM));
  } catch {
    logger.warn('[push] could not read the handled notifications; starting from none');
    return Object.freeze([]);
  }
}

export function handledStoreOver(storage: KeyValueStorage): HandledStore {
  let memory: HandledKeys | null = null;
  const current = (): HandledKeys => {
    memory ??= readStored(storage);
    return memory;
  };
  return Object.freeze({
    claim: (key: string) => {
      const keys = current();
      if (wasHandled(keys, key)) return false;
      memory = withHandled(keys, key);
      try {
        storage.setItem(HANDLED_KEYS_ITEM, storedHandledKeys(memory));
      } catch {
        logger.warn('[push] could not store a handled notification; kept for this launch');
      }
      return true;
    },
    clear: () => {
      memory = Object.freeze([]);
      try {
        storage.removeItem(HANDLED_KEYS_ITEM);
      } catch {
        logger.warn('[push] could not clear the handled notifications');
      }
    },
  });
}
