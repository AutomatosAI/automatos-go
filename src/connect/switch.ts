// Leaving a server (US-006d, PRD-001 §4.5; release KR9): nothing from one server or one person
// ever reaches the next. The hosted Sign out (signOut), Forget this server and Remove this phone
// (forgetServer, after remove-device.ts's DELETE), a new pairing (connectTo) and a session the
// server ended (endSession: an expired hosted session, this phone removed in Studio) all run ONE
// clearUserData(), in this order: push leaves (the session's registrar closed, the hosted row
// revoked, the push record and what the phone shows cleared: src/push/bind/before-leaving.ts;
// endSession leaves that to push's own onSessionExpired), the query cache and its persisted copy
// (the foundation's clearQueryCache), the stored X-Workspace-ID, the active provider, the consent
// step's memory and the left own server's consent records, every entry of the encrypted store but
// the phone's own choices (PHONE_CHOICES: Light / Dark / System and the style), the person's files
// in the app's cache (the Deliverable viewer's copies), then every keychain item that is the
// person's (src/storage/secure-registry.ts clearUserKeys: Clerk's, the paired record, the push
// record). The install id, the encrypted store's key and the install marker (a file of its own)
// stay; the store's key goes too when the store was not emptied (an entry that would not delete,
// which still fails the leaving, or a launch whose store fell back to memory and never opened the
// file): without it the next launch cannot read what is left and starts a new file.
//
// The provider is signed out before anything of the person's is deleted: Clerk still needs its
// client item, and a provider that cannot sign out (Clerk offline) stops the leaving with the
// person signed in and nothing of theirs gone but the cache (the call rejects; they may try
// again). A store entry or keychain item that could not be deleted rejects too, after every other
// step (a keychain item stays in the registry's index for the next try). connectTo saves the new
// paired record only AFTER the clearing, and the current server moves last (current-server.ts),
// which remounts the provider tree on the new server (src/auth/AuthRoot.tsx). Pure over its ports;
// use-server-switch.ts wires the app's.

import type { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';

import { clearQueryCache } from '../api/query-client';
import type { AuthProvider } from '../auth/providers/types';
import type { SecureKeyRegistry } from '../lib/secure-keys';
import { clearPushBeforeLeaving } from '../push/bind/before-leaving';
import type { WorkspaceIdRegistry } from '../session/workspace-ids';
import type { ListableStorage } from '../storage/encrypted-storage';
import { clearUserKeys, STORAGE_KEY_ITEM } from '../storage/secure-registry';
import { STYLE_CHOICE_KEY } from '../styles/registry/choice-store';
import { THEME_CHOICE_STORAGE_KEY } from '../styles/theme-choice';
import { ownServer, type CurrentServerStore } from './current-server';
import type { DeviceStore, PairedRecord } from './device-store';

/**
 * The encrypted store's entries leaving keeps: how the phone looks, not whose it was. Everything
 * else in the store is the person's or their server's (the cache, consent records, looks, the
 * workspace's theme, Face ID before approving, push's notes) and goes.
 */
export const PHONE_CHOICES: readonly string[] = Object.freeze([
  THEME_CHOICE_STORAGE_KEY,
  STYLE_CHOICE_KEY,
]);

/** The consent step's state (US-007b records, US-007c the gate step). */
export type ConsentPort = {
  /** Drops what the consent step holds in memory. */
  readonly resetMemory: () => void;
  /** Removes the consent records kept for a server (its one key, src/consent/store.ts). */
  readonly forgetServer: (origin: string) => Promise<void>;
};

/** What clearUserData clears. */
export type ClearUserDataDeps = {
  readonly queryClient: QueryClient;
  readonly persister: Persister;
  readonly workspaceIds: Pick<WorkspaceIdRegistry, 'clear'>;
  /** The provider of the session being left: Clerk, or this phone's pairing. */
  readonly provider: Pick<AuthProvider, 'kind' | 'signOut'>;
  readonly consent: ConsentPort;
  /** The app's key registry (src/lib/secure-store.ts secureKeys). */
  readonly keys: Pick<SecureKeyRegistry, 'keys' | 'remove'>;
  /** The app's encrypted store, opened on first use (src/storage/mmkv.ts appStorage). */
  readonly storage: () => Pick<ListableStorage, 'keys' | 'removeItem'>;
  /** false when this launch's store fell back to memory: the file was never opened or cleared. */
  readonly storagePersistent: () => boolean;
  /** Deletes the person's files in the app's cache (src/cc/deliverables/open-file.ts). */
  readonly files: () => void;
};

/** Push leaves first (the person leaves), or on its own (the server ended the session). */
export type ClearOptions = { readonly leavePush: boolean };

const LEAVING: ClearOptions = Object.freeze({ leavePush: true });
const ENDED: ClearOptions = Object.freeze({ leavePush: false });

export type ServerSwitchDeps = ClearUserDataDeps & {
  readonly deviceStore: Pick<DeviceStore, 'save' | 'clear'>;
  readonly servers: Pick<CurrentServerStore, 'getSnapshot' | 'connected' | 'forgotten'>;
};

export type ServerSwitch = {
  /** Sign out of the hosted server: the person's data goes, the server stays (Welcome follows). */
  readonly signOut: () => Promise<void>;
  /** Forget this server: this phone stops using its own server (Studio still lists it, US-006h). */
  readonly forgetServer: () => Promise<void>;
  /** Use this newly paired server: everything of the last one is cleared, then the record saved. */
  readonly connectTo: (record: PairedRecord) => Promise<void>;
  /** The server ended the session (expired, or this phone removed in Studio): the same clearing. */
  readonly endSession: () => Promise<void>;
};

function removed(store: Pick<ListableStorage, 'removeItem'>, key: string): boolean {
  try {
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Every entry but the phone's choices, each tried; the failure (counts only, never a key) is
 * answered, not thrown, so the steps after it still run.
 */
function clearStore(storage: ClearUserDataDeps['storage']): Error | null {
  try {
    const store = storage();
    const doomed = store.keys().filter((key) => !PHONE_CHOICES.includes(key));
    const failed = doomed.filter((key) => !removed(store, key));
    if (failed.length === 0) return null;
    return new Error(`could not delete ${failed.length} encrypted store entries`);
  } catch (error) {
    return new Error('could not clear the encrypted store', { cause: error });
  }
}

/**
 * A store not emptied loses its key (crypto-shred), so no later launch can read what is left. An
 * entry that would not delete is still readable by this launch's open store, so its failure is
 * answered anyway; a store kept in memory was emptied, and fails only if the key stays.
 */
async function shredUnlessEmptied(
  deps: ClearUserDataDeps,
  left: Error | null,
): Promise<Error | null> {
  if (left === null && deps.storagePersistent()) return null;
  try {
    await deps.keys.remove(STORAGE_KEY_ITEM);
  } catch (error) {
    return left ?? new Error('could not delete the encrypted store key', { cause: error });
  }
  return left;
}

/**
 * The one clearing every way of leaving runs (KR9), in the header's order; the provider's failure
 * stops it, and a store left readable or a keychain item that could not be deleted rejects at
 * the end.
 */
export async function clearUserData(
  deps: ClearUserDataDeps,
  leftOrigin: string | null,
  { leavePush }: ClearOptions = LEAVING,
): Promise<void> {
  // push first (US-014i): the session's leave runs teardownLocal, after the hosted row's DELETE,
  // which still needs the session's token and workspace id
  if (leavePush) await clearPushBeforeLeaving();
  await clearQueryCache(deps.queryClient, deps.persister);
  deps.workspaceIds.clear();
  await deps.provider.signOut();
  deps.consent.resetMemory();
  if (leftOrigin !== null) await deps.consent.forgetServer(leftOrigin);
  const storeLeft = await shredUnlessEmptied(deps, clearStore(deps.storage));
  deps.files();
  await clearUserKeys(deps.keys);
  if (storeLeft) throw storeLeft;
}

/** The own server being left, if any (its consent records go with it). */
function leftOwnOrigin(deps: ServerSwitchDeps): string | null {
  return ownServer(deps.servers.getSnapshot())?.server.apiUrl ?? null;
}

export function createServerSwitch(deps: ServerSwitchDeps): ServerSwitch {
  return Object.freeze({
    signOut: () => clearUserData(deps, leftOwnOrigin(deps)),
    forgetServer: async () => {
      await clearUserData(deps, leftOwnOrigin(deps));
      // the provider forgot its own pairing and the keychain lost the item; this forgets the record
      // the store still holds in memory
      await deps.deviceStore.clear();
      deps.servers.forgotten();
    },
    connectTo: async (record: PairedRecord) => {
      await clearUserData(deps, leftOwnOrigin(deps));
      await deps.deviceStore.save(record);
      deps.servers.connected(record);
    },
    endSession: () => clearUserData(deps, leftOwnOrigin(deps), ENDED),
  });
}
