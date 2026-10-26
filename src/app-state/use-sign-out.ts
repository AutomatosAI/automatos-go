// Leaving the server (PRD-001 §4.5, release KR9): on the hosted server Sign out, on a paired own
// server "Forget this server"; both run the switch's one clearUserData (src/connect/switch.ts:
// push, the cache, the provider, the person's entries of the encrypted store and keychain items).
// The gate, seeing the session end, goes to Welcome; a forgotten server moves the shell to the
// hosted one. A failure keeps the person where they are and says so in the taxonomy's words; the
// cause goes to the dev log only. The expiry listener ends a session the server no longer accepts
// (the provider only reports it) with the switch's endSession: the same clearing, push excepted
// (push leaves on its own, PushRoot's onSessionExpired).

import { useCallback, useEffect, useState } from 'react';

import { userMessage } from '../api/errors';
import type { AuthProvider } from '../auth/providers/types';
import { ownServer } from '../connect/current-server';
import { useCurrentServer } from '../connect/use-current-server';
import { useServerSwitch } from '../connect/use-server-switch';
import { logger } from '../lib/logger';
import { useToast } from '../ui';
import { SHELL_COPY } from './strings';

export type SignOut = {
  readonly signOut: () => void;
  readonly busy: boolean;
  /** 'Sign out' on the hosted server, 'Forget this server' on an own one. */
  readonly label: string;
};

export function useSignOut(): SignOut {
  const own = ownServer(useCurrentServer()) !== null;
  const { forgetServer, signOut: leaveHosted } = useServerSwitch();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const signOut = useCallback(() => {
    setBusy(true);
    const leaving = own ? forgetServer() : leaveHosted();
    leaving.catch((error: unknown) => {
      logger.warn('[session] leaving the server failed', error);
      toast.show(userMessage(error));
      setBusy(false);
    });
  }, [own, forgetServer, leaveHosted, toast]);
  return { signOut, busy, label: own ? SHELL_COPY.forgetServer : SHELL_COPY.signOut };
}

/** A session the server no longer accepts ends here: signed out, back to Welcome or Connect. */
export function useSignOutOnExpiry(provider: AuthProvider): void {
  const { endSession } = useServerSwitch();
  useEffect(
    () =>
      provider.onExpired(() => {
        endSession().catch((error: unknown) => {
          logger.warn('[session] sign-out after an expired session failed', error);
        });
      }),
    [provider, endSession],
  );
}
