// Leaving the server (PRD-001 §4.5): on the hosted server the provider ends the session and wipes the
// keychain (provider.signOut) and the gate, seeing the session end, forgets the cached data and goes
// to Welcome; on a paired own server it is "Forget this server" (src/connect/switch.ts), which
// clears everything of that server before the shell moves to the hosted one. A failure keeps the
// person where they are and says so in the taxonomy's words; the cause goes to the dev log only. The
// expiry listener ends a session the server no longer accepts (the provider only reports it).

import { useCallback, useEffect, useState } from 'react';

import { userMessage } from '../api/errors';
import { useAuthSession } from '../auth/AuthRoot';
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
  const { provider } = useAuthSession();
  const own = ownServer(useCurrentServer()) !== null;
  const { forgetServer } = useServerSwitch();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const signOut = useCallback(() => {
    setBusy(true);
    const leaving = own ? forgetServer() : provider.signOut();
    leaving.catch((error: unknown) => {
      logger.warn('[session] leaving the server failed', error);
      toast.show(userMessage(error));
      setBusy(false);
    });
  }, [own, forgetServer, provider, toast]);
  return { signOut, busy, label: own ? SHELL_COPY.forgetServer : SHELL_COPY.signOut };
}

/** A session the server no longer accepts ends here: signed out, back to Welcome or Connect. */
export function useSignOutOnExpiry(provider: AuthProvider): void {
  useEffect(
    () =>
      provider.onExpired(() => {
        provider.signOut().catch((error: unknown) => {
          logger.warn('[session] sign-out after an expired session failed', error);
        });
      }),
    [provider],
  );
}
