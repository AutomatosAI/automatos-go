// The session shell's tunables (D-NO-HARDCODE): how fresh the server's word on the role must be
// (KC12). role-refresh.ts reads them.

/** Back in the foreground once the last read is older than this, the workspace is read again. */
export const RESUME_REFRESH_AFTER_MS = 30_000;

/**
 * A refusal (any 403) reads the workspace again at most once per this interval since the last
 * read, so a run of refusals (a paused workspace refuses every call) is one read, never a loop.
 */
export const FORBIDDEN_REFRESH_MIN_MS = 10_000;
