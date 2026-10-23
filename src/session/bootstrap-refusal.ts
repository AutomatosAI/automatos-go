// A bootstrap the server refuses (US-007a; D8): GET /api/workspaces/current answers 403 or 404 when
// this person can no longer use the workspace. The paused refusal is the foundation's mapping
// (api/workspace.ts isWorkspacePaused: 403 "Workspace is disabled. Contact an administrator.", from
// automatos-ai core/auth/hybrid.py _assert_workspace_usable) and keeps D8's words; any other 403,
// or a 404 ("Workspace not found", api/workspaces.py get_current_workspace), is a workspace this
// person is no longer in. Both are final: a refusal is never retried by itself (query-client.ts
// retries only the network and 5xx, and role-refresh.ts never re-reads on the workspace's own
// refusal); the way out is Sign out (hosted) or Forget this server (own). Pure; the gate routes
// them (src/app-state/gate.ts).

import { isApiError, type ApiErrorKind } from '../api/errors';
import { WORKSPACE_COPY } from '../api/strings';
import { isWorkspacePaused } from '../api/workspace';
import { SESSION_COPY } from './strings';

export type BootstrapRefusal = 'paused' | 'workspace_lost';

/** The taxonomy's kinds for a 403 and a 404 (api/errors.ts kindForStatus). */
const LOST_KINDS: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>(['forbidden', 'not_found']);

/** What the bootstrap's failure means, or null when it is not a refusal (offline, a 5xx, …). */
export function bootstrapRefusal(error: unknown): BootstrapRefusal | null {
  if (isWorkspacePaused(error)) return 'paused';
  return isApiError(error) && LOST_KINDS.has(error.kind) ? 'workspace_lost' : null;
}

/** The words each refusal shows: the paused state is D8's, never a plan or a price. */
export const REFUSAL_MESSAGES: Readonly<Record<BootstrapRefusal, string>> = Object.freeze({
  paused: WORKSPACE_COPY.paused,
  workspace_lost: SESSION_COPY.lostMessage,
});
