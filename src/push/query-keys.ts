// The push families' TanStack Query keys, kept here because src/api/query-keys.ts is the foundation's
// and has no push family (KP2: never edited by a wave). None is persisted: the foundation's persister
// keeps only the families KEY_FAMILIES lists (src/api/query-keys.ts isPersistableKey), and no family
// there starts with 'push', so these stay in memory (a device row, the preference rows and the
// redact switch are read fresh on each launch).

const PUSH = 'push';

export const pushQueryKeys = Object.freeze({
  /** Every push key, for one invalidation (sign-out, a server switch). */
  all: () => [PUSH] as const,
  /** GET /api/v1/mobile/devices. */
  devices: () => [PUSH, 'devices'] as const,
  /** GET /api/notification-preferences (the push rows and push_types). */
  preferences: () => [PUSH, 'preferences'] as const,
  /** GET /api/workspaces/current read for push: the role and settings.push.redact_questions. */
  workspacePush: () => [PUSH, 'workspace'] as const,
});
