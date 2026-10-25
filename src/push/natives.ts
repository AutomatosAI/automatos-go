// The app's push natives (PRD-001 §4.8): each native module through its ONE adapter —
// expo-notifications (platform/expo.ts), the keychain item (registration/key-store.ts), expo-crypto's
// SHA-256 (signature/sha256-native.ts) and the phone's facts (registration/device-facts.ts) — for
// PushRoot's wiring (wiring.ts). The MMKV store is not bound here: PushRoot passes appStorage() for
// the switches and counters, so the file that binds the keychain never touches MMKV (KP18). No test
// imports this file: the tests pass fakes to pushWiringFor.

import { expoNotifications } from './platform/expo';
import { nativeDeviceSource } from './registration/device-facts';
import { pushKeyStore } from './registration/key-store';
import { sha256Native } from './signature/sha256-native';
import type { PushNatives } from './wiring';

export const pushNatives: Omit<PushNatives, 'storage'> = Object.freeze({
  port: expoNotifications,
  store: pushKeyStore,
  device: nativeDeviceSource(expoNotifications),
  sha256: sha256Native,
  now: Date.now,
});
