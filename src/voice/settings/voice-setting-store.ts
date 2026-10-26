// Auto's voice setting on the app's encrypted MMKV store (a non-secret choice, the phone's own,
// never the server's). Pure over its storage port, so it runs in vitest; use-voice-setting.ts
// hands it the foundation's store (src/storage/mmkv.ts appStorage), opened on the first read. Held
// in memory after that read, so useSyncExternalStore sees one value until it changes, and every
// reader (Settings → Voice, quick-ask) hears a change at once: the next reply speaks with it. A
// read that fails is the default; a write the store refuses still holds for this launch. Both are
// logged.

import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import {
  DEFAULT_VOICE_SETTING,
  parseVoiceSetting,
  serialiseVoiceSetting,
  settleSetting,
  type VoiceSetting,
} from './voice-setting';

/** The MMKV key (beside styles.choice and stepUp.beforeApproveOrAnswer). */
export const VOICE_SETTING_KEY = 'voice.setting';

export type VoiceSettingStore = Readonly<{
  /** The setting in memory, read from the store the first time. */
  get: () => VoiceSetting;
  subscribe: (listener: () => void) => () => void;
  /** Holds the setting (clamped) and saves it; false when the save failed (logged). */
  set: (setting: VoiceSetting) => boolean;
}>;

type Storage = Pick<KeyValueStorage, 'getItem' | 'setItem'>;

function read(storage: () => Storage): VoiceSetting {
  try {
    return parseVoiceSetting(storage().getItem(VOICE_SETTING_KEY));
  } catch (error) {
    logger.warn('[voice] could not read the voice setting; using the default', error);
    return DEFAULT_VOICE_SETTING;
  }
}

function write(storage: () => Storage, setting: VoiceSetting): boolean {
  try {
    storage().setItem(VOICE_SETTING_KEY, serialiseVoiceSetting(setting));
    return true;
  } catch (error) {
    logger.warn('[voice] could not save the voice setting; it holds until the app closes', error);
    return false;
  }
}

/** One setting per store; `storage` is called on the first read or write. */
export function createVoiceSettingStore(storage: () => Storage): VoiceSettingStore {
  let held: VoiceSetting | null = null;
  let listeners: readonly (() => void)[] = [];

  const get = (): VoiceSetting => {
    held ??= read(storage);
    return held;
  };

  return Object.freeze({
    get,
    subscribe: (listener: () => void) => {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((listed) => listed !== listener);
      };
    },
    set: (setting: VoiceSetting) => {
      held = settleSetting(setting);
      const saved = write(storage, held);
      for (const listener of listeners) listener();
      return saved;
    },
  });
}
