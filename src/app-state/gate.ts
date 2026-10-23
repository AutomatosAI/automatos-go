// The signed-in gate's decision (PRD-001 §4.4, §4.5; D-PURE): what the (app) group shows, in order.
// First the server and the session (accessView): a paired own server (KC4) opens with its device
// session, or goes back to Connect with the server when it holds no token; otherwise the built-in
// hosted server: loading while Clerk reads its stored client, the app once signed in; a phone whose
// own server just refused its token goes to Connect with the reason and that server (US-006c); one
// connected nowhere goes to Welcome (hosted sign-in, or Connect). A build that cannot sign in to its
// hosted server still opens Welcome: its not-configured state covers the hosted sign-in only.
// Then, signed in (launchView): the server's discovery document (K3: the built-in server's 404 is
// already hostedDefaults; an own server's is 'unsupported') → a sign-in this app has (an own server
// must still take paired phones) → GET /api/workspaces/current, read again on every launch → the
// app. An own server that does not answer is 'not_running'; any other failed step is an error with
// Retry (a paused workspace in its own words, D8). app-state/AppGate wires it; no React here.

import type { Discovery } from '../api/discovery';
import type { Server, ServerSource } from '../api/server';
import { WORKSPACE_COPY } from '../api/strings';
import { isWorkspacePaused, type Workspace } from '../api/workspace';
import { selectProvider } from '../auth/select';
import { AUTH_COPY } from '../auth/strings';
import type { OwnServer } from '../connect/current-server';
import type { DeviceRefusal, DeviceRefusalReason } from '../connect/expiry';
import {
  isNotRunning,
  isWithoutDiscovery,
  ownDiscoveryRefusal,
  type OwnServerRefusal,
} from '../connect/server-support';
import { OWN_SERVER_COPY } from '../connect/strings';
import { SHELL_COPY } from './strings';

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
  /** The paired own server (KC4): whenever one is paired, it is the current server. */
  readonly own: OwnServer | null;
  /** Why the last own server ended this launch (a refusal of its token), or null. */
  readonly ended: DeviceRefusal | null;
  /** The build's built-in hosted server; null when the build has no EXPO_PUBLIC_API_URL. */
  readonly hosted: Server | null;
  readonly isLoaded: boolean;
  readonly isSignedIn: boolean;
  /** Whose session it is (the persisted cache's owner); null while signed out. */
  readonly ownerId: string | null;
};

export type AccessView =
  | { readonly kind: 'loading' }
  /** Connected nowhere: Welcome offers hosted sign-in and Connect. */
  | { readonly kind: 'welcome' }
  /** Back to Connect for this server, with the reason when the server refused the token. */
  | {
      readonly kind: 'connect';
      readonly origin: string;
      readonly serverName: string;
      readonly reason: DeviceRefusalReason | null;
    }
  | { readonly kind: 'signed_in'; readonly server: Server; readonly ownerId: string };

const LOADING: AccessView = Object.freeze({ kind: 'loading' });
const WELCOME: AccessView = Object.freeze({ kind: 'welcome' });

type SessionState = Pick<AccessInput, 'isLoaded' | 'isSignedIn' | 'ownerId'>;

/** A paired phone: its device session, or Connect for the same server when it holds no token. */
function ownAccess(own: OwnServer, { isLoaded, isSignedIn, ownerId }: SessionState): AccessView {
  if (!isLoaded) return LOADING;
  if (!isSignedIn) {
    return { kind: 'connect', origin: own.server.apiUrl, serverName: own.serverName, reason: null };
  }
  // signed in, but the provider has not handed over whose session it is yet
  if (!ownerId) return LOADING;
  return { kind: 'signed_in', server: own.server, ownerId };
}

function hostedAccess({ hosted, ended, isLoaded, isSignedIn, ownerId }: AccessInput): AccessView {
  if (hosted && isLoaded && isSignedIn) {
    return ownerId ? { kind: 'signed_in', server: hosted, ownerId } : LOADING;
  }
  if (ended) {
    const { origin, serverName, reason } = ended;
    return { kind: 'connect', origin, serverName, reason };
  }
  if (hosted && !isLoaded) return LOADING;
  return WELCOME;
}

/** The first half of the gate: the server, then the session. */
export function accessView(input: AccessInput): AccessView {
  return input.own ? ownAccess(input.own, input) : hostedAccess(input);
}

/** Which step a Retry tries again. */
export type LaunchStep = 'discovery' | 'workspace';

export type LaunchInput = {
  readonly server: Server;
  readonly discovery: Step<Discovery>;
  readonly workspace: Step<Workspace>;
};

export type LaunchView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly step: LaunchStep; readonly error: unknown }
  /** The server can't be used by this app as it is: what it says, and what to do. */
  | { readonly kind: 'unsupported'; readonly message: string; readonly detail: string }
  | { readonly kind: 'paused'; readonly message: string }
  /** An own server that does not answer (PRD-001 §4.7 Edges: Not running). */
  | { readonly kind: 'not_running'; readonly server: Server; readonly step: LaunchStep }
  | { readonly kind: 'ready'; readonly discovery: Discovery; readonly workspace: Workspace };

const LAUNCHING: LaunchView = Object.freeze({ kind: 'loading' });

function unsupported(message: string, detail: string = SHELL_COPY.unsupportedMessage): LaunchView {
  return { kind: 'unsupported', message, detail };
}

/** A server that no longer takes paired phones needs what any server with no known mode needs. */
function ownUnsupported(refusal: OwnServerRefusal): LaunchView {
  if (refusal === 'no_device') return unsupported(AUTH_COPY.unsupportedServer);
  return { kind: 'unsupported', ...OWN_SERVER_COPY[refusal] };
}

/** Why the server can't be used, or null when it takes a sign-in this app has. */
function unsupportedView(server: Server, discovery: Discovery): LaunchView | null {
  if (server.source === 'own') {
    const refusal = ownDiscoveryRefusal(discovery);
    return refusal === null ? null : ownUnsupported(refusal);
  }
  const selection = selectProvider(discovery);
  return selection.unsupported ? unsupported(selection.message) : null;
}

/** Whether the server takes a sign-in this app has; the bootstrap waits for a yes. */
export function serverSupported(
  discovery: Step<Discovery>,
  source: ServerSource = 'hosted',
): boolean {
  if (discovery.status !== 'success') return false;
  if (source === 'own') return ownDiscoveryRefusal(discovery.data) === null;
  return !selectProvider(discovery.data).unsupported;
}

function failedView(server: Server, step: LaunchStep, error: unknown): LaunchView {
  if (server.source === 'own' && isNotRunning(error)) return { kind: 'not_running', server, step };
  if (server.source === 'own' && step === 'discovery' && isWithoutDiscovery(error)) {
    return ownUnsupported('no_discovery');
  }
  return { kind: 'error', step, error };
}

function workspaceView(
  server: Server,
  discovery: Discovery,
  workspace: Step<Workspace>,
): LaunchView {
  if (workspace.status === 'pending') return LAUNCHING;
  if (workspace.status === 'success') {
    return { kind: 'ready', discovery, workspace: workspace.data };
  }
  if (isWorkspacePaused(workspace.error)) {
    return { kind: 'paused', message: WORKSPACE_COPY.paused };
  }
  return failedView(server, 'workspace', workspace.error);
}

/** The second half of the gate, once signed in: the server, then the workspace. */
export function launchView({ server, discovery, workspace }: LaunchInput): LaunchView {
  if (discovery.status === 'pending') return LAUNCHING;
  if (discovery.status === 'error') return failedView(server, 'discovery', discovery.error);
  return (
    unsupportedView(server, discovery.data) ?? workspaceView(server, discovery.data, workspace)
  );
}
