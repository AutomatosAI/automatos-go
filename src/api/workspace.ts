// The workspace bootstrap (PRD-001 §4.4, §4.5; D-ONE-CLIENT): GET /api/workspaces/current, read on
// every launch, says which workspace the caller resolved to and their role in it. The server
// silently replaces an X-Workspace-ID the user can no longer use (automatos-ai
// core/auth/hybrid.py:908-915), so the id it returns is stored and sent on every later call.
// Response shape: orchestrator/api/workspaces.py:69-157 and services/plan_tiers.py:203-262. The
// schema keeps only what the app reads; the rest (webhook_key, settings, plan_limits, the tier's
// display price) is dropped at parse time, so it never reaches the screen or the persisted cache.

import { z } from 'zod';

import type { ApiClient } from './client';
import { isApiError, userMessage } from './errors';
import { routes } from './routes';
import { WORKSPACE_COPY } from './strings';

export const WORKSPACE_ROLES = ['owner', 'admin', 'editor', 'viewer'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/**
 * The server answers owner/admin/editor/viewer (`resolve_workspace_role(...) or "viewer"`). A role
 * this app does not know is read as viewer: the least it can do is read (D17).
 */
const RoleSchema = z.enum(WORKSPACE_ROLES).catch('viewer');

const AiProviderSchema = z.object({ id: z.string(), name: z.string() });

const ExposureSchema = z.object({
  plan: z.string().nullable().optional(),
  /**
   * Capability families the plan declares. An empty object is unrestricted (the local edition and
   * a tier with no families policy, plan_tiers.py:203-229), so a missing `voice` is not "off".
   */
  families: z.object({ voice: z.boolean().optional() }).default({}),
});

/** A server older than exposure (PRD-222) declares no families: unrestricted, like local. */
const NO_EXPOSURE = { families: {} };

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable().optional(),
  /** Data only: the app shows nothing about plans (D-NO-BILLING). null on a local install. */
  plan: z.string().nullable().optional(),
  role: RoleSchema,
  exposure: ExposureSchema.default(NO_EXPOSURE),
  /**
   * The providers Auto uses, for the consent sheet (PRD-266 US-017; absent before it). The server
   * answers null when it cannot read its list (services/workspace_view.py ai_providers_or_none):
   * that, or a malformed list, reads as absent, so it never fails the bootstrap.
   */
  ai_providers: z.array(AiProviderSchema).optional().catch(undefined),
});

export type Workspace = Readonly<z.output<typeof WorkspaceSchema>>;

/** The X-Workspace-ID every call sends: set by the bootstrap, cleared on sign-out. */
export type WorkspaceIdStore = {
  get(): string | null;
  set(id: string): void;
  clear(): void;
};

export function createWorkspaceIdStore(initial: string | null = null): WorkspaceIdStore {
  let current = initial;
  return Object.freeze({
    get: () => current,
    set: (id: string) => {
      current = id;
    },
    clear: () => {
      current = null;
    },
  });
}

/** The app's one store; the app shell passes `workspaceIdStore.get` as the client's getWorkspaceId. */
export const workspaceIdStore: WorkspaceIdStore = createWorkspaceIdStore();

export type BootstrapOptions = {
  readonly store?: WorkspaceIdStore;
  readonly signal?: AbortSignal;
  /**
   * Awaited before the new id is stored when the server resolved a different workspace from the
   * one held (removed from it, or the header replaced): the shell clears the cached data here.
   */
  readonly onWorkspaceChange?: (previousId: string, nextId: string) => void | Promise<void>;
};

/**
 * Reads the current workspace and stores its id for every later call. It sends the id it already
 * holds (the shell seeds the store from the restored workspace query on launch), so a user in
 * several workspaces stays in the one they were in while it is still theirs. A failure leaves the
 * stored id as it was and throws the taxonomy error.
 */
export async function bootstrapWorkspace(
  client: ApiClient,
  { store = workspaceIdStore, signal, onWorkspaceChange }: BootstrapOptions = {},
): Promise<Workspace> {
  const workspace = await client.request(routes.workspaceCurrent, {
    schema: WorkspaceSchema,
    signal,
  });
  const previousId = store.get();
  if (previousId !== null && previousId !== workspace.id) {
    await onWorkspaceChange?.(previousId, workspace.id);
  }
  store.set(workspace.id);
  return workspace;
}

/**
 * A paused workspace: there is no paused field in GET /api/workspaces/current; every call for a
 * paused workspace is refused first with 403 {"detail": "Workspace is disabled. Contact an
 * administrator."} (core/auth/hybrid.py:110-126, `_assert_workspace_usable`), and that is the
 * only signal the server sends.
 */
export const WORKSPACE_PAUSED_DETAIL = 'Workspace is disabled. Contact an administrator.';
const FORBIDDEN = 403;

export function isWorkspacePaused(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.status === FORBIDDEN &&
    error.serverMessage === WORKSPACE_PAUSED_DETAIL
  );
}

/** What to show when the bootstrap (or any call) fails: the D8 copy for a paused workspace. */
export function workspaceErrorMessage(error: unknown): string {
  return isWorkspacePaused(error) ? WORKSPACE_COPY.paused : userMessage(error);
}
