// The gate's edge-screen slot (US-016j, lead decision 24 Oct): AppGate's optional `edge` draws the
// 'error' and 'not_running' states, given the state, the server, Retry and the sign-out action the
// gate's own screens offer (`leave`, which hands it to what the edge draws with it); unset, every
// state is LaunchState's exactly as before. The real AppGate is rendered with react-dom's server
// renderer over mocked native modules, as shell-bar.test.ts and workspace-key.test.ts do;
// LaunchState and the edge are markers that keep the props they get, and the edge draws the way
// out from what `leave` hands it.

import { createRequire } from 'node:module';
import * as React from 'react';
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SERVER } from '../../api/__tests__/fake-transport';
import { hostedDefaults } from '../../api/discovery';
import { WORKSPACE_ROLES, WorkspaceSchema } from '../../api/workspace';
import { roleCan } from '../../auth/role';
import { RECORD } from '../../connect/__tests__/paired-record';
import type { CurrentServerSnapshot } from '../../connect/current-server';
import type { AppGateProps, GateEdgeProps } from '../AppGate';
import type { LaunchStep, LaunchView } from '../gate';
import type { SignOut } from '../use-sign-out';

type LaunchStateProps = {
  readonly view: LaunchView;
  readonly serverName: string;
  readonly onRetry: (step: LaunchStep) => void;
};

const gate = vi.hoisted(() => ({
  view: { kind: 'loading' } as unknown,
  current: { status: 'ready', own: null, ended: null } as unknown,
  retried: [] as string[],
  launchProps: [] as unknown[],
  edgeProps: [] as unknown[],
  drawnWith: [] as unknown[],
  signOutReads: 0,
  signOut: { signOut: () => undefined, busy: false, label: 'Sign out' } as SignOut,
}));

vi.mock('react-native', () => ({
  View: ({ children }: { readonly children?: ReactNode }) => createElement('div', null, children),
  StyleSheet: { create: <T>(styles: T) => styles },
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { readonly children: ReactNode }) =>
    createElement('main', null, children),
}));
vi.mock('expo-router', () => ({ Redirect: () => 'redirect' }));
vi.mock('../GateStates', () => ({
  LaunchState: (props: LaunchStateProps) => {
    gate.launchProps.push(props);
    return `state:${props.view.kind}`;
  },
  GateLoading: () => 'gate-loading',
}));
vi.mock('../../consent/use-consent', () => ({ useConsentRecord: () => null }));
vi.mock('../use-launch', () => ({
  useLaunch: () => ({
    view: gate.view,
    client: {},
    retry: (step: string) => void gate.retried.push(step),
  }),
}));
vi.mock('../use-sign-out', () => ({
  useSignOut: () => {
    gate.signOutReads += 1;
    return gate.signOut;
  },
  useSignOutOnExpiry: () => undefined,
}));
vi.mock('../query-root', () => ({
  PersistedCache: ({ children }: { readonly children: ReactNode }) => children,
  appQueryClient: {},
  appPersister: () => ({}),
}));
vi.mock('../session', () => ({
  AppSessionProvider: ({ children }: { readonly children: ReactNode }) => children,
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
const { ownServerOf } = await import('../../connect/current-server');
const { ownServerInWords } = await import('../../connect/edges');
const { serverLabel } = await import('../account');

// vitest compiles the .tsx with the classic JSX runtime (tsconfig's jsx: react-native), which reads
// a global React; Metro's preset does not need one
vi.stubGlobal('React', React);

// react-dom ships no types here (@types/react-dom is not a dependency): typed at the one call used
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  readonly renderToStaticMarkup: (element: ReactElement) => string;
};

const OWN = ownServerOf(RECORD);
const HOSTED: CurrentServerSnapshot = { status: 'ready', own: null, ended: null };
const PAIRED: CurrentServerSnapshot = { status: 'ready', own: OWN, ended: null };
const READER = WORKSPACE_ROLES.find((role) => !roleCan(role, 'chat'));
const SIGN_OUT: SignOut = Object.freeze({
  signOut: () => undefined,
  busy: false,
  label: 'Sign out',
});

/** The edge: a marker for the state it draws, the way out it draws from `leave`, the fallback. */
function Edge(props: GateEdgeProps) {
  gate.edgeProps.push(props);
  const draw = (signOut: SignOut) => {
    gate.drawnWith.push(signOut);
    return createElement('b', null, signOut.label);
  };
  // the draw function goes in positionally (react/no-children-prop), where createElement's
  // children type (ReactNode) cannot see a function child
  const leave = createElement(props.leave as ComponentType, null, draw as unknown as ReactNode);
  return createElement(
    'section',
    null,
    createElement('p', null, `edge:${props.view.kind}`),
    leave,
    createElement('i', null, props.fallback),
  );
}

const ERROR: LaunchView = { kind: 'error', step: 'workspace', error: new Error('offline') };
const NOT_RUNNING: LaunchView = { kind: 'not_running', server: OWN.server, step: 'discovery' };
/** The states the gate keeps whether or not the edge is set. */
const KEPT: readonly LaunchView[] = [
  { kind: 'loading' },
  { kind: 'unsupported', message: 'Newer app', detail: 'Update' },
  { kind: 'paused', message: 'Paused' },
  { kind: 'workspace_lost', message: 'Gone' },
];

function render(view: LaunchView, edge?: AppGateProps['edge']): string {
  gate.view = view;
  const props: Omit<AppGateProps, 'children'> = { consent: 'consent-sheet', bar: () => null, edge };
  // the screens go in positionally (react/no-children-prop), where the props type cannot see them
  return renderToStaticMarkup(createElement(AppGate, props as AppGateProps, 'screens'));
}

const lastLaunch = () => gate.launchProps.at(-1) as LaunchStateProps;
const lastEdge = () => gate.edgeProps.at(-1) as GateEdgeProps;

beforeEach(() => {
  gate.current = HOSTED;
  gate.retried = [];
  gate.launchProps = [];
  gate.edgeProps = [];
  gate.drawnWith = [];
  gate.signOutReads = 0;
  gate.signOut = SIGN_OUT;
});

describe('unset: every state is LaunchState, exactly as before the slot', () => {
  it.each([ERROR, NOT_RUNNING, ...KEPT])('$kind', (view) => {
    expect(render(view)).toBe(`<div><main>state:${view.kind}</main></div>`);
    expect(gate.launchProps).toHaveLength(1);
    expect(gate.signOutReads).toBe(0);
    expect(lastLaunch().view).toBe(view);
    expect(lastLaunch().serverName).toBe(serverLabel(SERVER));
    lastLaunch().onRetry('discovery');
    expect(gate.retried).toEqual(['discovery']);
  });

  it('names an own server in words, as before', () => {
    gate.current = PAIRED;
    render(NOT_RUNNING);
    expect(lastLaunch().serverName).toBe(ownServerInWords(OWN));
  });
});

describe('set: the edge draws the error and Not running', () => {
  it('an error: the state, the server, Retry for its step and the sign-out action', () => {
    expect(render(ERROR, Edge)).toBe(
      '<div><main><section><p>edge:error</p><b>Sign out</b><i>state:error</i></section></main></div>',
    );
    const props = lastEdge();
    expect(props.view).toBe(ERROR);
    expect(props.server).toBe(SERVER);
    expect(props.serverName).toBe(serverLabel(SERVER));
    expect(gate.drawnWith).toEqual([SIGN_OUT]);
    expect(gate.drawnWith[0]).toBe(SIGN_OUT);
    expect(gate.signOutReads).toBe(1);
    props.onRetry();
    expect(gate.retried).toEqual(['workspace']);
  });

  it("Not running on an own server: its server, its words and the gate's way out", () => {
    gate.current = PAIRED;
    gate.signOut = { ...gate.signOut, label: 'Forget this server' };
    expect(render(NOT_RUNNING, Edge)).toBe(
      '<div><main><section><p>edge:not_running</p><b>Forget this server</b>' +
        '<i>state:not_running</i></section></main></div>',
    );
    const props = lastEdge();
    expect(props.view).toBe(NOT_RUNNING);
    expect(props.server).toEqual(OWN.server);
    expect(props.serverName).toBe(ownServerInWords(OWN));
    expect(gate.drawnWith).toEqual([gate.signOut]);
    props.onRetry();
    expect(gate.retried).toEqual(['discovery']);
  });

  it("hands the edge the gate's own state as the fallback, with the gate's Retry", () => {
    render(ERROR, Edge);
    expect(gate.launchProps).toHaveLength(1);
    expect(lastLaunch().view).toBe(ERROR);
    lastLaunch().onRetry('workspace');
    expect(gate.retried).toEqual(['workspace']);
  });

  it.each(KEPT)('$kind stays LaunchState', (view) => {
    expect(render(view, Edge)).toBe(`<div><main>state:${view.kind}</main></div>`);
    expect(gate.edgeProps).toHaveLength(0);
  });

  it('reads the sign-out action only where the edge draws the way out', () => {
    const Quiet = (props: GateEdgeProps) => {
      gate.edgeProps.push(props);
      return createElement('i', null, props.fallback);
    };
    expect(render(ERROR, Quiet)).toBe('<div><main><i>state:error</i></main></div>');
    expect(gate.edgeProps).toHaveLength(1);
    expect(gate.signOutReads).toBe(0);
  });

  it('the consent sheet and the screens are untouched', () => {
    const workspace = WorkspaceSchema.parse({ id: RECORD.workspaceId, name: 'Home', role: READER });
    const ready: LaunchView = { kind: 'ready', discovery: hostedDefaults(SERVER), workspace };
    expect(render(ready, Edge)).toBe('<div><main>screens</main></div>');
    expect(gate.edgeProps).toHaveLength(0);
  });
});
