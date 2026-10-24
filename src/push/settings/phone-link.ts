// The seam between PushRoot (US-014g), which owns the session's ONE registrar, and the Notifications
// screen, which shows that registrar's answer and runs it from a person's tap. PushRoot is a sibling
// of the screens (mounted once in the shell, US-014h), not a provider around them, so the link is a
// small store: PushRoot attaches what the screen may call while it is mounted and detaches it on
// unmount (sign-out, Forget this server); a later attach wins, and a stale detach changes nothing.
// With nothing attached the screen says it is checking and offers no button, and Account offers no
// Remove this phone (US-014h, KP16: the link carries the session's removal). The link also carries
// the session's leave, which Sign out and the connect kit's server switch run before the provider
// is cleared (US-014i, bind/before-leaving.ts). Pure: no React.

import { logger } from '../../lib/logger';
import type { PushLeave } from '../bind/leave';
import type { PhoneRemoval } from '../bind/remove-phone';
import type { PermissionState } from '../registration/state';
import type { RegisterOptions, RegistrationOutcome } from '../registration/register';
import type { Registrar } from '../registration/registrar';

export type PhoneLink = Readonly<{
  /** The session's one registrar (registrar.ts): never a second one. */
  registrar: Pick<Registrar, 'run' | 'latest'>;
  /** permission.ts askPermission over the app's port: called only from a person's tap (KP11). */
  askPermission: () => Promise<PermissionState>;
  /** Remove this phone, bound to the session's registrar, client and push record (KP16). */
  removal: PhoneRemoval;
  /** Push cleared before the session is left: sign-out, Forget this server, a new pairing. */
  leave: PushLeave;
}>;

export type PhoneLinkStore = Readonly<{
  current: () => PhoneLink | null;
  subscribe: (listener: () => void) => () => void;
  /** Attaches the link; the answer detaches it, if it is still the one attached. */
  attach: (link: PhoneLink) => () => void;
}>;

export function createPhoneLinkStore(): PhoneLinkStore {
  let current: PhoneLink | null = null;
  let listeners: readonly (() => void)[] = [];
  const set = (next: PhoneLink | null) => {
    current = next;
    for (const listener of listeners) listener();
  };
  return Object.freeze({
    current: () => current,
    subscribe: (listener: () => void) => {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((listed) => listed !== listener);
      };
    },
    attach: (link: PhoneLink) => {
      set(link);
      return () => {
        if (current === link) set(null);
      };
    },
  });
}

/** The app's one link: PushRoot attaches, the Notifications screen reads. */
export const phoneLinks: PhoneLinkStore = createPhoneLinkStore();

/** The buttons the status card offers that run the registrar (Open Settings leaves the app). */
export type RegistrarAction = 'turn_on' | 'turn_on_again' | 'try_again';

const FORCED: RegisterOptions = Object.freeze({ force: true });

/**
 * A tap on the status card: 'Turn on notifications' asks the OS first (the only place the screen
 * may), then registers, which reads the answer; the others register again past an earlier 409.
 * Sent once, at once: never queued or retried (D-WRITES). Never rejects: a failed ask still runs
 * the registrar, which then reads the permission as it is.
 */
export async function runPhoneAction(
  link: PhoneLink,
  action: RegistrarAction,
): Promise<RegistrationOutcome | null> {
  if (action === 'turn_on') {
    try {
      await link.askPermission();
    } catch {
      logger.warn('[push] the permission ask failed; reading it as it is');
    }
  }
  return link.registrar.run(FORCED);
}
