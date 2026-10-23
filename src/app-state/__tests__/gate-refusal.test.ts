// US-007a: the gate routes a refused bootstrap (src/session/bootstrap-refusal.ts): the paused 403 to
// D8's paused state, any other 403 or a 404 to 'workspace_lost' (only the way out), on the hosted
// server and an own one; and a re-read the server refuses after the app opened (on resume, or after
// a 403: src/session/role-refresh.ts) takes the app away, while one that is merely offline does not.

import { QueryClient, QueryObserver, type QueryObserverResult } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { SERVER } from '../../api/__tests__/fake-transport';
import { DiscoverySchema, hostedDefaults, type Discovery } from '../../api/discovery';
import { ApiError, errorFromResponse } from '../../api/errors';
import { queryKeys } from '../../api/query-keys';
import type { Server } from '../../api/server';
import { WORKSPACE_COPY } from '../../api/strings';
import { WORKSPACE_PAUSED_DETAIL, WorkspaceSchema, type Workspace } from '../../api/workspace';
import { RECORD } from '../../connect/__tests__/paired-record';
import { ownServerOf } from '../../connect/current-server';
import { SESSION_COPY } from '../../session/strings';
import { PENDING, launchView, workspaceStepOf, type QuerySnapshot, type Step } from '../gate';

const WORKSPACE: Workspace = WorkspaceSchema.parse({
  id: '7f1c2a54-0000-4000-8000-000000000001',
  name: 'Workspace',
});
const HOSTED: Discovery = hostedDefaults(SERVER);
const PAIRING_ON: Discovery = DiscoverySchema.parse({
  schema: 'automatos-discovery/v1',
  edition: 'local',
  api_url: RECORD.origin,
  web_url: RECORD.webUrl,
  auth: { modes: ['device'], clerk: null },
  pairing: { enabled: true },
});
const OWN_SERVER: Server = ownServerOf(RECORD).server;

const PAUSED = errorFromResponse(403, JSON.stringify({ detail: WORKSPACE_PAUSED_DETAIL }));
const REFUSED = errorFromResponse(403, JSON.stringify({ detail: 'Not a member' }));
const GONE = errorFromResponse(404, JSON.stringify({ detail: 'Workspace not found' }));
const OFFLINE = new ApiError('network');

const ok = <T>(data: T): Step<T> => ({ status: 'success', data });
const failed = (error: unknown): Step<never> => ({ status: 'error', error });
const LOST = { kind: 'workspace_lost', message: SESSION_COPY.lostMessage };

describe('launchView: a refused bootstrap (US-007a)', () => {
  it('the paused 403 is the paused state, in D8 words', () => {
    const paused = { kind: 'paused', message: WORKSPACE_COPY.paused };
    expect(
      launchView({ server: SERVER, discovery: ok(HOSTED), workspace: failed(PAUSED) }),
    ).toEqual(paused);
    expect(
      launchView({ server: OWN_SERVER, discovery: ok(PAIRING_ON), workspace: failed(PAUSED) }),
    ).toEqual(paused);
  });

  it('any other 403, or a 404, is a workspace this person is no longer in', () => {
    for (const error of [REFUSED, GONE]) {
      expect(
        launchView({ server: SERVER, discovery: ok(HOSTED), workspace: failed(error) }),
      ).toEqual(LOST);
      expect(
        launchView({ server: OWN_SERVER, discovery: ok(PAIRING_ON), workspace: failed(error) }),
      ).toEqual(LOST);
    }
  });

  it('a failure that is not a refusal keeps its Retry, or Not running on an own server', () => {
    expect(
      launchView({ server: SERVER, discovery: ok(HOSTED), workspace: failed(OFFLINE) }).kind,
    ).toBe('error');
    expect(
      launchView({ server: OWN_SERVER, discovery: ok(PAIRING_ON), workspace: failed(OFFLINE) })
        .kind,
    ).toBe('not_running');
    const crashed = errorFromResponse(500, '');
    expect(
      launchView({ server: SERVER, discovery: ok(HOSTED), workspace: failed(crashed) }).kind,
    ).toBe('error');
  });
});

const LAUNCHED_AT = 1_000_000;
const READY = { data: WORKSPACE, dataUpdatedAt: LAUNCHED_AT + 5 };

function snapshot(overrides: Partial<QuerySnapshot<Workspace>>): QuerySnapshot<Workspace> {
  return {
    data: undefined,
    error: null,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    fetchStatus: 'idle',
    ...overrides,
  };
}

describe('workspaceStepOf: the bootstrap as a gate step', () => {
  it('is stepOf while nothing was refused: data, a first error, pending', () => {
    expect(workspaceStepOf(snapshot(READY), LAUNCHED_AT)).toEqual(ok(WORKSPACE));
    expect(workspaceStepOf(snapshot({}), LAUNCHED_AT)).toBe(PENDING);
    const first = snapshot({ error: OFFLINE, errorUpdatedAt: LAUNCHED_AT + 1 });
    expect(workspaceStepOf(first, LAUNCHED_AT)).toEqual(failed(OFFLINE));
  });

  it('a re-read refused after the app opened takes it away', () => {
    for (const error of [PAUSED, REFUSED, GONE]) {
      const refused = snapshot({ ...READY, error, errorUpdatedAt: LAUNCHED_AT + 60_000 });
      expect(workspaceStepOf(refused, LAUNCHED_AT)).toEqual(failed(error));
    }
  });

  it('a re-read that is only offline keeps the app open', () => {
    const offline = snapshot({ ...READY, error: OFFLINE, errorUpdatedAt: LAUNCHED_AT + 60_000 });
    expect(workspaceStepOf(offline, LAUNCHED_AT)).toEqual(ok(WORKSPACE));
  });

  it('is loading, never the old app, while a refused workspace is tried again', () => {
    const retrying = snapshot({
      ...READY,
      error: PAUSED,
      errorUpdatedAt: LAUNCHED_AT + 60_000,
      fetchStatus: 'fetching',
    });
    expect(workspaceStepOf(retrying, LAUNCHED_AT)).toBe(PENDING);
  });

  it('a refusal older than the data, or than the launch, no longer counts', () => {
    const answeredSince = snapshot({
      data: WORKSPACE,
      dataUpdatedAt: LAUNCHED_AT + 90,
      error: PAUSED,
      errorUpdatedAt: LAUNCHED_AT + 10,
    });
    expect(workspaceStepOf(answeredSince, LAUNCHED_AT)).toEqual(ok(WORKSPACE));
    const beforeLaunch = snapshot({ error: REFUSED, errorUpdatedAt: LAUNCHED_AT - 1 });
    expect(workspaceStepOf(beforeLaunch, LAUNCHED_AT)).toBe(PENDING);
  });
});

/** The gate's workspace query, read once and then read again with `next`'s answer. */
async function reread(next: () => Promise<Workspace>): Promise<QueryObserverResult<Workspace>> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let answer: () => Promise<Workspace> = async () => WORKSPACE;
  const observer = new QueryObserver(queryClient, {
    queryKey: queryKeys.workspace(),
    queryFn: () => answer(),
    staleTime: 0,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 0));
  answer = next;
  const result = await observer.refetch();
  unsubscribe();
  return result;
}

describe('a re-read over a real TanStack result', () => {
  it('a paused or lost workspace found on resume shows its state', async () => {
    const launchedAt = Date.now();
    const paused = await reread(async () => Promise.reject(PAUSED));
    expect(paused.data).toEqual(WORKSPACE);
    const pausedStep = workspaceStepOf(paused, launchedAt);
    expect(launchView({ server: SERVER, discovery: ok(HOSTED), workspace: pausedStep }).kind).toBe(
      'paused',
    );
    const lost = await reread(async () => Promise.reject(GONE));
    expect(
      launchView({
        server: SERVER,
        discovery: ok(HOSTED),
        workspace: workspaceStepOf(lost, launchedAt),
      }),
    ).toEqual(LOST);
  });

  it('an offline re-read keeps the app ready', async () => {
    const launchedAt = Date.now();
    const offline = await reread(async () => Promise.reject(OFFLINE));
    expect(
      launchView({
        server: SERVER,
        discovery: ok(HOSTED),
        workspace: workspaceStepOf(offline, launchedAt),
      }).kind,
    ).toBe('ready');
  });
});
