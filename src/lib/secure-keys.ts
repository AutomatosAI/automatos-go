// The app's secure-storage key registry (release audit, lead 20 Oct): iOS keeps keychain items
// across an uninstall, so every item the app writes is named in ONE index item, and sign-out or a
// reinstall wipe can list and delete them all. Items go in and out through the registry, which names
// a key in the index BEFORE its item is written and drops it only AFTER its item is deleted, one
// operation at a time, so no item is ever outside the index. Items with a fixed name written
// elsewhere (the MMKV key, src/storage) are passed in as fixedKeys and always listed. Pure over its
// port, the async half of expo-secure-store's API, so it runs in vitest; secure-store.ts wires the
// native module. Every call carries the options the caller gives (this phone only, after first
// unlock).

import { z } from 'zod';

import { logger } from './logger';

/** The one keychain item that names every other item the app writes. */
export const SECURE_KEY_INDEX = 'automatos.secure-keys.v1';

/** expo-secure-store's key rule: alphanumerics, '.', '-' and '_' only. */
const SECURE_KEY_PATTERN = /^[\w.-]+$/;

export type SecureStoreOptions = { readonly keychainAccessible?: number };

/** expo-secure-store's async calls (the module itself satisfies it). */
export type AsyncSecureStore = {
  getItemAsync(key: string, options?: SecureStoreOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: SecureStoreOptions): Promise<void>;
  deleteItemAsync(key: string, options?: SecureStoreOptions): Promise<void>;
};

/** The native store and the options every item is written with. */
export type Keychain = {
  readonly store: AsyncSecureStore;
  readonly options: SecureStoreOptions;
};

export type SecureKeyRegistry = {
  read(key: string): Promise<string | null>;
  /** Names the key in the index, then writes the item. */
  write(key: string, value: string): Promise<void>;
  /** Deletes the item, then drops the key from the index (kept listed if the delete failed). */
  remove(key: string): Promise<void>;
  /** Every key the app may hold: the fixed ones and those in the index. */
  keys(): Promise<readonly string[]>;
  /** Deletes every listed item, then the index; throws after trying them all if any failed. */
  wipe(): Promise<void>;
};

export type SecureKeyRegistryDeps = Keychain & {
  /** Items written under a fixed name outside the registry; always listed and wiped. */
  readonly fixedKeys?: readonly string[];
};

const IndexSchema = z.array(z.string().regex(SECURE_KEY_PATTERN));

export function isSecureKey(key: string): boolean {
  return SECURE_KEY_PATTERN.test(key);
}

function parseIndex(raw: string | null): readonly string[] {
  if (raw === null) return [];
  try {
    const parsed = IndexSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return Object.freeze(parsed.data);
  } catch {
    // not JSON: handled below, as an unreadable index
  }
  logger.warn('[secure-keys] the key index is unreadable; starting a new one');
  return [];
}

function unique(keys: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(keys)]);
}

function checkedKey(key: string): string {
  if (!isSecureKey(key)) throw new RangeError('not a valid secure-store key');
  return key;
}

/** Runs keychain operations one at a time, so an index update never races an item's write. */
function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}

/** The index item, read once per launch and kept in memory after. */
type IndexItem = {
  read(): Promise<readonly string[]>;
  write(next: readonly string[]): Promise<void>;
  delete(): Promise<void>;
};

function indexItem({ store, options }: Keychain): IndexItem {
  let cached: readonly string[] | null = null;
  return {
    read: async () => {
      cached ??= parseIndex(await store.getItemAsync(SECURE_KEY_INDEX, options));
      return cached;
    },
    write: async (next) => {
      await store.setItemAsync(SECURE_KEY_INDEX, JSON.stringify(next), options);
      cached = Object.freeze([...next]);
    },
    delete: async () => {
      await store.deleteItemAsync(SECURE_KEY_INDEX, options);
      cached = Object.freeze([]);
    },
  };
}

type Registry = Keychain & { readonly fixedKeys: readonly string[]; readonly index: IndexItem };

async function listed({ fixedKeys, index }: Registry): Promise<readonly string[]> {
  return unique([...fixedKeys, ...(await index.read())]);
}

async function writeItem(registry: Registry, key: string, value: string): Promise<void> {
  const current = await registry.index.read();
  if (!current.includes(key)) await registry.index.write([...current, key]);
  await registry.store.setItemAsync(key, value, registry.options);
}

async function removeItem(registry: Registry, key: string): Promise<void> {
  await registry.store.deleteItemAsync(key, registry.options);
  const current = await registry.index.read();
  if (current.includes(key)) await registry.index.write(current.filter((other) => other !== key));
}

async function wipeAll(registry: Registry): Promise<void> {
  const { store, options, fixedKeys, index } = registry;
  const keys = await listed(registry);
  const results = await Promise.allSettled(keys.map((key) => store.deleteItemAsync(key, options)));
  const failed = keys.filter((_, position) => results[position]?.status === 'rejected');
  if (failed.length === 0) {
    await index.delete();
    return;
  }
  // keep the ones still there in the index, so the next wipe tries them again
  await index.write(failed.filter((key) => !fixedKeys.includes(key)));
  const firstFailure = results.find((result) => result.status === 'rejected');
  throw new Error(`could not delete ${failed.length} keychain item(s)`, {
    cause: firstFailure?.status === 'rejected' ? firstFailure.reason : undefined,
  });
}

export function createSecureKeyRegistry({
  store,
  options,
  fixedKeys = [],
}: SecureKeyRegistryDeps): SecureKeyRegistry {
  const registry: Registry = { store, options, fixedKeys, index: indexItem({ store, options }) };
  const serial = serialQueue();
  return Object.freeze({
    read: async (key: string) => store.getItemAsync(checkedKey(key), options),
    write: async (key: string, value: string) => {
      checkedKey(key);
      await serial(() => writeItem(registry, key, value));
    },
    remove: async (key: string) => {
      checkedKey(key);
      await serial(() => removeItem(registry, key));
    },
    keys: () => serial(() => listed(registry)),
    wipe: () => serial(() => wipeAll(registry)),
  });
}
