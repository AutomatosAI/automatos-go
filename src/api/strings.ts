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

/** Workspace states the bootstrap reports in its own words (D8: nothing about plans or billing). */
export const WORKSPACE_COPY = Object.freeze({
  paused: 'Your workspace is paused; ask your workspace owner',
});
