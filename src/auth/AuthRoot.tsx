// The sign-in root (PRD-001 §4.5, D-AUTH-PROVIDER): the provider tree for the current server
// (src/connect/current-server.ts, KC4), chosen by src/session/auth-branch.ts. An own server gets
// the paired phone's session (providers/device.ts, bound with bindDeviceProvider so a refusal
// reaches the current server with its reason) and NO ClerkProvider: no Clerk hook runs and nothing
// is asked of Clerk's Frontend API (lead 20 Oct). The built-in hosted server gets ClerkProvider with
// the build's publishable key (EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY only, never the discovery
// document's), the keychain token cache (token-cache.ts) and the native passkeys @clerk/expo-passkeys
// provides, with Clerk's SDK telemetry off (telemetry={false}: on a development key Clerk would
// send SDK usage events to clerk-telemetry.com, R11). A build that cannot sign in to its hosted
// server shows its honest not-configured state on the hosted sign-in only (KC2); Welcome and
// Connect still work. The shell reads the session
// through useAuthSession(). A new server or a new pairing remounts the tree under it, so nothing
// mounted for one server stays for the next. Logic lives in the .ts files beside it, tested.

import { ClerkProvider, useAuth } from '@clerk/expo';
import { passkeys } from '@clerk/expo-passkeys';
import { useSegments } from 'expo-router';
import KeyRound from 'lucide-react-native/icons/key-round';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { currentServers, type OwnServer } from '../connect/current-server';
import { deviceStore } from '../connect/device-store';
import { useCurrentServer } from '../connect/use-current-server';
import { env } from '../lib/env';
import { secureKeys } from '../lib/secure-store';
import { authBranch, hostedSignInConfigured } from '../session/auth-branch';
import { SESSION_COPY } from '../session/strings';
import { EmptyState, Screen } from '../ui';
import { bindProvider, type ClientAuth } from './providers/binding';
import { createClerkProvider, type ClerkSessionPort } from './providers/clerk';
import { bindDeviceProvider } from './providers/device';
import type { AuthProvider } from './providers/types';
import { AUTH_COPY } from './strings';
import { createTokenCache } from './token-cache';

const tokenCache = createTokenCache(secureKeys);

/** The route group of the hosted sign-in screens (app/(auth)). */
const HOSTED_SIGN_IN_GROUP = '(auth)';

export type AuthSession = {
  /** false until the provider has read what it holds (the shell shows loading meanwhile). */
  readonly isLoaded: boolean;
  readonly isSignedIn: boolean;
  /** Whose session it is (Clerk's user id, or the paired device's id): the persisted cache's owner. */
  readonly ownerId: string | null;
  readonly provider: AuthProvider;
  /** Spread into createApiClient's options: the bearer and the 401 → onExpired binding. */
  readonly clientAuth: ClientAuth;
};

const AuthSessionContext = createContext<AuthSession | null>(null);

/** The active sign-in session; only under AuthRoot. */
export function useAuthSession(): AuthSession {
  const session = useContext(AuthSessionContext);
  if (!session) throw new Error('useAuthSession must be used within AuthRoot');
  return session;
}

/**
 * useAuth hands out a new getToken every render, so the provider (and the listeners on its expiry
 * signal) is built once over a ref that always holds the latest calls.
 */
function ClerkSession({ children }: { readonly children: ReactNode }) {
  const { getToken, signOut, isLoaded, isSignedIn, userId } = useAuth();
  const latest = useRef<ClerkSessionPort>({ getToken, signOut: () => signOut() });
  useEffect(() => {
    latest.current = { getToken, signOut: () => signOut() };
  }, [getToken, signOut]);

  const binding = useMemo(
    () =>
      bindProvider((expiry) =>
        createClerkProvider(
          {
            getToken: (options) => latest.current.getToken(options),
            signOut: () => latest.current.signOut(),
          },
          { expiry, secureKeys },
        ),
      ),
    [],
  );
  const session = useMemo<AuthSession>(
    () => ({ isLoaded, isSignedIn: isSignedIn === true, ownerId: userId ?? null, ...binding }),
    [isLoaded, isSignedIn, userId, binding],
  );
  return <AuthSessionContext.Provider value={session}>{children}</AuthSessionContext.Provider>;
}

function HostedSession({ children }: { readonly children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={env.clerkPublishableKey}
      tokenCache={tokenCache}
      __experimental_passkeys={passkeys}
      telemetry={false}
    >
      <ClerkSession>{children}</ClerkSession>
    </ClerkProvider>
  );
}

/** A paired phone's session, one per pairing (the caller keys it): the provider serves that one. */
function DeviceSession({
  own,
  children,
}: {
  readonly own: OwnServer;
  readonly children: ReactNode;
}) {
  const [binding] = useState(() =>
    bindDeviceProvider({ store: deviceStore, onRefused: currentServers.refused }),
  );
  const session = useMemo<AuthSession>(
    () => ({ isLoaded: true, isSignedIn: true, ownerId: own.deviceId, ...binding }),
    [own.deviceId, binding],
  );
  return <AuthSessionContext.Provider value={session}>{children}</AuthSessionContext.Provider>;
}

/** No hosted sign-in in this build: signed out, holding nothing. */
const NO_HOSTED_SIGN_IN: AuthProvider = Object.freeze({
  kind: 'clerk' as const,
  getToken: async () => null,
  signOut: async () => undefined,
  onExpired: () => () => undefined,
});

const SIGNED_OUT: AuthSession = Object.freeze({
  isLoaded: true,
  isSignedIn: false,
  ownerId: null,
  provider: NO_HOSTED_SIGN_IN,
  clientAuth: Object.freeze({ getToken: async () => null, onAuthExpired: () => undefined }),
});

function SignInNotConfigured() {
  return (
    <Screen scroll>
      <EmptyState
        icon={KeyRound}
        title={AUTH_COPY.notConfiguredTitle}
        message={AUTH_COPY.notConfiguredMessage}
      />
    </Screen>
  );
}

/** The not-configured state blocks the hosted sign-in screens only (KC2). */
function HostedSignInOff({ children }: { readonly children: ReactNode }) {
  const onHostedSignIn = useSegments()[0] === HOSTED_SIGN_IN_GROUP;
  return (
    <AuthSessionContext.Provider value={SIGNED_OUT}>
      {onHostedSignIn ? <SignInNotConfigured /> : children}
    </AuthSessionContext.Provider>
  );
}

function ServerUnreadable() {
  const retry = { label: SESSION_COPY.retry, onPress: () => void currentServers.load(deviceStore) };
  return (
    <Screen scroll>
      <EmptyState
        icon={LockKeyhole}
        title={SESSION_COPY.unreadableTitle}
        message={SESSION_COPY.unreadableMessage}
        action={retry}
      />
    </Screen>
  );
}

export function AuthRoot({ children }: { readonly children: ReactNode }) {
  const snapshot = useCurrentServer();
  useEffect(() => {
    void currentServers.load(deviceStore);
  }, []);
  const branch = authBranch(snapshot, hostedSignInConfigured(env));
  switch (branch.kind) {
    case 'own':
      return (
        <DeviceSession key={branch.own.pairing} own={branch.own}>
          {children}
        </DeviceSession>
      );
    case 'hosted':
      return <HostedSession>{children}</HostedSession>;
    case 'hosted_off':
      return <HostedSignInOff>{children}</HostedSignInOff>;
    case 'unreadable':
      return <ServerUnreadable />;
    default:
      // the keychain is being read: a few calls, as the reinstall check before it
      return null;
  }
}
