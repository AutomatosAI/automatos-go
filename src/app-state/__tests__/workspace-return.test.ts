// The gate's workspace query on a return to the front (use-launch.ts). Its stale time is 0 (every
// launch reads it), so TanStack's focus rule (src/api/app-focus.ts) would read it on every return;
// it opts out, and its return stays useSessionRefresh's rule: read again once the last read is
// older than RESUME_REFRESH_AFTER_MS (role-refresh.ts). Run on the app's own QueryClient in node,
// with the focus manager wired as query-root.tsx wires it and the refresher as
// use-session-refresh.ts wires it (isResume, then refresh('resume')). The gate's discovery query has
// no rule of its own for a return (Not running's quiet re-check runs only while that screen shows),
// so it stays on the focus rule.

import { focusManager, QueryObserver, type QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import { fakeAppState } from '../../api/__tests__/fake-app-state';
import { flush } from '../../api/__tests__/fake-transport';
import { followAppFocus } from '../../api/app-focus';
import { createQueryClient } from '../../api/query-client';
import { queryKeys } from '../../api/query-keys';
import { WorkspaceSchema, type Workspace } from '../../api/workspace';
import { readRepoFile } from '../../release/__tests__/support/tree';
import { RESUME_REFRESH_AFTER_MS } from '../../session/config';
import { isResume } from '../../session/role-refresh';
import { createSessionRefresher } from '../../session/session-refresh';

const WORKSPACE: Workspace = WorkspaceSchema.parse({
  id: '7f1c2a54-0000-4000-8000-000000000001',
  name: 'Workspace',
  role: 'owner',
});

/** The workspace query's timing as use-launch.ts sets it (pinned below). */
const AS_THE_GATE_SETS_IT = Object.freeze({ staleTime: 0, refetchOnWindowFocus: false });
/** The same query without the opt-out: what the focus rule alone would do with it. */
const WITHOUT_THE_OPT_OUT = Object.freeze({ staleTime: 0 });

const SECOND_MS = 1_000;

let mounted: QueryClient | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted?.clear();
  mounted = null;
  focusManager.setEventListener(() => undefined);
  focusManager.setFocused(undefined);
});

/** The gate's workspace query, read once at launch, with both askers wired to one AppState. */
async function launched(timing: { readonly staleTime: number; refetchOnWindowFocus?: boolean }) {
  const app = fakeAppState('active');
  followAppFocus(app.source);
  const client = createQueryClient();
  client.mount();
  mounted = client;
  let reads = 0;
  const observer = new QueryObserver(client, {
    queryKey: queryKeys.workspace(),
    queryFn: async () => {
      reads += 1;
      return WORKSPACE;
    },
    ...timing,
  });
  observer.subscribe(() => undefined);
  await flush();
  const clock = { offset: 0 };
  const refresh = createSessionRefresher(client, () => Date.now() + clock.offset);
  let previous = app.source.currentState;
  app.source.addEventListener('change', (next) => {
    if (isResume(previous, next)) refresh('resume');
    previous = next;
  });
  return { app, clock, reads: () => reads };
}

describe('the workspace on a return: the session refresh’s 30 s rule, not the focus rule', () => {
  it('a return inside RESUME_REFRESH_AFTER_MS asks nothing for it', async () => {
    const gate = await launched(AS_THE_GATE_SETS_IT);
    expect(gate.reads()).toBe(1);
    gate.clock.offset = RESUME_REFRESH_AFTER_MS - SECOND_MS;
    gate.app.go('inactive', 'background', 'active');
    await flush();
    expect(gate.reads()).toBe(1);
  });

  it('a return after it reads it once, through the session refresh', async () => {
    const gate = await launched(AS_THE_GATE_SETS_IT);
    gate.clock.offset = RESUME_REFRESH_AFTER_MS + SECOND_MS;
    gate.app.go('inactive', 'background', 'active');
    await flush();
    expect(gate.reads()).toBe(2);
  });

  it('without the opt-out, the focus rule would read it on a return inside the 30 s', async () => {
    const gate = await launched(WITHOUT_THE_OPT_OUT);
    gate.clock.offset = RESUME_REFRESH_AFTER_MS - SECOND_MS;
    gate.app.go('inactive', 'background', 'active');
    await flush();
    expect(gate.reads()).toBe(2);
  });
});

describe('use-launch.ts', () => {
  const source = readRepoFile('src/app-state/use-launch.ts');
  const queryOf = (key: string) => {
    const start = source.indexOf(`queryKey: queryKeys.${key}(`);
    return source.slice(start, source.indexOf('});', start));
  };

  it('takes the workspace query out of the focus rule, with its stale time of 0', () => {
    expect(source).toContain('const WORKSPACE_STALE_TIME_MS = 0;');
    const workspace = queryOf('workspace');
    expect(workspace).toContain('staleTime: WORKSPACE_STALE_TIME_MS,');
    expect(workspace).toContain('refetchOnWindowFocus: false,');
  });

  it('leaves the discovery query on the focus rule (it has no return rule of its own)', () => {
    const discovery = queryOf('discovery');
    expect(discovery).toContain('queryFn:');
    expect(discovery).not.toContain('refetchOnWindowFocus');
  });
});
