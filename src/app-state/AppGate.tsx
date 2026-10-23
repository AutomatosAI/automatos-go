// The signed-in gate (PRD-001 §4.4, §4.5): app/(app)/_layout.tsx renders its screens through it.
// Thin wiring over gate.ts (the decision, tested): the current server and the session first
// (accessView: Welcome, Connect with the server and the reason, or signed in), then, under the
// persisted cache, discovery and the workspace bootstrap (useLaunch → launchView), then the
// AI-provider consent step (shellStep, US-007c: the layout's `consent` in place of the screens
// until this person agrees). Ready, the consent sheet and the screens get the session (session.tsx)
// and the one live connection (LiveEvents, FND-5); any other state is a whole screen
// (GateStates.tsx) with a way out. Every state shown to a signed-in phone sits under the layout's
// `bar` (the unencrypted home network line, D-HTTPS): the bar takes the top safe area and what is
// under it gets its own safe-area provider, so a screen's top inset starts below the bar and the
// bar never covers its header. Signed out, or sent back to Connect, the phone forgets the
// session's cached data and workspace id (session-cache.ts).

import { Redirect } from 'expo-router';
import { useEffect, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LiveEvents } from '../api/live';
import type { Server } from '../api/server';
import { useAuthSession, type AuthSession } from '../auth/AuthRoot';
import { hostedServer, ownServer } from '../connect/current-server';
import { ownServerInWords } from '../connect/edges';
import { useCurrentServer } from '../connect/use-current-server';
import { useConsentRecord } from '../consent/use-consent';
import { logger } from '../lib/logger';
import { connectWith, routes } from '../navigation/routes';
import { serverLabel } from './account';
import { accessView, shellStep } from './gate';
import { GateLoading, LaunchState } from './GateStates';
import { appPersister, appQueryClient, PersistedCache } from './query-root';
import { AppSessionProvider } from './session';
import { forgetSession } from './session-cache';
import { useLaunch } from './use-launch';
import { useSignOutOnExpiry } from './use-sign-out';

type LaunchProps = {
  readonly server: Server;
  /** The server in words (an own server's name and address, edges.ts). */
  readonly serverName: string;
  readonly session: AuthSession;
  /** The consent step's screen (the AI-provider consent sheet), shown in place of `children`. */
  readonly consent: ReactNode;
  /** Drawn above every state Launch shows, for this server. */
  readonly bar: ComponentType<{ readonly server: Server }>;
  readonly children: ReactNode;
};

function Launch({ server, serverName, session, consent, bar: Bar, children }: LaunchProps) {
  const { view, client, retry } = useLaunch(server, session.clientAuth);
  const record = useConsentRecord(server.apiUrl, view.kind === 'ready' ? view.workspace.id : null);
  useSignOutOnExpiry(session.provider);
  const step = shellStep(view, record);
  return (
    <View style={styles.fill}>
      <Bar server={server} />
      <SafeAreaProvider style={styles.fill}>
        {step.kind === 'launch' ? (
          <LaunchState view={step.view} serverName={serverName} onRetry={retry} />
        ) : (
          <AppSessionProvider
            server={server}
            discovery={step.ready.discovery}
            workspace={step.ready.workspace}
            client={client}
          >
            <LiveEvents />
            {step.kind === 'consent' ? consent : children}
          </AppSessionProvider>
        )}
      </SafeAreaProvider>
    </View>
  );
}

/** Whatever ended the session (Sign out, a 401, another device), the next person starts clean. */
function useForgetWhenSignedOut(signedOut: boolean): void {
  useEffect(() => {
    if (!signedOut) return;
    forgetSession(appQueryClient, appPersister()).catch((error: unknown) => {
      // the saved copy is still bound to its owner (cacheBuster), so no one else can restore it
      logger.warn('[session] could not clear the cache after sign-out', error);
    });
  }, [signedOut]);
}

export type AppGateProps = {
  /** What the consent step shows (app/(app)/_layout.tsx: the AI-provider consent sheet). */
  readonly consent: ReactNode;
  /** What sits above every state shown to a signed-in phone (the layout: the http line). */
  readonly bar: ComponentType<{ readonly server: Server }>;
  readonly children: ReactNode;
};

export function AppGate({ consent, bar, children }: AppGateProps) {
  const session = useAuthSession();
  const current = useCurrentServer();
  const own = ownServer(current);
  const access = accessView({
    own,
    ended: current.status === 'ready' ? current.ended : null,
    hosted: hostedServer(),
    isLoaded: session.isLoaded,
    isSignedIn: session.isSignedIn,
    ownerId: session.ownerId,
  });
  useForgetWhenSignedOut(access.kind === 'welcome' || access.kind === 'connect');

  if (access.kind === 'loading') return <GateLoading />;
  if (access.kind === 'welcome') return <Redirect href={routes.welcome} />;
  if (access.kind === 'connect') return <Redirect href={connectWith({ origin: access.origin })} />;
  return (
    <PersistedCache ownerId={access.ownerId}>
      <Launch
        server={access.server}
        serverName={own ? ownServerInWords(own) : serverLabel(access.server)}
        session={session}
        consent={consent}
        bar={bar}
      >
        {children}
      </Launch>
    </PersistedCache>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
