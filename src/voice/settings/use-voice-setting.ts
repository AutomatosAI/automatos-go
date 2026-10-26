// The app's voice setting: the store (voice-setting-store.ts) on the encrypted MMKV store, opened on
// first use, and the hook Settings → Voice and quick-ask read it through (useSyncExternalStore, so
// a change re-renders every reader and the next reply speaks with it). Only wiring.

import { useSyncExternalStore } from 'react';

import { appStorage } from '../../storage/mmkv';
import { createVoiceSettingStore, type VoiceSettingStore } from './voice-setting-store';
import type { VoiceSetting } from './voice-setting';

export const voiceSetting: VoiceSettingStore = createVoiceSettingStore(appStorage);

export function useVoiceSetting(): VoiceSetting {
  return useSyncExternalStore(voiceSetting.subscribe, voiceSetting.get);
}
