// The provider tree for the current server (US-006d; lead 20 Oct: the privacy policy says a
// self-hosted phone never contacts Clerk). AuthRoot is rendered with react-dom's server renderer
// over mocked native modules: for an own server no ClerkProvider mounts and no Clerk hook runs, so
// nothing can ask Clerk's Frontend API anything; the hosted case proves the mocks see both.

import { createRequire } from 'node:module';
import * as React from 'react';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CurrentServerSnapshot } from '../../connect/current-server';
import { RECORD } from '../../connect/__tests__/paired-record';

const clerk = vi.hoisted(() => ({ providers: 0, hooks: 0 }));
const shell = vi.hoisted(() => ({
  snapshot: { status: 'loading' } as unknown,
  segments: [] as string[],
  env: { clerkPublishableKey: '', apiUrl: '', webUrl: '', sentryDsn: '' },
}));

vi.mock('@clerk/expo', () => ({
  ClerkProvider: ({ children }: { readonly children: ReactNode }) => {
    clerk.providers += 1;
    return children;
  },
  useAuth: () => {
    clerk.hooks += 1;
    return {
      getToken: async () => null,
      signOut: async () => undefined,
      isLoaded: true,
      isSignedIn: false,
      userId: null,
    };
  },
}));
vi.mock('@clerk/expo-passkeys', () => ({ passkeys: {} }));
vi.mock('expo-router', () => ({ useSegments: () => shell.segments }));
vi.mock('lucide-react-native/icons/key-round', () => ({ default: () => null }));
vi.mock('lucide-react-native/icons/lock-keyhole', () => ({ default: () => null }));
vi.mock('../../ui', () => ({
  Screen: ({ children }: { readonly children: ReactNode }) => children,
  EmptyState: ({ title, action }: { title: string; action?: { label: string } }) =>
    action ? `${title}|${action.label}` : title,
}));
vi.mock('../../lib/env', async (original) => ({
  ...(await original<typeof import('../../lib/env')>()),
  env: shell.env,
}));
vi.mock('../../lib/secure-store', () => ({ secureKeys: { wipe: async () => undefined } }));
vi.mock('../../connect/device-store', () => ({
  deviceStore: {
    load: async () => RECORD,
    save: async () => undefined,
    clear: async () => undefined,
  },
}));
vi.mock('../../connect/use-current-server', () => ({ useCurrentServer: () => shell.snapshot }));

const { AuthRoot, useAuthSession } = await import('../AuthRoot');
const { ownServerOf } = await import('../../connect/current-server');
const { AUTH_COPY } = await import('../strings');
const { SESSION_COPY } = await import('../../session/strings');

// vitest compiles the .tsx with the classic JSX runtime (tsconfig's jsx: react-native), which reads
// a global React; Metro's preset does not need one
vi.stubGlobal('React', React);

// react-dom ships no types here (@types/react-dom is not a dependency): typed at the one call used
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  readonly renderToStaticMarkup: (element: ReactElement) => string;
};

const HOSTED_ENV = { apiUrl: 'https://api.example.test', clerkPublishableKey: 'pk_test_abc' };

/** What the screens under the root see of the session. */
function SessionProbe() {
  const { provider, isLoaded, isSignedIn, ownerId } = useAuthSession();
  return `${provider.kind}|loaded=${isLoaded}|signedIn=${isSignedIn}|owner=${ownerId ?? ''}`;
}

/** The rendered text, with the renderer's HTML escapes read back. */
function renderTree(snapshot: CurrentServerSnapshot): string {
  shell.snapshot = snapshot;
  const markup = renderToStaticMarkup(createElement(AuthRoot, null, createElement(SessionProbe)));
  return markup.replaceAll('&#x27;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');
}

const OWN: CurrentServerSnapshot = { status: 'ready', own: ownServerOf(RECORD), ended: null };
const HOSTED: CurrentServerSnapshot = { status: 'ready', own: null, ended: null };

beforeEach(() => {
  clerk.providers = 0;
  clerk.hooks = 0;
  shell.segments = [];
  Object.assign(shell.env, { apiUrl: '', clerkPublishableKey: '' });
});

describe('AuthRoot for an own server (source own)', () => {
  it('mounts the device session and no ClerkProvider, and calls no Clerk hook', () => {
    Object.assign(shell.env, HOSTED_ENV); // even in a build that can sign in to the hosted server
    const markup = renderTree(OWN);
    expect(markup).toBe(`device|loaded=true|signedIn=true|owner=${RECORD.deviceId}`);
    expect(clerk.providers).toBe(0);
    expect(clerk.hooks).toBe(0);
  });

  it('never hands the token to the screens: only the provider reads it', () => {
    expect(renderTree(OWN)).not.toContain(RECORD.token);
  });
});

describe('AuthRoot for the built-in hosted server', () => {
  it('mounts ClerkProvider and its session when the build can sign in (the mocks see Clerk)', () => {
    Object.assign(shell.env, HOSTED_ENV);
    expect(renderTree(HOSTED)).toBe('clerk|loaded=true|signedIn=false|owner=');
    expect(clerk.providers).toBe(1);
    expect(clerk.hooks).toBe(1);
  });

  it('without a Clerk key, signs no one in and still opens Welcome and Connect (KC2)', () => {
    Object.assign(shell.env, { apiUrl: HOSTED_ENV.apiUrl });
    expect(renderTree(HOSTED)).toBe('clerk|loaded=true|signedIn=false|owner=');
    expect(clerk.providers + clerk.hooks).toBe(0);
  });

  it("without a Clerk key, blocks the hosted sign-in screens only, in the foundation's words", () => {
    shell.segments = ['(auth)', 'sign-in'];
    const markup = renderTree(HOSTED);
    expect(markup).toBe(AUTH_COPY.notConfiguredTitle);
    expect(clerk.providers + clerk.hooks).toBe(0);
  });
});

describe('AuthRoot before the keychain has said which server', () => {
  it('mounts nothing while it reads: guessing hosted would start Clerk on a paired phone', () => {
    Object.assign(shell.env, HOSTED_ENV);
    expect(renderTree({ status: 'loading' })).toBe('');
    expect(clerk.providers + clerk.hooks).toBe(0);
  });

  it('offers a retry when the keychain refuses, still without Clerk', () => {
    Object.assign(shell.env, HOSTED_ENV);
    expect(renderTree({ status: 'unreadable' })).toBe(
      `${SESSION_COPY.unreadableTitle}|${SESSION_COPY.retry}`,
    );
    expect(clerk.providers + clerk.hooks).toBe(0);
  });
});
