// Clerk's token cache (US-005a, release audit 20 Oct): @clerk/expo keeps its client JWT here between
// launches. Every item goes through the app's secure-key registry (src/lib/secure-keys.ts), which
// writes it with the keychain's options (this phone only, after first unlock; secure-store.ts) and
// names its key in the ONE index item first, so sign-out and a reinstall wipe can always find it.
//
// Clerk calls saveToken inside every one of its requests, so a keychain failure is logged and the
// session carries on in Clerk's memory for this launch (signing in again next launch), rather than
// failing Clerk's request. A read failure is NOT a reason to delete the item (Clerk's own cache
// does): before the first unlock the keychain refuses reads, and deleting then would sign the user
// out of a background launch.

import type { TokenCache } from '@clerk/expo';

import { logger } from '../lib/logger';
import type { SecureKeyRegistry } from '../lib/secure-keys';

export function createTokenCache(
  registry: Pick<SecureKeyRegistry, 'read' | 'write' | 'remove'>,
): TokenCache {
  return Object.freeze({
    getToken: async (key: string) => {
      try {
        return await registry.read(key);
      } catch (error) {
        logger.warn('[auth] the keychain refused a sign-in read; Clerk starts signed out', error);
        return null;
      }
    },
    saveToken: async (key: string, token: string) => {
      try {
        await registry.write(key, token);
      } catch (error) {
        logger.warn(
          '[auth] could not keep the sign-in in the keychain; it lasts this launch',
          error,
        );
      }
    },
    clearToken: (key: string) => {
      registry.remove(key).catch((error: unknown) => {
        logger.warn('[auth] could not clear a sign-in item; it stays listed for sign-out', error);
      });
    },
  });
}
