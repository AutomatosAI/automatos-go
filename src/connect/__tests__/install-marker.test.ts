import { describe, expect, it } from 'vitest';

import { SECURE_KEY_INDEX } from '../../lib/secure-keys';
import { memoryStorage, STORAGE_KEY_ITEM } from '../../storage/encrypted-storage';
import {
  INSTALL_ID_ITEM,
  INSTALL_MARKER_KEY,
  INSTALL_MARKER_VALUE,
  PAIRED_RECORD_ITEM,
} from '../config';
import { checkInstall } from '../install-marker';
import { CLERK_CLIENT_ITEM, keychainWith, RECORD } from './paired-record';

const PUSH_KEY = 'automatos.push-key.v1';
const CLERK_SESSION_ITEM = '__clerk_session_cache';
const INSTALL_ID = 'AAECAwQFBgcICQoLDA0ODw';

/** The keychain an earlier install left behind: iOS keeps it after the app is deleted. */
function leftovers() {
  return keychainWith({
    [SECURE_KEY_INDEX]: JSON.stringify([PAIRED_RECORD_ITEM, CLERK_SESSION_ITEM, PUSH_KEY]),
    [PAIRED_RECORD_ITEM]: JSON.stringify(RECORD),
    [CLERK_CLIENT_ITEM]: 'old.clerk.jwt',
    [CLERK_SESSION_ITEM]: 'old.session',
    [PUSH_KEY]: 'old-push',
    [STORAGE_KEY_ITEM]: 'A'.repeat(32),
    [INSTALL_ID_ITEM]: INSTALL_ID,
  });
}

describe('the reinstall wipe (KC9)', () => {
  it('a new install deletes every registered item, keeps the install id, then marks itself', async () => {
    const { store, registry } = leftovers();
    const marker = memoryStorage();
    expect(await checkInstall({ openMarker: () => marker, keys: registry })).toBe('wiped');
    expect([...store.items.keys()]).toEqual([INSTALL_ID_ITEM]);
    expect(store.items.get(INSTALL_ID_ITEM)).toBe(INSTALL_ID);
    expect(marker.getItem(INSTALL_MARKER_KEY)).toBe(INSTALL_MARKER_VALUE);
  });

  it('the marker is written only after the last delete', async () => {
    const { store, registry } = leftovers();
    const order: string[] = [];
    const marker = {
      getItem: () => null,
      setItem: () => {
        order.push(`marker after ${store.calls.filter((call) => call.op === 'delete').length}`);
      },
    };
    await checkInstall({ openMarker: () => marker, keys: registry });
    // five items (two fixed, three indexed), the index itself, then the paired record by name
    expect(order).toEqual(['marker after 7']);
    expect(store.calls.filter((call) => call.op === 'delete')).toHaveLength(7);
  });

  it('an unreadable key index still loses the paired record (deleted by name)', async () => {
    const { store, registry } = keychainWith({
      [SECURE_KEY_INDEX]: '{not json',
      [PAIRED_RECORD_ITEM]: JSON.stringify(RECORD),
      [CLERK_CLIENT_ITEM]: 'old.clerk.jwt',
      [INSTALL_ID_ITEM]: INSTALL_ID,
    });
    const marker = memoryStorage();
    expect(await checkInstall({ openMarker: () => marker, keys: registry })).toBe('wiped');
    expect([...store.items.keys()]).toEqual([INSTALL_ID_ITEM]);
  });

  it('an install that has run before deletes nothing', async () => {
    const { store, registry } = leftovers();
    const marker = memoryStorage();
    marker.setItem(INSTALL_MARKER_KEY, INSTALL_MARKER_VALUE);
    expect(await checkInstall({ openMarker: () => marker, keys: registry })).toBe('known');
    expect(store.calls).toEqual([]);
  });

  it('a keychain locked before the first unlock deletes nothing and writes no marker', async () => {
    const { store, registry } = leftovers();
    store.failOn('get', SECURE_KEY_INDEX);
    const marker = memoryStorage();
    expect(await checkInstall({ openMarker: () => marker, keys: registry })).toBe('unchecked');
    expect(store.calls.filter((call) => call.op === 'delete')).toEqual([]);
    expect(marker.getItem(INSTALL_MARKER_KEY)).toBeNull();
  });

  it('a delete that fails writes no marker, so the next launch wipes again', async () => {
    const { store, registry } = leftovers();
    store.failOn('delete', PAIRED_RECORD_ITEM);
    const marker = memoryStorage();
    expect(await checkInstall({ openMarker: () => marker, keys: registry })).toBe('unchecked');
    expect(marker.getItem(INSTALL_MARKER_KEY)).toBeNull();
    expect(JSON.parse(store.items.get(SECURE_KEY_INDEX) ?? '[]')).toEqual([PAIRED_RECORD_ITEM]);
  });

  it('a marker file that cannot be opened deletes nothing', async () => {
    const { store, registry } = leftovers();
    const openMarker = () => {
      throw new Error('mmkv failed');
    };
    expect(await checkInstall({ openMarker, keys: registry })).toBe('unchecked');
    expect(store.calls).toEqual([]);
  });

  it('the next launch is known, though the wipe deleted the encrypted store key', async () => {
    const marker = memoryStorage();
    await checkInstall({ openMarker: () => marker, keys: leftovers().registry });
    const { store, registry } = keychainWith({ [INSTALL_ID_ITEM]: INSTALL_ID });
    expect(await checkInstall({ openMarker: () => marker, keys: registry })).toBe('known');
    expect(store.calls).toEqual([]);
  });

  it('a sign-out (which deletes the encrypted store key) never makes a pairing since look new', async () => {
    const marker = memoryStorage();
    marker.setItem(INSTALL_MARKER_KEY, INSTALL_MARKER_VALUE);
    const { store, registry } = leftovers();
    await registry.wipe();
    await registry.write(PAIRED_RECORD_ITEM, JSON.stringify(RECORD));
    expect(await checkInstall({ openMarker: () => marker, keys: registry })).toBe('known');
    expect(store.items.get(PAIRED_RECORD_ITEM)).toBe(JSON.stringify(RECORD));
  });
});
