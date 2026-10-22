import { QueryClient, QueryObserver, type QueryObserverResult } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { SERVER } from '../../api/__tests__/fake-transport';
import { DiscoverySchema, hostedDefaults, type Discovery } from '../../api/discovery';
import { ApiError, errorFromResponse } from '../../api/errors';
import { queryKeys } from '../../api/query-keys';
import { WORKSPACE_COPY } from '../../api/strings';
import { WORKSPACE_PAUSED_DETAIL, WorkspaceSchema, type Workspace } from '../../api/workspace';
import { AUTH_COPY } from '../../auth/strings';
import {
  PENDING,
  accessView,
  launchView,
  serverSupported,
  stepOf,
  type QuerySnapshot,
  type Step,
} from '../gate';

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

const ok = <T>(data: T): Step<T> => ({ status: 'success', data });
const failed = (error: unknown): Step<never> => ({ status: 'error', error });
const PAUSED = errorFromResponse(403, JSON.stringify({ detail: WORKSPACE_PAUSED_DETAIL }));
const OFFLINE = new ApiError('network');

const SIGNED_IN = { server: SERVER, isLoaded: true, isSignedIn: true, ownerId: 'user_2abc' };

describe('accessView: the build, then the session', () => {
  it('shows the honest state for a build without a server, before anything else', () => {
    expect(accessView({ ...SIGNED_IN, server: null })).toEqual({ kind: 'not_configured' });
    expect(accessView({ server: null, isLoaded: false, isSignedIn: false, ownerId: null })).toEqual(
      { kind: 'not_configured' },
    );
  });

  it('waits while Clerk reads its stored client', () => {
    expect(accessView({ ...SIGNED_IN, isLoaded: false })).toEqual({ kind: 'loading' });
  });

  it('sends a signed-out person to sign-in', () => {
    expect(accessView({ ...SIGNED_IN, isSignedIn: false, ownerId: null })).toEqual({
      kind: 'signed_out',
    });
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

describe('launchView: discovery, a supported sign-in, then the workspace', () => {
  it('waits for discovery first, whatever the workspace step says', () => {
    expect(launchView({ discovery: PENDING, workspace: ok(WORKSPACE) })).toEqual({
      kind: 'loading',
    });
  });

  it('shows a discovery failure with the step to retry', () => {
    expect(launchView({ discovery: failed(OFFLINE), workspace: PENDING })).toEqual({
      kind: 'error',
      step: 'discovery',
      error: OFFLINE,
    });
  });

  it('tells a server with no sign-in this app has that it needs a newer Automatos Go', () => {
    expect(launchView({ discovery: ok(UNKNOWN_MODES), workspace: PENDING })).toEqual({
      kind: 'unsupported',
      message: AUTH_COPY.unsupportedServer,
    });
    expect(AUTH_COPY.unsupportedServer).toBe('This server needs a newer Automatos Go');
  });

  it('runs on the hosted defaults when the server has no discovery document yet (K3)', () => {
    expect(serverSupported(ok(HOSTED))).toBe(true);
    expect(launchView({ discovery: ok(HOSTED), workspace: PENDING })).toEqual({ kind: 'loading' });
  });

  it('opens the app once the workspace is read', () => {
    expect(launchView({ discovery: ok(HOSTED), workspace: ok(WORKSPACE) })).toEqual({
      kind: 'ready',
      discovery: HOSTED,
      workspace: WORKSPACE,
    });
  });

  it('shows a workspace failure with the step to retry', () => {
    expect(launchView({ discovery: ok(HOSTED), workspace: failed(OFFLINE) })).toEqual({
      kind: 'error',
      step: 'workspace',
      error: OFFLINE,
    });
  });

  it('says a paused workspace is paused, in its own words (D8)', () => {
    expect(launchView({ discovery: ok(HOSTED), workspace: failed(PAUSED) })).toEqual({
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
