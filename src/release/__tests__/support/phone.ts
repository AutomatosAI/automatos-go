// A phone that one person has used, for the user-data tests (US-021j): the keychain (a fake
// expo-secure-store under the app's registry lists: the store's key and the install id written
// beside it, Clerk's items and the push record written through it), the encrypted store and the
// install marker's own file (memory stores), and the query cache persisted into the store. The
// store holds the person's entries and the phone's own choices. A test file that imports this
// mocks expo-secure-store first (device-store.ts reads its class from the native module).

import { persistQueryClientSave } from '@tanstack/react-query-persist-client';

import {
  createQueryClient,
  createQueryPersister,
  persistOptions,
  QUERY_CACHE_STORAGE_KEY,
} from '../../../api/query-client';
import { queryKeys } from '../../../api/query-keys';
import { INSTALL_MARKER_KEY, INSTALL_MARKER_VALUE } from '../../../connect/config';
import { consentKeyFor } from '../../../consent/store';
import { fakeSecureStore, KEYCHAIN_OPTIONS } from '../../../lib/__tests__/fake-secure-store';
import { createSecureKeyRegistry } from '../../../lib/secure-keys';
import { HANDLED_KEYS_ITEM, REMOVED_SCOPES_ITEM } from '../../../push/config';
import { memoryStorage } from '../../../storage/encrypted-storage';
import {
  CLERK_CLIENT_ITEM,
  INSTALL_ID_ITEM,
  LISTED_KEYS,
  PUSH_RECORD_ITEM,
  STORAGE_KEY_ITEM,
} from '../../../storage/secure-registry';
import { STYLE_CHOICE_KEY } from '../../../styles/registry/choice-store';
import { THEME_CHOICE_STORAGE_KEY } from '../../../styles/theme-choice';

/** A key Clerk might ask its token cache for besides its client item: known only to the index. */
export const CLERK_INDEXED_ITEM = '__clerk_db_jwt';
export const INSTALL_ID = 'AAECAwQFBgcICQoLDA0ODw';
export const STORE_KEY = 'A'.repeat(32);
export const HOSTED_ORIGIN = 'https://api.automatos.test';
const WORKSPACE = '7f1c2a54-0000-4000-8000-000000000001';

/** The person's entries in the encrypted store, beside the query cache. */
export const PERSON_ENTRIES: readonly string[] = Object.freeze([
  consentKeyFor(HOSTED_ORIGIN),
  HANDLED_KEYS_ITEM,
  REMOVED_SCOPES_ITEM,
]);

/** The phone's own choices: Light / Dark / System and the style. */
export const PHONE_ENTRIES: readonly string[] = Object.freeze([
  THEME_CHOICE_STORAGE_KEY,
  STYLE_CHOICE_KEY,
]);

/** The keychain: the store's key and the install id, the registry over them. */
export function keychainOf(initial: Record<string, string> = {}) {
  const secure = fakeSecureStore({
    [STORAGE_KEY_ITEM]: STORE_KEY,
    [INSTALL_ID_ITEM]: INSTALL_ID,
    ...initial,
  });
  const registry = createSecureKeyRegistry({
    store: secure,
    options: KEYCHAIN_OPTIONS,
    fixedKeys: LISTED_KEYS,
  });
  return { secure, registry };
}

async function storeOf(ownerId: string) {
  const storage = memoryStorage();
  [...PERSON_ENTRIES, ...PHONE_ENTRIES].forEach((key) => storage.setItem(key, 'kept'));
  const queryClient = createQueryClient();
  const persister = createQueryPersister(storage);
  queryClient.setQueryData(queryKeys.workspace(), { id: WORKSPACE });
  queryClient.setQueryData(queryKeys.board(), [{ id: 1 }]);
  await persistQueryClientSave({ queryClient, ...persistOptions(persister, ownerId) });
  return { storage, queryClient, persister };
}

/** A phone signed in to the hosted server: Clerk's items and the push record in the keychain. */
export async function usedPhone(ownerId = 'user_1') {
  const { secure, registry } = keychainOf();
  await registry.write(CLERK_CLIENT_ITEM, 'client.jwt');
  await registry.write(CLERK_INDEXED_ITEM, 'db.jwt');
  await registry.write(PUSH_RECORD_ITEM, '{"push":"record"}');
  const store = await storeOf(ownerId);
  const marker = memoryStorage();
  marker.setItem(INSTALL_MARKER_KEY, INSTALL_MARKER_VALUE);
  return { secure, registry, marker, ...store };
}

/** What the person's items left behind: their keys, and whether the cache is still saved. */
export function leftovers(phone: Awaited<ReturnType<typeof usedPhone>>) {
  return {
    keychain: [...phone.secure.items.keys()].sort(),
    store: [...phone.storage.keys()].sort(),
    cache: phone.storage.getItem(QUERY_CACHE_STORAGE_KEY) !== null,
    marker: phone.marker.getItem(INSTALL_MARKER_KEY),
  };
}
