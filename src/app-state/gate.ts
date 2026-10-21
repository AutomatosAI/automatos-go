// The signed-in gate's decision (PRD-001 §4.4, §4.5; D-PURE): what the (app) group shows, in order.
// A build with no server → the honest "not configured" state; Clerk still reading its stored
// client → loading; signed out → sign-in; signed in → the server's discovery document (K3: the
// hosted 404 is already hostedDefaults) → a sign-in mode this app has (else "This server needs a
// newer Automatos Go") → GET /api/workspaces/current, read again on every launch → the app. A
// failed step is an error with Retry (a paused workspace in its own words, D8). app-state/AppGate
// wires it; nothing here imports React.

import type { Discovery } from '../api/discovery';
import type { Server } from '../api/server';
import { WORKSPACE_COPY } from '../api/strings';
import { isWorkspacePaused, type Workspace } from '../api/workspace';
import { selectProvider } from '../auth/select';

export type Step<T> =
  | { readonly status: 'pending' }
  | { readonly status: 'error'; readonly error: unknown }
  | { readonly status: 'success'; readonly data: T };

export const PENDING: Step<never> = Object.freeze({ status: 'pending' });

/** The fields of a TanStack query result a step is read from. */
export type QuerySnapshot<T> = {
  readonly data: T | undefined;
  readonly error: unknown;
  readonly dataUpdatedAt: number;
  readonly errorUpdatedAt: number;
  readonly fetchStatus: 'fetching' | 'paused' | 'idle';
};

/**
 * A query as a gate step. Data counts once it was fetched at or after `since` (the bootstrap passes
 * the launch time, so a workspace restored from the phone's cache never opens the app on its own;
 * discovery passes 0, so a restored document does). Once it counts it keeps counting: a background
 * refetch, or one that fails, never takes the app away. An error counts only when it is this
 * launch's latest word and no new try is in flight (Retry shows loading, not the old error).
 */
export function stepOf<T>(query: QuerySnapshot<T>, since = 0): Step<T> {
  if (query.data !== undefined && query.dataUpdatedAt >= since) {
    return { status: 'success', data: query.data };
  }
  const settled = query.fetchStatus !== 'fetching';
  if (settled && query.error != null && query.errorUpdatedAt >= since) {
    return { status: 'error', error: query.error };
  }
  return PENDING;
}

export type AccessInput = {
  /** The build's server; null when the build has no EXPO_PUBLIC_API_URL. */
  readonly server: Server | null;
  readonly isLoaded: boolean;
  readonly isSignedIn: boolean;
  /** Whose session it is (the persisted cache's owner); null while signed out. */
  readonly ownerId: string | null;
};

export type AccessView =
  | { readonly kind: 'not_configured' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'signed_out' }
  | { readonly kind: 'signed_in'; readonly server: Server; readonly ownerId: string };

const NOT_CONFIGURED: AccessView = Object.freeze({ kind: 'not_configured' });
const LOADING: AccessView = Object.freeze({ kind: 'loading' });
const SIGNED_OUT: AccessView = Object.freeze({ kind: 'signed_out' });

/** The first half of the gate: the build, then the session. */
export function accessView({ server, isLoaded, isSignedIn, ownerId }: AccessInput): AccessView {
  if (server === null) return NOT_CONFIGURED;
  if (!isLoaded) return LOADING;
  if (!isSignedIn) return SIGNED_OUT;
  // signed in, but Clerk has not handed over whose session it is yet
  if (!ownerId) return LOADING;
  return { kind: 'signed_in', server, ownerId };
}

/** Which step a Retry tries again. */
export type LaunchStep = 'discovery' | 'workspace';

export type LaunchInput = {
  readonly discovery: Step<Discovery>;
  readonly workspace: Step<Workspace>;
};

export type LaunchView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly step: LaunchStep; readonly error: unknown }
  | { readonly kind: 'unsupported'; readonly message: string }
  | { readonly kind: 'paused'; readonly message: string }
  | { readonly kind: 'ready'; readonly discovery: Discovery; readonly workspace: Workspace };

const LAUNCHING: LaunchView = Object.freeze({ kind: 'loading' });

/** Whether the server takes a sign-in this app has; the bootstrap waits for a yes. */
export function serverSupported(discovery: Step<Discovery>): boolean {
  return discovery.status === 'success' && !selectProvider(discovery.data).unsupported;
}

function workspaceView(discovery: Discovery, workspace: Step<Workspace>): LaunchView {
  if (workspace.status === 'pending') return LAUNCHING;
  if (workspace.status === 'success') {
    return { kind: 'ready', discovery, workspace: workspace.data };
  }
  if (isWorkspacePaused(workspace.error)) {
    return { kind: 'paused', message: WORKSPACE_COPY.paused };
  }
  return { kind: 'error', step: 'workspace', error: workspace.error };
}

/** The second half of the gate, once signed in: the server, then the workspace. */
export function launchView({ discovery, workspace }: LaunchInput): LaunchView {
  if (discovery.status === 'pending') return LAUNCHING;
  if (discovery.status === 'error') {
    return { kind: 'error', step: 'discovery', error: discovery.error };
  }
  const selection = selectProvider(discovery.data);
  if (selection.unsupported) return { kind: 'unsupported', message: selection.message };
  return workspaceView(discovery.data, workspace);
}
