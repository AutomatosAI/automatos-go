import { QueryClient, QueryObserver, type QueryObserverResult } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { SERVER } from '../../api/__tests__/fake-transport';
import { DiscoverySchema, hostedDefaults, type Discovery } from '../../api/discovery';
import { ApiError, errorFromResponse } from '../../api/errors';
import { queryKeys } from '../../api/query-keys';
import type { Server } from '../../api/server';
import { WORKSPACE_COPY } from '../../api/strings';
import { WORKSPACE_PAUSED_DETAIL, WorkspaceSchema, type Workspace } from '../../api/workspace';
import { AUTH_COPY } from '../../auth/strings';
import { RECORD } from '../../connect/__tests__/paired-record';
import { ownServerOf } from '../../connect/current-server';
import type { DeviceRefusal } from '../../connect/expiry';
import { OWN_SERVER_COPY } from '../../connect/strings';
import {
  PENDING,
  accessView,
  launchView,
  serverSupported,
  stepOf,
  type AccessInput,
  type QuerySnapshot,
  type Step,
} from '../gate';
import { SHELL_COPY } from '../strings';

const WORKSPACE: Workspace = WorkspaceSchema.parse({
  id: '7f1c2a54-0000-4000-8000-000000000001',
  name: "Gerard's workspace",
  role: 'editor',
});
const HOSTED: Discovery = hostedDefaults(SERVER);
/** A server that signs in only with modes this version does not have yet. */
const UNKNOWN_MODES: Discovery = DiscoverySchema.parse({
  schema: 'automatos-discovery/v1',
  edition: 'local',
  api_url: 'http://192.168.1.20:8000',
  web_url: 'http://192.168.1.20:3000',
  auth: { modes: ['oidc', 'passkey-v2'], clerk: null },
});
/** A paired self-hosted install: 'device' is registered since US-006c. */
const DEVICE_ONLY: Discovery = { ...UNKNOWN_MODES, auth: { modes: ['device'], clerk: null } };
/** The same install taking paired phones (LOCAL_REMOTE_ACCESS=paired): W1 discovery.py. */
const PAIRING_ON: Discovery = { ...DEVICE_ONLY, pairing: { enabled: true } };

/** This phone's paired own server (KC4): its origin, Studio, name and device. */
const OWN = ownServerOf(RECORD);
const OWN_SERVER: Server = OWN.server;

const ok = <T>(data: T): Step<T> => ({ status: 'success', data });
const failed = (error: unknown): Step<never> => ({ status: 'error', error });
const PAUSED = errorFromResponse(403, JSON.stringify({ detail: WORKSPACE_PAUSED_DETAIL }));
const OFFLINE = new ApiError('network');
const NOT_FOUND = new ApiError('not_found', { status: 404 });

const SIGNED_IN: AccessInput = {
  own: null,
  ended: null,
  hosted: SERVER,
  isLoaded: true,
  isSignedIn: true,
  ownerId: 'user_2abc',
};
const SIGNED_OUT: AccessInput = { ...SIGNED_IN, isSignedIn: false, ownerId: null };
/** A paired phone's device session (src/auth/AuthRoot.tsx DeviceSession). */
const PAIRED: AccessInput = { ...SIGNED_IN, own: OWN, ownerId: OWN.deviceId };
const REVOKED: DeviceRefusal = { reason: 'revoked', serverName: 'Home NAS', origin: RECORD.origin };

describe('accessView: the server, then the session', () => {
  it('opens Welcome in a build without a hosted server: Connect still works there', () => {
    expect(accessView({ ...SIGNED_IN, hosted: null })).toEqual({ kind: 'welcome' });
    expect(accessView({ ...SIGNED_OUT, hosted: null, isLoaded: false })).toEqual({
      kind: 'welcome',
    });
  });

  it('waits while Clerk reads its stored client', () => {
    expect(accessView({ ...SIGNED_IN, isLoaded: false })).toEqual({ kind: 'loading' });
  });

  it('sends a signed-out person to Welcome (hosted sign-in is its first choice)', () => {
    expect(accessView(SIGNED_OUT)).toEqual({ kind: 'welcome' });
  });

  it('waits for the owner of a signed-in session before the cache is opened for them', () => {
    expect(accessView({ ...SIGNED_IN, ownerId: null })).toEqual({ kind: 'loading' });
    expect(accessView({ ...SIGNED_IN, ownerId: '' })).toEqual({ kind: 'loading' });
  });

  it('lets a signed-in person through with the server and their id', () => {
    expect(accessView(SIGNED_IN)).toEqual({
      kind: 'signed_in',
      server: SERVER,
      ownerId: 'user_2abc',
    });
  });
});

describe('accessView: your own server (US-006d, KC4)', () => {
  it('opens a paired own server with its device session, the device as the cache owner', () => {
    const view = { kind: 'signed_in', server: OWN_SERVER, ownerId: RECORD.deviceId };
    expect(accessView(PAIRED)).toEqual(view);
    expect(accessView({ ...PAIRED, hosted: null })).toEqual(view);
    expect(OWN_SERVER).toEqual({
      apiUrl: RECORD.origin,
      webUrl: RECORD.webUrl,
      source: 'own',
    });
  });

  it('sends a paired server with no token back to Connect, for that server', () => {
    expect(accessView({ ...PAIRED, isSignedIn: false, ownerId: null })).toEqual({
      kind: 'connect',
      origin: RECORD.origin,
      serverName: RECORD.serverName,
      reason: null,
    });
  });

  it('waits while the device session loads or names its owner', () => {
    expect(accessView({ ...PAIRED, isLoaded: false })).toEqual({ kind: 'loading' });
    expect(accessView({ ...PAIRED, ownerId: null })).toEqual({ kind: 'loading' });
  });

  it('after a refusal (US-006c), Connect carries the reason and the server that refused', () => {
    for (const reason of ['revoked', 'pairing_required', 'ended'] as const) {
      expect(accessView({ ...SIGNED_OUT, ended: { ...REVOKED, reason } })).toEqual({
        kind: 'connect',
        origin: RECORD.origin,
        serverName: 'Home NAS',
        reason,
      });
    }
  });

  it('goes to Connect after a refusal without waiting for Clerk, or for a hosted server', () => {
    const view = {
      kind: 'connect',
      origin: RECORD.origin,
      serverName: 'Home NAS',
      reason: 'revoked',
    };
    expect(accessView({ ...SIGNED_OUT, isLoaded: false, ended: REVOKED })).toEqual(view);
    expect(accessView({ ...SIGNED_OUT, hosted: null, ended: REVOKED })).toEqual(view);
  });

  it('lets a hosted sign-in made since the refusal through', () => {
    expect(accessView({ ...SIGNED_IN, ended: REVOKED })).toEqual({
      kind: 'signed_in',
      server: SERVER,
      ownerId: 'user_2abc',
    });
  });
});

function launch(discovery: Step<Discovery>, workspace: Step<Workspace>, server = SERVER) {
  return launchView({ server, discovery, workspace });
}

describe('launchView: discovery, a supported sign-in, then the workspace', () => {
  it('waits for discovery first, whatever the workspace step says', () => {
    expect(launch(PENDING, ok(WORKSPACE))).toEqual({ kind: 'loading' });
  });

  it('shows a discovery failure with the step to retry', () => {
    expect(launch(failed(OFFLINE), PENDING)).toEqual({
      kind: 'error',
      step: 'discovery',
      error: OFFLINE,
    });
  });

  it('tells a server with no sign-in this app has that it needs a newer Automatos Go', () => {
    expect(launch(ok(UNKNOWN_MODES), PENDING)).toEqual({
      kind: 'unsupported',
      message: AUTH_COPY.unsupportedServer,
      detail: SHELL_COPY.unsupportedMessage,
    });
    expect(AUTH_COPY.unsupportedServer).toBe('This server needs a newer Automatos Go');
  });

  it('runs on the hosted defaults when the server has no discovery document yet (K3)', () => {
    expect(serverSupported(ok(HOSTED))).toBe(true);
    expect(launch(ok(HOSTED), PENDING)).toEqual({ kind: 'loading' });
  });

  it('opens the app once the workspace is read', () => {
    expect(launch(ok(HOSTED), ok(WORKSPACE))).toEqual({
      kind: 'ready',
      discovery: HOSTED,
      workspace: WORKSPACE,
    });
  });

  it('shows a workspace failure with the step to retry', () => {
    expect(launch(ok(HOSTED), failed(OFFLINE))).toEqual({
      kind: 'error',
      step: 'workspace',
      error: OFFLINE,
    });
  });

  it('says a paused workspace is paused, in its own words (D8)', () => {
    expect(launch(ok(HOSTED), failed(PAUSED))).toEqual({
      kind: 'paused',
      message: WORKSPACE_COPY.paused,
    });
  });

  it('bootstraps only for a server that takes a sign-in this app has', () => {
    expect(serverSupported(PENDING)).toBe(false);
    expect(serverSupported(failed(OFFLINE))).toBe(false);
    expect(serverSupported(ok(UNKNOWN_MODES))).toBe(false);
    expect(serverSupported(ok(DEVICE_ONLY))).toBe(true);
  });
});

describe('launchView: your own server (US-006d)', () => {
  it('an own server that does not answer is Not running, naming the step to retry', () => {
    expect(launch(failed(OFFLINE), PENDING, OWN_SERVER)).toEqual({
      kind: 'not_running',
      server: OWN_SERVER,
      step: 'discovery',
    });
    expect(launch(ok(PAIRING_ON), failed(OFFLINE), OWN_SERVER)).toEqual({
      kind: 'not_running',
      server: OWN_SERVER,
      step: 'workspace',
    });
  });

  it('a gateway that cannot reach it is Not running too; a server that answers is not', () => {
    for (const status of [502, 504]) {
      const view = launch(failed(errorFromResponse(status, '')), PENDING, OWN_SERVER);
      expect(view.kind).toBe('not_running');
    }
    for (const status of [500, 503]) {
      const view = launch(failed(errorFromResponse(status, '')), PENDING, OWN_SERVER);
      expect(view.kind).toBe('error');
    }
  });

  it("an own server's 404 says it can't pair phones yet (K3 is the built-in server's only)", () => {
    expect(launch(failed(NOT_FOUND), PENDING, OWN_SERVER)).toEqual({
      kind: 'unsupported',
      ...OWN_SERVER_COPY.no_discovery,
    });
    expect(OWN_SERVER_COPY.no_discovery.message).toBe(
      "This server's version of Automatos can't pair phones yet. Update it.",
    );
    expect(launch(failed(NOT_FOUND), PENDING).kind).toBe('error');
  });

  it("an own server must still take paired phones: 'device' in auth.modes and pairing on", () => {
    expect(launch(ok(HOSTED), PENDING, OWN_SERVER)).toEqual({
      kind: 'unsupported',
      message: AUTH_COPY.unsupportedServer,
      detail: SHELL_COPY.unsupportedMessage,
    });
    expect(launch(ok(DEVICE_ONLY), PENDING, OWN_SERVER)).toEqual({
      kind: 'unsupported',
      ...OWN_SERVER_COPY.pairing_off,
    });
    expect(OWN_SERVER_COPY.pairing_off.detail).toContain('LOCAL_REMOTE_ACCESS=paired');
    expect(launch(ok(PAIRING_ON), PENDING, OWN_SERVER)).toEqual({ kind: 'loading' });
  });

  it('opens a paired server once its workspace is read; a paused one says so (D8)', () => {
    expect(launch(ok(PAIRING_ON), ok(WORKSPACE), OWN_SERVER)).toEqual({
      kind: 'ready',
      discovery: PAIRING_ON,
      workspace: WORKSPACE,
    });
    expect(launch(ok(PAIRING_ON), failed(PAUSED), OWN_SERVER).kind).toBe('paused');
  });

  it('bootstraps an own server only once it takes paired phones', () => {
    expect(serverSupported(ok(PAIRING_ON), 'own')).toBe(true);
    expect(serverSupported(ok(DEVICE_ONLY), 'own')).toBe(false);
    expect(serverSupported(ok(HOSTED), 'own')).toBe(false);
    expect(serverSupported(failed(OFFLINE), 'own')).toBe(false);
  });
});

const LAUNCHED_AT = 1_000_000;

function snapshot<T>(overrides: Partial<QuerySnapshot<T>>): QuerySnapshot<T> {
  return {
    data: undefined,
    error: null,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    fetchStatus: 'idle',
    ...overrides,
  };
}

describe('stepOf: a query as a gate step', () => {
  it('is pending with nothing yet, and while the first try is in flight', () => {
    expect(stepOf(snapshot({}))).toBe(PENDING);
    expect(stepOf(snapshot({ fetchStatus: 'fetching' }))).toBe(PENDING);
  });

  it('counts data fetched since the launch', () => {
    const step = stepOf(snapshot({ data: WORKSPACE, dataUpdatedAt: LAUNCHED_AT + 5 }), LAUNCHED_AT);
    expect(step).toEqual({ status: 'success', data: WORKSPACE });
  });

  it('never opens on a copy restored from an earlier launch while the bootstrap runs', () => {
    const restored = { data: WORKSPACE, dataUpdatedAt: LAUNCHED_AT - 60_000 };
    expect(stepOf(snapshot({ ...restored, fetchStatus: 'fetching' }), LAUNCHED_AT)).toBe(PENDING);
    expect(stepOf(snapshot(restored), LAUNCHED_AT)).toBe(PENDING);
  });

  it('takes a restored copy when the caller counts from 0 (the discovery document)', () => {
    const restored = snapshot({ data: HOSTED, dataUpdatedAt: 5, fetchStatus: 'fetching' });
    expect(stepOf(restored)).toEqual({ status: 'success', data: HOSTED });
  });

  it("fails on this launch's error when no data counts", () => {
    const restored = { data: WORKSPACE, dataUpdatedAt: LAUNCHED_AT - 60_000 };
    const step = stepOf(
      snapshot({ ...restored, error: OFFLINE, errorUpdatedAt: LAUNCHED_AT + 3 }),
      LAUNCHED_AT,
    );
    expect(step).toEqual({ status: 'error', error: OFFLINE });
  });

  it('shows loading, not the old error, while Retry is in flight', () => {
    const errored = snapshot({ error: OFFLINE, errorUpdatedAt: LAUNCHED_AT + 3 });
    expect(stepOf({ ...errored, fetchStatus: 'fetching' }, LAUNCHED_AT)).toBe(PENDING);
  });

  it('keeps the app open when a later refetch fails or is in flight', () => {
    const ready = { data: WORKSPACE, dataUpdatedAt: LAUNCHED_AT + 5 };
    const failedLater = snapshot({ ...ready, error: OFFLINE, errorUpdatedAt: LAUNCHED_AT + 99 });
    expect(stepOf(failedLater, LAUNCHED_AT)).toEqual({ status: 'success', data: WORKSPACE });
    expect(stepOf(snapshot({ ...ready, fetchStatus: 'fetching' }), LAUNCHED_AT).status).toBe(
      'success',
    );
  });

  it('ignores an error from before the launch', () => {
    const old = snapshot({ error: OFFLINE, errorUpdatedAt: LAUNCHED_AT - 1 });
    expect(stepOf(old, LAUNCHED_AT)).toBe(PENDING);
  });
});

/** The gate's workspace query as useLaunch builds it, over a real QueryClient. */
async function workspaceResult(
  queryClient: QueryClient,
  queryFn: () => Promise<Workspace>,
): Promise<QueryObserverResult<Workspace>> {
  const observer = new QueryObserver(queryClient, {
    queryKey: queryKeys.workspace(),
    queryFn,
    staleTime: 0,
    retry: false,
  });
  const settled = new Promise<QueryObserverResult<Workspace>>((resolve) => {
    const unsubscribe = observer.subscribe((result) => {
      if (result.fetchStatus !== 'idle') return;
      unsubscribe();
      resolve(result);
    });
  });
  return settled;
}

describe('stepOf over a real TanStack result', () => {
  it("opens on the bootstrap's answer, not on the restored copy", async () => {
    const queryClient = new QueryClient();
    const restoredAt = Date.now() - 60_000;
    queryClient.setQueryData(
      queryKeys.workspace(),
      { ...WORKSPACE, name: 'Old name' },
      {
        updatedAt: restoredAt,
      },
    );
    const launchedAt = Date.now();
    const restored = queryClient.getQueryCache().find({ queryKey: queryKeys.workspace() });
    expect(stepOf(restored!.state as QuerySnapshot<Workspace>, launchedAt)).toBe(PENDING);

    const result = await workspaceResult(queryClient, async () => WORKSPACE);
    expect(stepOf(result, launchedAt)).toEqual({ status: 'success', data: WORKSPACE });
  });

  it("fails on the bootstrap's error even with a restored copy in the cache", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.workspace(), WORKSPACE, { updatedAt: Date.now() - 60_000 });
    const launchedAt = Date.now();
    const result = await workspaceResult(queryClient, async () => {
      throw OFFLINE;
    });
    expect(stepOf(result, launchedAt)).toEqual({ status: 'error', error: OFFLINE });
  });
});
