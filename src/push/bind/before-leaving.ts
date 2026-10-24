// The seam the leaving flows call (US-014i, KP16, KP18): Account's Sign out (use-push-sign-out.ts,
// in the connect kit's ServerSection) and the connect kit's server switch (switch.ts: Forget this
// server, and a new pairing that replaces the server) await clearPushBeforeLeaving() before the
// provider is cleared. It runs the leave PushRoot attached to the phone link (leave.ts: the
// registrar closed, the hosted row revoked, the phone cleared); with nothing attached (push is not
// mounted: the gate's own states) there is nothing to close, and a record left behind is cleared
// when the next session starts (leave.ts clearLeftover). It imports no native module and no React,
// so the connect kit's files and tests load it as they are. Never rejects.

import { logger } from '../../lib/logger';
import { phoneLinks, type PhoneLinkStore } from '../settings/phone-link';

export async function clearPushBeforeLeaving(
  links: Pick<PhoneLinkStore, 'current'> = phoneLinks,
): Promise<void> {
  const link = links.current();
  if (!link) return;
  try {
    await link.leave();
  } catch {
    logger.warn('[push] could not clear push before leaving');
  }
}

/** Push first, then the shell's sign-out (useSignOut's, which owns its own failure). */
export async function signOutAfterPush(
  signOut: () => void,
  links: Pick<PhoneLinkStore, 'current'> = phoneLinks,
): Promise<void> {
  await clearPushBeforeLeaving(links);
  signOut();
}
