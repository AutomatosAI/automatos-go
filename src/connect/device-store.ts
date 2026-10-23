// The paired record (KC9, D-TOKEN): what this phone keeps about the server it is paired to — the
// origin it calls, Studio's address, the server's name and edition, whether it is an unencrypted
// home network, whether it sends push through Expo (for wave A4), and the device's id, workspace,
// token and rotation date. ONE expo-secure-store item, written through the app's key registry
// (src/lib/secure-keys.ts) so sign-out and the reinstall wipe always find it, with the keychain's
// keychainAccessible AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: never in a backup or on another phone,
// still readable after the first unlock for A4's notification actions. save() refuses to write the
// token under any weaker class. The token is never in MMKV, the query cache, a log or Sentry.
//
// Read once per launch and kept in memory after. A load waits for a save or clear still writing and
// answers what it leaves, so a late 401 for one pairing never acts on a record a new pairing is
// replacing. A record that does not parse is deleted and reads as none; a keychain that refuses a
// read (before the first unlock) throws and deletes nothing.

import { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY } from 'expo-secure-store';
import { z } from 'zod';

import { parseJson } from '../api/json';
import { isHttpUrl } from '../lib/env';
import { logger } from '../lib/logger';
import type { SecureKeyRegistry } from '../lib/secure-keys';
import { KEYCHAIN_OPTIONS, secureKeys } from '../lib/secure-store';
import { parseServerAddress } from './address';
import { PAIRED_RECORD_ITEM } from './config';
import { deviceTokenSchema, isoDateTime } from './schemas';

/** The origin re-parses to itself under the address rules, with the same unencrypted flag. */
function isServerOrigin(record: { readonly origin: string; readonly insecure: boolean }): boolean {
  const parsed = parseServerAddress(record.origin);
  return parsed.ok && parsed.origin === record.origin && parsed.insecure === record.insecure;
}

export const pairedRecordSchema = z
  .object({
    origin: z.string(),
    webUrl: z.string().refine(isHttpUrl),
    serverName: z.string().min(1),
    edition: z.string().min(1),
    insecure: z.boolean(),
    pushExpo: z.boolean(),
    deviceId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    token: deviceTokenSchema,
    rotateAfter: isoDateTime,
    /** This phone's clock when POST /pair answered: new on every pairing, kept by a rotation. */
    pairedAt: isoDateTime,
  })
  .refine(isServerOrigin, { path: ['origin'] });

export type PairedRecord = Readonly<z.output<typeof pairedRecordSchema>>;

export type DeviceStore = {
  /** The record (once any change still writing is done), or null; a keychain failure throws. */
  load(): Promise<PairedRecord | null>;
  /** Writes the record; a record that would not read back, or a weaker keychain class, throws. */
  save(record: PairedRecord): Promise<void>;
  /** Forgets the record: at once in memory, then in the keychain. */
  clear(): Promise<void>;
};

export type DeviceStoreDeps = {
  readonly keys: Pick<SecureKeyRegistry, 'read' | 'write' | 'remove'>;
  /** The registry writes this phone only, after first unlock (KC9). */
  readonly deviceOnly: boolean;
};

/** Paths and codes only: a value in the message could be the token. */
function checked(record: PairedRecord): PairedRecord {
  const parsed = pairedRecordSchema.safeParse(record);
  if (parsed.success) return Object.freeze(parsed.data);
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.code}`);
  throw new Error(`not a paired record (${issues.join('; ')})`);
}

function parseRecord(raw: string): PairedRecord | null {
  const parsed = pairedRecordSchema.safeParse(parseJson(raw)?.value);
  return parsed.success ? Object.freeze(parsed.data) : null;
}

/** The keychain's record; `corrupt` when an item is there but does not parse. */
async function readRecord(
  keys: DeviceStoreDeps['keys'],
): Promise<{ readonly record: PairedRecord | null; readonly corrupt: boolean }> {
  const raw = await keys.read(PAIRED_RECORD_ITEM);
  const record = raw === null ? null : parseRecord(raw);
  return { record, corrupt: raw !== null && record === null };
}

async function removeCorrupt(keys: DeviceStoreDeps['keys']): Promise<void> {
  logger.warn('[connect] the paired record is unreadable; forgetting it');
  try {
    await keys.remove(PAIRED_RECORD_ITEM);
  } catch (error) {
    logger.warn('[connect] could not delete the unreadable paired record', error);
  }
}

/** What the keychain holds, once read or written this launch. */
type Known = { readonly record: PairedRecord | null };

const NONE: Known = Object.freeze({ record: null });

export function createDeviceStore({ keys, deviceOnly }: DeviceStoreDeps): DeviceStore {
  let known: Known | undefined;
  let reading: Promise<PairedRecord | null> | undefined;
  // every save and clear bumps the generation and is the latest change: a load waits for it and
  // answers what it left, never what the keychain held before
  let generation = 0;
  let latestChange: Promise<unknown> = Promise.resolve();

  /** Runs a keychain change as the latest one; `mine` tells it whether it still is when done. */
  const change = (run: (mine: number) => Promise<void>): Promise<void> => {
    generation += 1;
    const next = run(generation);
    latestChange = next;
    return next;
  };

  /** Memory, else the keychain, read only once no change is under way (checked as it starts). */
  const readQuietly = async (): Promise<PairedRecord | null> => {
    const awaited = latestChange;
    await awaited.catch(() => undefined);
    if (awaited !== latestChange) return readQuietly(); // another change started meanwhile
    if (known) return known.record;
    const started = generation;
    const { record, corrupt } = await readRecord(keys);
    if (generation !== started) return readQuietly(); // a change came in during the read
    known = Object.freeze({ record });
    // as a change of its own, so a save that follows is written after the delete
    if (corrupt) await change(() => removeCorrupt(keys));
    return record;
  };

  return Object.freeze({
    load: () => {
      reading ??= readQuietly().finally(() => {
        reading = undefined;
      });
      return reading;
    },
    save: async (record: PairedRecord) => {
      if (!deviceOnly) throw new Error('the keychain is not set to this phone only');
      const next = checked(record);
      await change(async (mine) => {
        await keys.write(PAIRED_RECORD_ITEM, JSON.stringify(next));
        if (generation === mine) known = Object.freeze({ record: next });
      });
    },
    clear: () => {
      known = NONE;
      return change(() => keys.remove(PAIRED_RECORD_ITEM));
    },
  });
}

/** The app's one device store, over the app's key registry. */
export const deviceStore: DeviceStore = createDeviceStore({
  keys: secureKeys,
  deviceOnly: KEYCHAIN_OPTIONS.keychainAccessible === AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
});
