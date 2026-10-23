// P001N-SEAM-1, end to end over the shell's own pieces: the launch client (launch-client.ts) on a
// fake transport, the gate's workspace query read through it and mounted on a real QueryClient, and
// the refresher hearing refusals the way useSessionRefresh does (hearRefusals over a refusal
// channel). A 403 from a call no cache sees (a request, a chat-shaped streamed turn) reads the
// workspace again and the new role is the one held; a burst reads once; the workspace read's own
// 403 never loops; other failures read nothing; a refusal through a mutation or a query, which both
// the client and the caches hear, is one 'forbidden', never two.

import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import { SERVER, fakeTransport, flush, jsonReply, reply } from '../../api/__tests__/fake-transport';
import { ApiError } from '../../api/errors';
import { queryKeys } from '../../api/query-keys';
import { routes, type Route } from '../../api/routes';
import type { TransportRequest } from '../../api/transport-types';
import { WORKSPACE_ROLES, WorkspaceSchema, type Workspace } from '../../api/workspace';
import { createLaunchClient } from '../../app-state/launch-client';
import type { ClientAuth } from '../../auth/providers/binding';
import { roleCan } from '../../auth/role';
import { FORBIDDEN_REFRESH_MIN_MS } from '../config';
import { createRefusals } from '../refusals';
import { createSessionRefresher, hearRefusals } from '../session-refresh';

const WRITER = WORKSPACE_ROLES.find((role) => roleCan(role, 'answer'));
const READER = WORKSPACE_ROLES.find((role) => !roleCan(role, 'answer'));
const WORKSPACE: Workspace = WorkspaceSchema.parse({
  id: '7f1c2a54-0000-4000-8000-000000000001',
  name: 'Workspace',
  role: WRITER,
});
const DEMOTED: Workspace = WorkspaceSchema.parse({ ...WORKSPACE, role: READER });

const REFUSED: Route = { method: 'POST', path: '/api/test/refused' };
/** A chat-shaped turn: a streamed POST, the way chat's turn runner opens it. */
const CHAT_TURN: Route = { method: 'POST', path: '/api/test/chat' };
const MISSING: Route = { method: 'GET', path: '/api/test/missing' };
const CONFLICT: Route = { method: 'POST', path: '/api/test/conflict' };
const STATUS_OF: Readonly<Record<string, number>> = {
  [REFUSED.path]: 403,
  [CHAT_TURN.path]: 403,
  [MISSING.path]: 404,
  [CONFLICT.path]: 409,
};
const AUTH: ClientAuth = { getToken: async () => 'token', onAuthExpired: () => undefined };

/** A refusal status (a number) or the workspace answered. */
type WorkspaceAnswer = Workspace | number;

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
});

function serverOf(workspaceAnswers: readonly WorkspaceAnswer[]) {
  let reads = 0;
  const transport = fakeTransport((request: TransportRequest) => {
    const path = request.url.slice(SERVER.apiUrl.length);
    if (path !== routes.workspaceCurrent.path) return reply(STATUS_OF[path] ?? 200, '{}');
    const answer = workspaceAnswers[Math.min(reads, workspaceAnswers.length - 1)];
    reads += 1;
    return typeof answer === 'number' ? reply(answer) : jsonReply(200, answer);
  });
  return { transport, reads: () => reads };
}

/** The gate's workspace query, read once through the launch client; the refresher hearing. */
async function harness(workspaceAnswers: readonly WorkspaceAnswer[] = [WORKSPACE, DEMOTED]) {
  const server = serverOf(workspaceAnswers);
  const refusals = createRefusals();
  const client = createLaunchClient({
    server: SERVER,
    clientAuth: AUTH,
    workspaceIds: { get: () => null },
    transport: server.transport,
    refusals,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const observer = new QueryObserver(queryClient, {
    queryKey: queryKeys.workspace(),
    queryFn: ({ signal }) =>
      client.request(routes.workspaceCurrent, { schema: WorkspaceSchema, signal }),
    staleTime: 0,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await flush();
  // every refusal below lands once the interval since that first read has passed
  const refresh = createSessionRefresher(queryClient, () => Date.now() + FORBIDDEN_REFRESH_MIN_MS);
  let heard = 0;
  const stopHearing = hearRefusals(queryClient, refusals, () => {
    heard += 1;
    refresh('forbidden');
  });
  stops.push(() => {
    stopHearing();
    unsubscribe();
    queryClient.clear();
  });
  return {
    client,
    queryClient,
    reads: server.reads,
    heard: () => heard,
    canAnswer: () =>
      roleCan(queryClient.getQueryData<Workspace>(queryKeys.workspace())?.role, 'answer'),
  };
}

async function failed(call: Promise<unknown>): Promise<unknown> {
  const error = await call.catch((caught: unknown) => caught);
  await flush();
  return error;
}

describe("the session's client: a refusal no cache sees reads the role again", () => {
  it('a 403 from a request reads the workspace once, and the demoted role is the one held', async () => {
    const h = await harness();
    expect(h.reads()).toBe(1);
    expect(h.canAnswer()).toBe(true);
    const error = await failed(h.client.request(REFUSED, { body: { approve: true } }));
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('forbidden');
    expect(h.reads()).toBe(2);
    expect(h.canAnswer()).toBe(false);
  });

  it('a 403 from a stream (a chat-shaped turn) reads the workspace once', async () => {
    const h = await harness();
    const error = await failed(h.client.stream(CHAT_TURN, { body: { message: 'hi' } }));
    expect((error as ApiError).kind).toBe('forbidden');
    expect(h.reads()).toBe(2);
    expect(h.canAnswer()).toBe(false);
  });

  it('a burst of 403s reads the workspace once', async () => {
    const h = await harness();
    await failed(
      Promise.all([
        h.client.request(REFUSED),
        h.client.stream(CHAT_TURN),
        h.client.request(REFUSED),
      ]),
    );
    await flush();
    expect(h.reads()).toBe(2);
  });

  it("the workspace read's own 403 never loops", async () => {
    const h = await harness([WORKSPACE, 403]);
    await failed(h.client.request(REFUSED));
    await flush();
    expect(h.reads()).toBe(2);
    await failed(h.client.request(routes.workspaceCurrent));
    await flush();
    expect(h.reads()).toBe(3);
    expect(h.heard()).toBe(1);
  });

  it('a non-403 failure reads nothing again', async () => {
    const h = await harness();
    await failed(h.client.request(MISSING));
    await failed(h.client.request(CONFLICT));
    expect(h.reads()).toBe(1);
    expect(h.heard()).toBe(0);
  });
});

describe('a refusal both the client and the caches hear is one', () => {
  it('through a mutation: one forbidden, one read', async () => {
    const h = await harness();
    const mutation = h.queryClient.getMutationCache().build(h.queryClient, {
      mutationFn: () => h.client.request(REFUSED, { body: { answer: 'yes' } }),
    });
    const error = await failed(mutation.execute(undefined));
    expect((error as ApiError).kind).toBe('forbidden');
    expect(h.heard()).toBe(1);
    expect(h.reads()).toBe(2);
  });

  it("through a screen's query: one forbidden, one read", async () => {
    const h = await harness();
    await failed(
      h.queryClient.fetchQuery({
        queryKey: queryKeys.board(),
        queryFn: () => h.client.request(REFUSED),
        retry: false,
      }),
    );
    expect(h.heard()).toBe(1);
    expect(h.reads()).toBe(2);
  });
});
