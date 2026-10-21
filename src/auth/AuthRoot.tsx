// The sign-in root (PRD-001 §4.5, D-AUTH-PROVIDER): ClerkProvider with the build's publishable key
// (EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY only, never the discovery document's), the keychain token cache
// (token-cache.ts) and the native passkeys @clerk/expo-passkeys provides. Under it, the Clerk
// provider is built once and bound to the API client options (providers/binding.ts); the shell reads
// both through useAuthSession(). A build made without a key shows an honest state instead of
// crashing (the academy's UNCONFIGURED pattern). Logic lives in the .ts files beside it, tested.

import { ClerkProvider, useAuth } from '@clerk/expo';
import { passkeys } from '@clerk/expo-passkeys';
import KeyRound from 'lucide-react-native/icons/key-round';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { env } from '../lib/env';
import { secureKeys } from '../lib/secure-store';
import { EmptyState, Screen } from '../ui';
import { bindProvider, type ClientAuth } from './providers/binding';
import { createClerkProvider, type ClerkSessionPort } from './providers/clerk';
import type { AuthProvider } from './providers/types';
import { AUTH_COPY } from './strings';
import { createTokenCache } from './token-cache';

const tokenCache = createTokenCache(secureKeys);

export type AuthSession = {
  /** false until Clerk has read its stored client (the shell shows loading meanwhile). */
  readonly isLoaded: boolean;
  readonly isSignedIn: boolean;
  readonly provider: AuthProvider;
  /** Spread into createApiClient's options: the bearer and the 401 → onExpired binding. */
  readonly clientAuth: ClientAuth;
};

const AuthSessionContext = createContext<AuthSession | null>(null);

/** The active sign-in session; only under AuthRoot with a configured key. */
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
  const { getToken, signOut, isLoaded, isSignedIn } = useAuth();
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
    () => ({ isLoaded, isSignedIn: isSignedIn === true, ...binding }),
    [isLoaded, isSignedIn, binding],
  );
  return <AuthSessionContext.Provider value={session}>{children}</AuthSessionContext.Provider>;
}

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

export function AuthRoot({ children }: { readonly children: ReactNode }) {
  if (!env.clerkPublishableKey) return <SignInNotConfigured />;
  return (
    <ClerkProvider
      publishableKey={env.clerkPublishableKey}
      tokenCache={tokenCache}
      __experimental_passkeys={passkeys}
    >
      <ClerkSession>{children}</ClerkSession>
    </ClerkProvider>
  );
}
