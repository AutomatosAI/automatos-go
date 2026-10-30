// Readiness's TanStack Query key, kept here because src/api/query-keys.ts is the foundation's (K5).
// In memory only: the persister keeps just the families KEY_FAMILIES lists (src/api/query-keys.ts
// isPersistableKey) and none starts with 'readiness', so a check is read fresh on each launch and
// never written to the phone. One per server and workspace, so a switch never shows another's.

const READINESS = 'readiness';

export const readinessQueryKeys = Object.freeze({
  /** Every readiness key, for one invalidation. */
  all: () => [READINESS] as const,
  /** GET /api/readiness for one server's workspace. */
  current: (apiUrl: string, workspaceId: string) => [READINESS, apiUrl, workspaceId] as const,
});
