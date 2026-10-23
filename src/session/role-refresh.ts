// When the shell reads the workspace again (KC12; D16, D17). The role every screen gates on through
// roleCan is the bootstrap's (GET /api/workspaces/current), never one derived from the auth mode or
// the edition, so it must follow the server: it is read at launch (use-launch.ts), again on coming
// back to the foreground once the last read is older than RESUME_REFRESH_AFTER_MS, and again after
// a refusal (any 403, from a query, a mutation or any other call of the session's client: a demoted
// editor answering, a paused workspace) at most once per FORBIDDEN_REFRESH_MIN_MS. The workspace
// query's own refusal is not a trigger: it IS the read, and the gate shows it
// (bootstrap-refusal.ts), so a refusal can never loop. Pure; session-refresh.ts applies it to the
// QueryClient and use-session-refresh.ts wires AppState.

import { isApiError, type ApiError } from '../api/errors';
import { isForeground } from '../api/live-connection';
import { FORBIDDEN_REFRESH_MIN_MS, RESUME_REFRESH_AFTER_MS } from './config';

export type RefreshEvent = 'launch' | 'resume' | 'forbidden';

/**
 * Should the workspace be read again? `lastFetchedAt` is when it was last read (an answer or a
 * refusal), null when never. A launch always reads; the others wait out their interval.
 */
export function refreshDecision(
  event: RefreshEvent,
  lastFetchedAt: number | null,
  now: number,
): boolean {
  if (event === 'launch' || lastFetchedAt === null) return true;
  const age = now - lastFetchedAt;
  return age >= (event === 'resume' ? RESUME_REFRESH_AFTER_MS : FORBIDDEN_REFRESH_MIN_MS);
}

/** A refusal that may mean the role changed: any ApiError of kind forbidden (a 403). */
export function isForbidden(error: unknown): error is ApiError {
  return isApiError(error) && error.kind === 'forbidden';
}

/** Back from the background (AppState); 'inactive' (a system sheet over the app) never left. */
export function isResume(previous: string, next: string): boolean {
  return !isForeground(previous) && isForeground(next);
}
