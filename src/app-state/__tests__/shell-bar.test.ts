// The unencrypted home network line on every state the gate shows a signed-in phone (D-HTTPS,
// P001N-RVW-2). The real (app) layout and AppGate are rendered with react-dom's server renderer over
// mocked native modules, as auth-root.test.ts does: the gate's own states, the consent sheet and
// the screens are markers, the bar is the real ShellNetworkBar. A View renders a <div> carrying
// its top padding, the nested SafeAreaProvider a <main>, so the markup shows where the bar sits.

import { createRequire } from 'node:module';
import * as React from 'react';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SERVER } from '../../api/__tests__/fake-transport';
import { hostedDefaults } from '../../api/discovery';
import type { Server } from '../../api/server';
import { WORKSPACE_ROLES, WorkspaceSchema } from '../../api/workspace';
import { roleCan } from '../../auth/role';
import { OTHER_RECORD, RECORD } from '../../connect/__tests__/paired-record';
import type { CurrentServerSnapshot } from '../../connect/current-server';
import type { LaunchView } from '../gate';

const INSETS = { top: 47, right: 0, bottom: 34, left: 0 };
const SPACE2 = 2;

const shell = vi.hoisted(() => ({
  snapshot: { status: 'loading' } as unknown,
  hosted: null as unknown,
  view: { kind: 'loading' } as unknown,
}));

/** A style as React Native would apply it: arrays flattened, falsy entries skipped. */
function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return style && typeof style === 'object' ? { ...style } : {};
}

vi.mock('react-native', () => ({
  View: ({ style, children }: { readonly style?: unknown; readonly children?: ReactNode }) => {
    const { paddingTop } = flatten(style);
    return createElement(
      'div',
      paddingTop === undefined ? null : { 'data-top': paddingTop },
      children,
    );
  },
  StyleSheet: { create: <T>(styles: T) => styles, hairlineWidth: 1 },
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { readonly children: ReactNode }) =>
    createElement('main', null, children),
  useSafeAreaInsets: () => INSETS,
}));
vi.mock('lucide-react-native/icons/shield-alert', () => ({ default: () => null }));
vi.mock('expo-router', () => ({ Stack: () => 'screens', Redirect: () => 'redirect' }));
vi.mock('../../styles/theme', () => ({
  useTokens: () => ({
    colours: { warnInk: 'warnInk', background: 'background', border: 'border' },
    spacing: { space2: SPACE2, space5: 5 },
  }),
}));
vi.mock('../../ui', () => ({ Text: ({ children }: { readonly children: ReactNode }) => children }));
vi.mock('../GateStates', () => ({
  LaunchState: ({ view }: { readonly view: LaunchView }) => `state:${view.kind}`,
  GateLoading: () => 'gate-loading',
}));
vi.mock('../../consent/ConsentSheet', () => ({ ConsentSheet: () => 'consent-sheet' }));
vi.mock('../../consent/use-consent', () => ({ useConsentRecord: () => null }));
vi.mock('../../session/use-session-refresh', () => ({ useSessionRefresh: () => undefined }));
vi.mock('../use-launch', () => ({
  useLaunch: () => ({ view: shell.view, client: {}, retry: () => undefined }),
}));
vi.mock('../use-sign-out', () => ({ useSignOutOnExpiry: () => undefined }));
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
vi.mock('../../connect/use-current-server', () => ({ useCurrentServer: () => shell.snapshot }));
vi.mock('../../connect/current-server', async (original) => ({
  ...(await original<typeof import('../../connect/current-server')>()),
  hostedServer: () => shell.hosted,
}));

const { default: SignedInLayout } = await import('../../../app/(app)/_layout');
const { ownServerOf } = await import('../../connect/current-server');

// vitest compiles the .tsx with the classic JSX runtime (tsconfig's jsx: react-native), which reads
// a global React; Metro's preset does not need one
vi.stubGlobal('React', React);

// react-dom ships no types here (@types/react-dom is not a dependency): typed at the one call used
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  readonly renderToStaticMarkup: (element: ReactElement) => string;
};

const WRITER = WORKSPACE_ROLES.find((role) => roleCan(role, 'chat'));
const READER = WORKSPACE_ROLES.find((role) => !roleCan(role, 'chat'));
const HTTP_OWN = ownServerOf(RECORD);
const HTTPS_OWN = ownServerOf(OTHER_RECORD);
const LINE = 'Unencrypted home network · 192.168.1.20:8000';
/** The bar: the top safe area plus its own padding, the icon's box, then the line in words. */
const BAR = `<div data-top="${INSETS.top + SPACE2}"><div></div>${LINE}</div>`;

function ready(role: string | undefined, aiProviders: unknown): LaunchView {
  const workspace = WorkspaceSchema.parse({
    id: RECORD.workspaceId,
    name: 'Home',
    role,
    ai_providers: aiProviders,
  });
  return { kind: 'ready', discovery: hostedDefaults(SERVER), workspace };
}

/** Every state Launch shows, and the marker each one renders under the bar. */
const OUTCOMES: readonly (readonly [string, LaunchView])[] = [
  ['state:loading', { kind: 'loading' }],
  ['state:error', { kind: 'error', step: 'discovery', error: new Error('offline') }],
  ['state:unsupported', { kind: 'unsupported', message: 'Newer app', detail: 'Update' }],
  ['state:paused', { kind: 'paused', message: 'Paused' }],
  ['state:workspace_lost', { kind: 'workspace_lost', message: 'Gone' }],
  ['state:not_running', { kind: 'not_running', server: HTTP_OWN.server, step: 'discovery' }],
  ['consent-sheet', ready(WRITER, [{ id: 'openai', name: 'OpenAI' }])],
  ['screens', ready(READER, [{ id: 'openai', name: 'OpenAI' }])],
];

function renderShell(snapshot: CurrentServerSnapshot, view: LaunchView): string {
  shell.snapshot = snapshot;
  shell.view = view;
  return renderToStaticMarkup(createElement(SignedInLayout));
}

const own = (server: typeof HTTP_OWN): CurrentServerSnapshot => ({
  status: 'ready',
  own: server,
  ended: null,
});
const HOSTED: CurrentServerSnapshot = { status: 'ready', own: null, ended: null };

const count = (markup: string, text: string) => markup.split(text).length - 1;

beforeEach(() => {
  shell.hosted = SERVER;
});

describe('over an http own server, the line sits above every state the gate shows', () => {
  it.each(OUTCOMES)(
    '%s: once, in the top safe area, above its own safe-area provider',
    (marker, view) => {
      const markup = renderShell(own(HTTP_OWN), view);
      expect(markup).toBe(`<div>${BAR}<main>${marker}</main></div>`);
      expect(count(markup, 'Unencrypted home network')).toBe(1);
    },
  );

  it('the cause: the consent sheet and Not running, not only the screens', () => {
    for (const marker of ['consent-sheet', 'state:not_running']) {
      const [, view] = OUTCOMES.find(([shown]) => shown === marker) ?? [];
      expect(renderShell(own(HTTP_OWN), view as LaunchView)).toContain(BAR);
    }
  });
});

describe('no line where the connection is encrypted or the server is the built-in one', () => {
  it.each(OUTCOMES)('%s over an https own server: the same frame, no line', (marker, view) => {
    expect(renderShell(own(HTTPS_OWN), view)).toBe(`<div><main>${marker}</main></div>`);
  });

  it.each(OUTCOMES)('%s on the hosted server: no line', (marker, view) => {
    expect(renderShell(HOSTED, view)).toBe(`<div><main>${marker}</main></div>`);
  });

  it('none on the hosted server even where a build reaches it over http', () => {
    const insecureHosted: Server = { ...SERVER, apiUrl: 'http://192.168.1.5:8000' };
    shell.hosted = insecureHosted;
    for (const [marker, view] of OUTCOMES) {
      expect(renderShell(HOSTED, view)).toBe(`<div><main>${marker}</main></div>`);
    }
  });
});
