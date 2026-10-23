// A paired record for the device store and provider tests, and a registry over a fake keychain.

import { fakeSecureStore, KEYCHAIN_OPTIONS } from '../../lib/__tests__/fake-secure-store';
import { createSecureKeyRegistry } from '../../lib/secure-keys';
import { STORAGE_KEY_ITEM } from '../../storage/encrypted-storage';
import type { PairedRecord } from '../device-store';

/** Clerk's client item (lib/secure-store.ts CLERK_CLIENT_ITEM), a fixed key of the app's registry. */
export const CLERK_CLIENT_ITEM = '__clerk_client_jwt';

export const TOKEN = `amd_${'A'.repeat(43)}`;

export const RECORD: PairedRecord = Object.freeze({
  origin: 'http://192.168.1.20:8000',
  webUrl: 'http://192.168.1.20:3000',
  serverName: 'Home NAS',
  edition: 'local',
  insecure: true,
  pushExpo: false,
  deviceId: '0f6e2c1a-5b7d-4c3e-9a8b-1d2e3f4a5b6c',
  workspaceId: '7f1c2a54-0000-4000-8000-000000000001',
  token: TOKEN,
  rotateAfter: '2026-11-20T10:00:00.123456+00:00',
  pairedAt: '2026-10-21T10:00:00.000Z',
});

export const OTHER_RECORD: PairedRecord = Object.freeze({
  ...RECORD,
  origin: 'https://automatos.example.com',
  webUrl: 'https://automatos.example.com',
  serverName: 'Office',
  insecure: false,
  deviceId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  token: `amd_${'B'.repeat(43)}`,
});

/** The app's registry over a fake keychain, with the app's fixed keys. */
export function keychainWith(initial: Record<string, string> = {}) {
  const store = fakeSecureStore(initial);
  const registry = createSecureKeyRegistry({
    store,
    options: KEYCHAIN_OPTIONS,
    fixedKeys: [STORAGE_KEY_ITEM, CLERK_CLIENT_ITEM],
  });
  return { store, registry };
}
