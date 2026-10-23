// The consent records (D23, KC11): what this person agreed to, on this phone, per server origin and
// workspace. Kept in the app's encrypted MMKV store (src/storage), one key per server origin
// holding that server's records by workspace id, so Forget this server removes them with one key
// (switch.ts calls forgetServer); the query persister's key and the install marker are never
// touched. A record holds no token and no personal data, and nothing here is sent to a server:
// this module imports no HTTP client. Read through zod: a value that does not parse reads as no
// record (asked again), never as an agreement. Pure over its storage port; app-store.ts wires the
// app's encrypted store.

import { z } from 'zod';

import { parseJson } from '../api/json';
import { logger } from '../lib/logger';
import type { KeyValueStorage } from '../storage/encrypted-storage';
import { CONSENT_KEY_PREFIX, CONSENT_KEY_SEPARATOR } from './config';

export const consentRecordSchema = z.object({
  /** fingerprintOf(providers) when the person agreed (policy.ts). */
  fingerprint: z.string().min(1),
  /** The names the sheet showed, in its order (none for an unlisted server). */
  providerNames: z.array(z.string()).readonly(),
  agreedAt: z.string().datetime({ offset: true }),
  copyVersion: z.number().int().positive(),
});

export type ConsentRecord = Readonly<z.output<typeof consentRecordSchema>>;

/** Whose agreement: the server the app calls and the workspace the bootstrap resolved. */
export type ConsentScope = { readonly origin: string; readonly workspaceId: string };

export type ConsentStore = {
  /** This scope's record; none when there is none or it does not parse. Never throws. */
  readonly read: (scope: ConsentScope) => ConsentRecord | null;
  /** Saves this scope's record beside the server's others; a record that would not read back throws. */
  readonly write: (scope: ConsentScope, record: ConsentRecord) => void;
  /** Removes every record kept for this server origin. Never throws. */
  readonly forgetServer: (origin: string) => Promise<void>;
};

export type ConsentStoreDeps = {
  /** The app's encrypted store, opened on first use (storage/mmkv.ts appStorage). */
  readonly storage: () => KeyValueStorage;
};

const recordsSchema = z.record(z.string(), z.unknown());

type Records = Readonly<Record<string, ConsentRecord>>;

export function consentKeyFor(origin: string): string {
  return `${CONSENT_KEY_PREFIX}${CONSENT_KEY_SEPARATOR}${origin}`;
}

/** Each workspace's record that parses; a value that is not a map of them reads as none. */
function parseRecords(raw: string | null): Records {
  if (raw === null) return {};
  const parsed = recordsSchema.safeParse(parseJson(raw)?.value);
  if (!parsed.success) {
    logger.warn('[consent] the stored records are unreadable; asking again');
    return {};
  }
  const entries = Object.entries(parsed.data).flatMap(([workspaceId, value]) => {
    const record = consentRecordSchema.safeParse(value);
    return record.success ? [[workspaceId, Object.freeze(record.data)] as const] : [];
  });
  return Object.freeze(Object.fromEntries(entries));
}

/** Paths and codes only, never the value. */
function checked(record: ConsentRecord): ConsentRecord {
  const parsed = consentRecordSchema.safeParse(record);
  if (parsed.success) return Object.freeze(parsed.data);
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.code}`);
  throw new Error(`not a consent record (${issues.join('; ')})`);
}

function readRecords(storage: KeyValueStorage, origin: string): Records {
  try {
    return parseRecords(storage.getItem(consentKeyFor(origin)));
  } catch (error) {
    logger.warn('[consent] the stored records could not be read; asking again', error);
    return {};
  }
}

export function createConsentStore({ storage }: ConsentStoreDeps): ConsentStore {
  return Object.freeze({
    read: ({ origin, workspaceId }: ConsentScope) =>
      readRecords(storage(), origin)[workspaceId] ?? null,
    write: ({ origin, workspaceId }: ConsentScope, record: ConsentRecord) => {
      const store = storage();
      const next = { ...readRecords(store, origin), [workspaceId]: checked(record) };
      store.setItem(consentKeyFor(origin), JSON.stringify(next));
    },
    forgetServer: async (origin: string) => {
      try {
        storage().removeItem(consentKeyFor(origin));
      } catch (error) {
        logger.warn('[consent] could not remove the records of a forgotten server', error);
      }
    },
  });
}
