// The phone's own check by name on Android (check-copy.ts has the iPhone's and the one shape): the
// system prompt takes a fingerprint or a face, or the screen lock's PIN, pattern or password
// (disableDeviceFallback: false), so the copy names the screen lock, never Face ID.

import type { CheckCopy } from './check-copy';

export const CHECK_COPY: CheckCopy = Object.freeze({
  name: 'Screen lock',
  asksFor: 'your fingerprint, face or screen lock',
  first: 'your fingerprint, face or screen lock',
  none: 'no screen lock',
  lockedOut:
    'Fingerprint and face unlock are locked after too many tries. Unlock your phone with its PIN, pattern or password, then try again.',
});
