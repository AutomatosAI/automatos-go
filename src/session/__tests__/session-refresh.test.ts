// US-007a: the refresher over a real QueryClient (the hook only adds AppState). A 403 from any query
// but the workspace's own, or from any mutation, reads the workspace again, at most once per
// FORBIDDEN_REFRESH_MIN_MS; the workspace's own refusal never does (no loop); a resume reads again
// once the last read is old enough; nothing else triggers a read. Roles are picked through roleCan
// (only the matrix test names them), and a demotion is seen the way screens see it: roleCan.

import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import { ApiError, errorFromResponse } from '../../api/errors';
import { queryKeys } from '../../api/query-keys';
import { WORKSPACE_ROLES, WorkspaceSchema, type Workspace } from '../../api/workspace';
import { roleCan } from '../../auth/role';
import { FORBIDDEN_REFRESH_MIN_MS, RESUME_REFRESH_AFTER_MS } from '../config';
import {
  createSessionRefresher,
  lastWorkspaceRead,
  watchRefusals,
  type SessionRefresher,
} from '../session-refresh';

const WRITER = WORKSPACE_ROLES.find((role) => roleCan(role, 'answer'));
const READER = WORKSPACE_ROLES.find((role) => !roleCan(role, 'answer'));
const WORKSPACE: Workspace = WorkspaceSchema.parse({
  id: '7f1c2a54-0000-4000-8000-000000000001',
  name: 'Workspace',
  role: WRITER,
});
const DEMOTED: Workspace = WorkspaceSchema.parse({ ...WORKSPACE, role: READER });
/** What a screen asks before it offers an answer. */
const canAnswer = (h: Harness) => roleCan(h.latest()?.role, 'answer');
const FORBIDDEN = errorFromResponse(403, JSON.stringify({ detail: 'Not allowed' }));
const OFFLINE = new ApiError('network');
const NOT_FOUND = new ApiError('not_found', { status: 404 });

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

type Harness = {
  readonly queryClient: QueryClient;
  readonly reads: () => number;
  readonly latest: () => Workspace | undefined;
  readonly refresh: SessionRefresher;
  readonly clock: { offset: number };
  readonly stop: () => void;
};

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
});

/** The gate's workspace query, mounted (active) and read once, with the refresher watching. */
async function harness(answers: readonly (Workspace | Error)[] = [WORKSPACE]): Promise<Harness> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let calls = 0;
  const observer = new QueryObserver(queryClient, {
    queryKey: queryKeys.workspace(),
    queryFn: async () => {
      const answer = answers[Math.min(calls, answers.length - 1)];
      calls += 1;
      if (answer instanceof Error) throw answer;
      return answer;
    },
    staleTime: 0,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await settle();
  const clock = { offset: 0 };
  const refresh = createSessionRefresher(queryClient, () => Date.now() + clock.offset);
  const stopWatching = watchRefusals(queryClient, () => refresh('forbidden'));
  const stop = () => {
    stopWatching();
    unsubscribe();
    queryClient.clear();
  };
  stops.push(stop);
  return {
    queryClient,
    reads: () => calls,
    latest: () => queryClient.getQueryData(queryKeys.workspace()),
    refresh,
    clock,
    stop,
  };
}

async function failQuery(queryClient: QueryClient, key: readonly unknown[], error: Error) {
  await queryClient
    .fetchQuery({ queryKey: key, queryFn: async () => Promise.reject(error), retry: false })
    .catch(() => undefined);
  await settle();
}

async function failMutation(queryClient: QueryClient, error: Error) {
  const mutation = queryClient.getMutationCache().build(queryClient, {
    mutationFn: async () => Promise.reject(error),
  });
  await mutation.execute(undefined).catch(() => undefined);
  await settle();
}

describe('the refresher: a refusal reads the role again', () => {
  it("a 403 from a screen's query reads the workspace again, and the new role is the one held", async () => {
    const h = await harness([WORKSPACE, DEMOTED]);
    expect(h.reads()).toBe(1);
    expect(canAnswer(h)).toBe(true);
    h.clock.offset = FORBIDDEN_REFRESH_MIN_MS;
    await failQuery(h.queryClient, queryKeys.board(), FORBIDDEN);
    expect(h.reads()).toBe(2);
    expect(canAnswer(h)).toBe(false);
  });

  it('a 403 from a mutation (an answer, an approval) reads it again too', async () => {
    const h = await harness([WORKSPACE, DEMOTED]);
    h.clock.offset = FORBIDDEN_REFRESH_MIN_MS;
    await failMutation(h.queryClient, FORBIDDEN);
    expect(h.reads()).toBe(2);
    expect(canAnswer(h)).toBe(false);
  });

  it('a run of 403s inside the interval is one read, never a loop', async () => {
    const h = await harness();
    h.clock.offset = FORBIDDEN_REFRESH_MIN_MS;
    await failMutation(h.queryClient, FORBIDDEN);
    expect(h.reads()).toBe(2);
    // the clock stands still: every later refusal lands just after that read
    h.clock.offset = 0;
    await failMutation(h.queryClient, FORBIDDEN);
    await failQuery(h.queryClient, queryKeys.needsYou(), FORBIDDEN);
    expect(h.reads()).toBe(2);
    h.clock.offset = FORBIDDEN_REFRESH_MIN_MS;
    await failQuery(h.queryClient, queryKeys.board(), FORBIDDEN);
    expect(h.reads()).toBe(3);
  });

  it("the workspace query's own refusal never reads it again, however long ago", async () => {
    const h = await harness([WORKSPACE, FORBIDDEN]);
    // every read looks old enough: only the filter can stop a loop here
    h.clock.offset = FORBIDDEN_REFRESH_MIN_MS * 100;
    await failMutation(h.queryClient, FORBIDDEN);
    await settle();
    expect(h.reads()).toBe(2);
    expect(h.queryClient.getQueryState(queryKeys.workspace())?.error).toBe(FORBIDDEN);
  });

  it('other failures read nothing again', async () => {
    const h = await harness();
    h.clock.offset = FORBIDDEN_REFRESH_MIN_MS * 100;
    await failQuery(h.queryClient, queryKeys.board(), OFFLINE);
    await failQuery(h.queryClient, queryKeys.ticket('t1'), NOT_FOUND);
    await failMutation(h.queryClient, errorFromResponse(401, ''));
    await failMutation(h.queryClient, errorFromResponse(409, ''));
    expect(h.reads()).toBe(1);
  });

  it('hears nothing once stopped', async () => {
    const h = await harness();
    h.clock.offset = FORBIDDEN_REFRESH_MIN_MS;
    h.stop();
    await failMutation(h.queryClient, FORBIDDEN);
    expect(h.reads()).toBe(1);
  });
});

describe('the refresher: launch and resume', () => {
  it('a resume soon after the last read reads nothing; a later one reads again', async () => {
    const h = await harness([WORKSPACE, DEMOTED]);
    expect(h.refresh('resume')).toBe(false);
    h.clock.offset = RESUME_REFRESH_AFTER_MS;
    expect(h.refresh('resume')).toBe(true);
    await settle();
    expect(h.reads()).toBe(2);
    expect(canAnswer(h)).toBe(false);
  });

  it('a launch joins a read already in flight instead of sending a second', async () => {
    const h = await harness();
    h.clock.offset = RESUME_REFRESH_AFTER_MS;
    expect(h.refresh('resume')).toBe(true);
    expect(h.refresh('launch')).toBe(true);
    await settle();
    expect(h.reads()).toBe(2);
  });

  it('knows when the workspace was last read: an answer or a refusal; never when never', async () => {
    expect(lastWorkspaceRead(new QueryClient())).toBeNull();
    const h = await harness([WORKSPACE, FORBIDDEN]);
    const answeredAt = h.queryClient.getQueryState(queryKeys.workspace())?.dataUpdatedAt ?? 0;
    expect(lastWorkspaceRead(h.queryClient)).toBe(answeredAt);
    h.refresh('launch');
    await settle();
    const refusedAt = h.queryClient.getQueryState(queryKeys.workspace())?.errorUpdatedAt ?? 0;
    expect(lastWorkspaceRead(h.queryClient)).toBe(Math.max(answeredAt, refusedAt));
  });
});
