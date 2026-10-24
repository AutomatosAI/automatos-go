// Sign out on Account, push first (US-014i, KP16, W2 US-009): the connect kit's ServerSection wraps
// the shell's useSignOut with this hook, so its button runs the session's leave (before-leaving.ts:
// the registrar closed, this phone's hosted row revoked with the still-valid Clerk token within
// SIGN_OUT_DELETE_TIMEOUT_MS, the push record and what the phone shows cleared) and only then the
// shell's signOut (the provider signs out and wipes the keychain). The button stays busy through
// both, and a tap while push is leaving does nothing. Wiring only: the order is before-leaving.ts's.

import { useCallback, useRef, useState } from 'react';

import { signOutAfterPush } from './before-leaving';

export type SignOutAction = Readonly<{ signOut: () => void; busy: boolean }>;

export function usePushSignOut({ signOut, busy }: SignOutAction): SignOutAction {
  const [leaving, setLeaving] = useState(false);
  const pending = useRef(false);
  const run = useCallback(() => {
    if (pending.current) return;
    pending.current = true;
    setLeaving(true);
    void signOutAfterPush(() => {
      pending.current = false;
      setLeaving(false);
      signOut();
    });
  }, [signOut]);
  return { signOut: run, busy: busy || leaving };
}
