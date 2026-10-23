// A workspace change mid-session mounts every signed-in screen afresh (P001N-SEAM-2): the server
// falls back to the person's other workspace when X-Workspace-ID is no longer theirs, the bootstrap
// drops the old workspace's queries (session-cache.ts forgetWorkspaceData), and AppGate keys the
// ready subtree by the workspace id, so no screen keeps the old one's local state (chat's thread id,
// its messages and cards). The real AppGate is rendered with react-dom's server renderer over
// mocked native modules, as shell-bar.test.ts does; the safe-area provider hands over the element
// it wraps, so the key React reconciles the session, the consent sheet and the screens under is
// read from the real render.

import { createRequire } from 'node:module';
import * as React from 'react';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SERVER } from '../../api/__tests__/fake-transport';
import { hostedDefaults } from '../../api/discovery';
import { WORKSPACE_ROLES, WorkspaceSchema, type Workspace } from '../../api/workspace';
import { roleCan } from '../../auth/role';
import type { CurrentServerSnapshot } from '../../connect/current-server';
import { consentRecordFor, workspaceConsent } from '../../consent/policy';
import type { ConsentRecord } from '../../consent/store';
import type { AppGateProps } from '../AppGate';
import type { LaunchView } from '../gate';

const gate = vi.hoisted(() => ({
  view: { kind: 'loading' } as unknown,
  records: {} as Record<string, unknown>,
  asked: [] as (string | null)[],
  wrapped: null as unknown,
  current: { status: 'ready', own: null, ended: null } as CurrentServerSnapshot,
}));

vi.mock('react-native', () => ({
  View: ({ children }: { readonly children?: ReactNode }) => createElement('div', null, children),
  StyleSheet: { create: <T>(styles: T) => styles },
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { readonly children: ReactNode }) => {
    gate.wrapped = children;
    return createElement('main', null, children);
  },
}));
vi.mock('expo-router', () => ({ Redirect: () => 'redirect' }));
vi.mock('../GateStates', () => ({
  LaunchState: ({ view }: { readonly view: LaunchView }) => `state:${view.kind}`,
  GateLoading: () => 'gate-loading',
}));
vi.mock('../../consent/use-consent', () => ({
  useConsentRecord: (_origin: string, workspaceId: string | null) => {
    gate.asked.push(workspaceId);
    return workspaceId === null ? null : (gate.records[workspaceId] ?? null);
  },
}));
vi.mock('../use-launch', () => ({
  useLaunch: () => ({ view: gate.view, client: {}, retry: () => undefined }),
}));
vi.mock('../use-sign-out', () => ({ useSignOutOnExpiry: () => undefined }));
vi.mock('../query-root', () => ({
  PersistedCache: ({ children }: { readonly children: ReactNode }) => children,
  appQueryClient: {},
  appPersister: () => ({}),
}));
vi.mock('../session-cache', () => ({ forgetSession: async () => undefined }));
vi.mock('../../api/live', () => ({ LiveEvents: () => null }));
vi.mock('../../auth/AuthRoot', () => ({
  useAuthSession: () => ({
    isLoaded: true,
    isSignedIn: true,
    ownerId: 'owner-1',
    provider: {},
    clientAuth: {},
  }),
}));
vi.mock('../../connect/use-current-server', () => ({ useCurrentServer: () => gate.current }));
vi.mock('../../connect/current-server', async (original) => ({
  ...(await original<typeof import('../../connect/current-server')>()),
  hostedServer: () => SERVER,
}));

const { AppGate } = await import('../AppGate');

// vitest compiles the .tsx with the classic JSX runtime (tsconfig's jsx: react-native), which reads
// a global React; Metro's preset does not need one
vi.stubGlobal('React', React);

// react-dom ships no types here (@types/react-dom is not a dependency): typed at the one call used
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  readonly renderToStaticMarkup: (element: ReactElement) => string;
};

const WRITER = WORKSPACE_ROLES.find((role) => roleCan(role, 'chat'));
const READER = WORKSPACE_ROLES.find((role) => !roleCan(role, 'chat'));
const PROVIDERS = [{ id: 'openai', name: 'OpenAI' }];
const FIRST_ID = '7f1c2a54-0000-4000-8000-000000000001';
const OTHER_ID = '7f1c2a54-0000-4000-8000-000000000002';
const AGREED_AT = new Date('2026-10-23T09:00:00.000Z');
/** The (app) layout's gate, with markers for the consent sheet and (below) the screens. */
const GATE: Omit<AppGateProps, 'children'> = { consent: 'consent-sheet', bar: () => null };

function workspace(id: string, role: string | undefined): Workspace {
  return WorkspaceSchema.parse({ id, name: 'Studio team', role, ai_providers: PROVIDERS });
}

function ready(of: Workspace): LaunchView {
  return { kind: 'ready', discovery: hostedDefaults(SERVER), workspace: of };
}

/** What 'Agree and continue' saves for this workspace (use-consent.ts agree). */
function agreed(of: Workspace): ConsentRecord {
  const consent = workspaceConsent(of, null);
  if (!consent.needed) throw new Error('nothing to agree to');
  return consentRecordFor(consent.providers, AGREED_AT);
}

/** One render of the real gate: what it shows, and the key of the subtree under the safe area. */
function renderGate(view: LaunchView): { readonly markup: string; readonly key: string | null } {
  gate.view = view;
  gate.wrapped = null;
  // the screens go in positionally (react/no-children-prop), where the props type cannot see them
  const markup = renderToStaticMarkup(createElement(AppGate, GATE as AppGateProps, 'screens'));
  return { markup, key: (gate.wrapped as ReactElement | null)?.key ?? null };
}

beforeEach(() => {
  gate.records = {};
  gate.asked = [];
});

describe('the ready subtree is keyed by the workspace id', () => {
  it('the screens mount under the bootstrap’s workspace id', () => {
    const shown = renderGate(ready(workspace(FIRST_ID, READER)));
    expect(shown.markup).toBe('<div><main>screens</main></div>');
    expect(shown.key).toBe(FIRST_ID);
  });

  it('another workspace, another key: every screen mounts afresh', () => {
    const before = renderGate(ready(workspace(FIRST_ID, READER)));
    const after = renderGate(ready(workspace(OTHER_ID, READER)));
    expect(after.markup).toBe('<div><main>screens</main></div>');
    expect(before.key).toBe(FIRST_ID);
    expect(after.key).toBe(OTHER_ID);
    expect(after.key).not.toBe(before.key);
  });

  it('the same workspace keeps its key from the consent sheet to the screens', () => {
    const first = workspace(FIRST_ID, WRITER);
    const asking = renderGate(ready(first));
    gate.records = { [FIRST_ID]: agreed(first) };
    const agreedTo = renderGate(ready(first));
    expect(asking.markup).toBe('<div><main>consent-sheet</main></div>');
    expect(agreedTo.markup).toBe('<div><main>screens</main></div>');
    expect(asking.key).toBe(FIRST_ID);
    expect(agreedTo.key).toBe(FIRST_ID);
  });

  it('the gate’s own states are not the session: they carry no workspace key', () => {
    expect(renderGate({ kind: 'loading' })).toEqual({
      markup: '<div><main>state:loading</main></div>',
      key: null,
    });
  });
});

describe('consent still precedes the screens in the new workspace', () => {
  it('agreed in the old workspace, asked again in the new one, under its own key', () => {
    const first = workspace(FIRST_ID, WRITER);
    gate.records = { [FIRST_ID]: agreed(first) };
    expect(renderGate(ready(first)).markup).toBe('<div><main>screens</main></div>');

    const changed = renderGate(ready(workspace(OTHER_ID, WRITER)));
    expect(gate.asked.at(-1)).toBe(OTHER_ID);
    expect(changed).toEqual({ markup: '<div><main>consent-sheet</main></div>', key: OTHER_ID });
  });

  it('a new workspace already agreed to opens straight on the screens', () => {
    const other = workspace(OTHER_ID, WRITER);
    gate.records = { [OTHER_ID]: agreed(other) };
    expect(renderGate(ready(other))).toEqual({
      markup: '<div><main>screens</main></div>',
      key: OTHER_ID,
    });
  });
});
