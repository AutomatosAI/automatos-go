// User-facing copy for the API error taxonomy (D-ERRORS): one message per kind, in plain words. No
// status code, stack, URL or server internals; the detail goes to the logs, never to the screen.

import type { ApiErrorKind } from './errors';

export const API_ERROR_COPY: Readonly<Record<ApiErrorKind, string>> = Object.freeze({
  network: "Can't reach Automatos. Check your connection and try again.",
  auth: 'Your session has ended. Sign in again to carry on.',
  forbidden: "You don't have permission to do that in this workspace.",
  not_found: "We couldn't find that. It may have been moved or removed.",
  conflict: 'That changed while you were working on it. Refresh and try again.',
  server: "Automatos couldn't finish that. Try again in a moment.",
  stream: 'The reply was interrupted. Try again.',
  invalid_response:
    "Automatos sent something this version can't read. Try again, or update the app.",
});

/** Words for an error the app raises itself, by its code (errors.ts APP_ERROR_CODES). */
export const APP_ERROR_COPY = Object.freeze({
  /** The server's Clerk has no "mobile" JWT template yet (D39): nothing the user can fix. */
  signInNotSetUp: 'Sign-in is not set up for Automatos Go on this server yet.',
});

/** Workspace states the bootstrap reports in its own words (D8: nothing about plans or billing). */
export const WORKSPACE_COPY = Object.freeze({
  paused: 'Your workspace is paused; ask your workspace owner',
});
