// The push record's keychain item (KP18): ONE expo-secure-store item, written through the app's
// ONE secure-key registry (src/lib/secure-keys.ts), which names its key in the index before the
// item is written and drops it only after the item is deleted — so sign-out, Forget this server and
// the reinstall wipe (the connect kit's US-006c) always find and delete it. The registry writes with
// the app's keychain options, keychainAccessible AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: readable for a
// notification action after the first unlock, never in a backup or on another phone; save() refuses
// to write under any weaker class. Never MMKV, the query cache, a log or Sentry: errors carry field
// paths and codes, never a value. Calls run one at a time, so a load never reads past a save. A
// record that does not parse is deleted and reads as none; a keychain that refuses a read (before
// the first unlock) throws and deletes nothing. The only file of the wave that names
// expo-secure-store.

import { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY } from 'expo-secure-store';

import { parseJson } from '../../api/json';
import { logger } from '../../lib/logger';
import type { SecureKeyRegistry } from '../../lib/secure-keys';
import { KEYCHAIN_OPTIONS, secureKeys } from '../../lib/secure-store';
import { PUSH_RECORD_ITEM } from '../config';
import { pushRecordSchema, type PushRecord } from './record';

export type PushKeyStore = Readonly<{
  /** The record, or null; a keychain that refuses the read throws. */
  load: () => Promise<PushRecord | null>;
  /** Writes the record; one that would not read back, or a weaker keychain class, throws. */
  save: (record: PushRecord) => Promise<void>;
  /** Deletes the item and its index entry. */
  clear: () => Promise<void>;
}>;

export type PushKeyStoreDeps = Readonly<{
  keys: Pick<SecureKeyRegistry, 'read' | 'write' | 'remove'>;
  /** The registry writes this phone only, after first unlock (KP18). */
  deviceOnly: boolean;
}>;

/** Paths and codes only: a value in the message could be the key or the token. */
function checked(record: PushRecord): PushRecord {
  const parsed = pushRecordSchema.safeParse(record);
  if (parsed.success) return Object.freeze(parsed.data);
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.code}`);
  throw new Error(`not a push record (${issues.join('; ')})`);
}

function parseRecord(raw: string): PushRecord | null {
  const parsed = pushRecordSchema.safeParse(parseJson(raw)?.value);
  return parsed.success ? Object.freeze(parsed.data) : null;
}

async function loadFrom(keys: PushKeyStoreDeps['keys']): Promise<PushRecord | null> {
  const raw = await keys.read(PUSH_RECORD_ITEM);
  if (raw === null) return null;
  const record = parseRecord(raw);
  if (record) return record;
  logger.warn('[push] the push record is unreadable; deleting it');
  try {
    await keys.remove(PUSH_RECORD_ITEM);
  } catch {
    logger.warn('[push] could not delete the unreadable push record; it stays listed');
  }
  return null;
}

/** Runs the store's calls one at a time, each after the last has settled. */
function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}

export function createPushKeyStore({ keys, deviceOnly }: PushKeyStoreDeps): PushKeyStore {
  const serial = serialQueue();
  return Object.freeze({
    load: () => serial(() => loadFrom(keys)),
    save: (record: PushRecord) =>
      serial(async () => {
        if (!deviceOnly) throw new Error('the keychain is not set to this phone only');
        await keys.write(PUSH_RECORD_ITEM, JSON.stringify(checked(record)));
      }),
    clear: () => serial(() => keys.remove(PUSH_RECORD_ITEM)),
  });
}

/** The app's one push key store, over the app's key registry. */
export const pushKeyStore: PushKeyStore = createPushKeyStore({
  keys: secureKeys,
  deviceOnly: KEYCHAIN_OPTIONS.keychainAccessible === AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
});
