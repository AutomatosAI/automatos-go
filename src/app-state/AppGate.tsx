// The signed-in gate (PRD-001 §4.4, §4.5): app/(app)/_layout.tsx renders its screens through it.
// Thin wiring over gate.ts (the decision, tested): the current server and the session first
// (accessView: Welcome, Connect with the server and the reason, or signed in), then, under the
// persisted cache, discovery and the workspace bootstrap (useLaunch → launchView), then the
// AI-provider consent step (shellStep, US-007c: the layout's `consent` in place of the screens
// until this person agrees). Ready, the consent sheet and the screens get the session (session.tsx)
// and the one live connection (LiveEvents, FND-5), mounted afresh for each workspace (keyed by its
// id, P001N-SEAM-2); any other state is a whole screen
// (GateStates.tsx) with a way out. Every state shown to a signed-in phone sits under the layout's
// `bar` (the unencrypted home network line, D-HTTPS): the bar takes the top safe area and what is
// under it gets its own safe-area provider, so a screen's top inset starts below the bar and the
// bar never covers its header. Signed out, or sent back to Connect, the phone forgets the
// session's cached data and workspace id (session-cache.ts). A hosted sign-in after an own server
// refused this phone drops the refusal (refusalLeftBehind), so it is told once. The layout's
// optional `edge` (US-016j, the edge-screen slot) draws the 'error' and 'not_running' states in
// the app's style, given the state, the server, Retry and the way out; LaunchState's without it.

import { Redirect } from 'expo-router';
import { useEffect, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LiveEvents } from '../api/live';
import type { Server } from '../api/server';
import { useAuthSession, type AuthSession } from '../auth/AuthRoot';
import { currentServers, hostedServer, ownServer } from '../connect/current-server';
import { ownServerInWords } from '../connect/edges';
import { useCurrentServer } from '../connect/use-current-server';
import { useConsentRecord } from '../consent/use-consent';
import { logger } from '../lib/logger';
import { connectWith, routes } from '../navigation/routes';
import { serverLabel } from './account';
import { accessView, refusalLeftBehind, shellStep, type LaunchStep, type LaunchView } from './gate';
import { GateLoading, LaunchState } from './GateStates';
import { appPersister, appQueryClient, PersistedCache } from './query-root';
import { AppSessionProvider } from './session';
import { forgetSession } from './session-cache';
import { useLaunch } from './use-launch';
import { useSignOut, useSignOutOnExpiry, type SignOut } from './use-sign-out';

/** The gate's states the layout's `edge` draws: an error, or an own server that does not answer. */
export type GateEdgeView = Extract<LaunchView, { readonly kind: 'error' | 'not_running' }>;

export type GateLeaveProps = {
  /** Draws the way out from the gate's sign-out action. */
  readonly children: (signOut: SignOut) => ReactNode;
};

export type GateEdgeProps = {
  readonly view: GateEdgeView;
  /** The server the gate launched against. */
  readonly server: Server;
  /** The server in words (an own server's name and address), as the gate's own states name it. */
  readonly serverName: string;
  /** The gate's Retry: the step that failed, again. */
  readonly onRetry: () => void;
  /**
   * The gate's way out (use-sign-out.ts), handed to the function it is given: Sign out on the
   * hosted server, Forget this server on an own one, which the gate's own screens ask first
   * (src/connect/components/ForgetServer.tsx).
   */
  readonly leave: ComponentType<GateLeaveProps>;
  /** What the gate shows without an `edge` (LaunchState), for a state the edge does not take. */
  readonly fallback: ReactNode;
};

type LaunchProps = {
  readonly server: Server;
  /** The server in words (an own server's name and address, edges.ts). */
  readonly serverName: string;
  readonly session: AuthSession;
  /** The consent step's screen (the AI-provider consent sheet), shown in place of `children`. */
  readonly consent: ReactNode;
  /** Drawn above every state Launch shows, for this server. */
  readonly bar: ComponentType<{ readonly server: Server }>;
  /** Draws the 'error' and 'not_running' states (AppGateProps.edge). */
  readonly edge?: ComponentType<GateEdgeProps>;
  readonly children: ReactNode;
};

function Launch({ server, serverName, session, consent, bar: Bar, edge, children }: LaunchProps) {
  const { view, client, retry } = useLaunch(server, session.clientAuth);
  const record = useConsentRecord(server.apiUrl, view.kind === 'ready' ? view.workspace.id : null);
  useSignOutOnExpiry(session.provider);
  const step = shellStep(view, record);
  return (
    <View style={styles.fill}>
      <Bar server={server} />
      <SafeAreaProvider style={styles.fill}>
        {step.kind === 'launch' ? (
          <GateState
            view={step.view}
            server={server}
            serverName={serverName}
            onRetry={retry}
            edge={edge}
          />
        ) : (
          // keyed by the workspace: when a bootstrap resolves another one (the server falls back
          // to the person's other workspace when X-Workspace-ID is no longer theirs), the consent
          // step and every screen mount afresh with forgetWorkspaceData's empty cache, so none
          // keeps the old workspace's local state (a chat id, its messages and cards) in the new one
          <AppSessionProvider
            key={step.ready.workspace.id}
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

/** The gate's way out (use-sign-out.ts), read only where the edge draws it. */
function GateLeave({ children }: GateLeaveProps) {
  return <>{children(useSignOut())}</>;
}

function isEdgeView(view: LaunchView): view is GateEdgeView {
  return view.kind === 'error' || view.kind === 'not_running';
}

type GateStateProps = {
  readonly view: Exclude<LaunchView, { readonly kind: 'ready' }>;
  readonly server: Server;
  readonly serverName: string;
  readonly onRetry: (step: LaunchStep) => void;
  readonly edge?: ComponentType<GateEdgeProps>;
};

/** A whole-screen state: LaunchState's, or the edge's (when set) for an error or Not running. */
function GateState({ view, server, serverName, onRetry, edge: Edge }: GateStateProps) {
  const fallback = <LaunchState view={view} serverName={serverName} onRetry={onRetry} />;
  if (Edge === undefined || !isEdgeView(view)) return fallback;
  return (
    <Edge
      view={view}
      server={server}
      serverName={serverName}
      onRetry={() => onRetry(view.step)}
      leave={GateLeave}
      fallback={fallback}
    />
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

/** Signed in to the hosted server since the refusal: it has been told, so it goes. */
function useDismissEndedOnceLeftBehind(leftBehind: boolean): void {
  useEffect(() => {
    if (leftBehind) currentServers.dismissEnded();
  }, [leftBehind]);
}

export type AppGateProps = {
  /** What the consent step shows (app/(app)/_layout.tsx: the AI-provider consent sheet). */
  readonly consent: ReactNode;
  /** What sits above every state shown to a signed-in phone (the layout: the http line). */
  readonly bar: ComponentType<{ readonly server: Server }>;
  /**
   * Draws the 'error' and 'not_running' states (the layout: the style's edge screens, US-016j);
   * LaunchState's own screens when omitted.
   */
  readonly edge?: ComponentType<GateEdgeProps>;
  readonly children: ReactNode;
};

export function AppGate({ consent, bar, edge, children }: AppGateProps) {
  const session = useAuthSession();
  const current = useCurrentServer();
  const own = ownServer(current);
  const ended = current.status === 'ready' ? current.ended : null;
  const access = accessView({
    own,
    ended,
    hosted: hostedServer(),
    isLoaded: session.isLoaded,
    isSignedIn: session.isSignedIn,
    ownerId: session.ownerId,
  });
  useForgetWhenSignedOut(access.kind === 'welcome' || access.kind === 'connect');
  useDismissEndedOnceLeftBehind(refusalLeftBehind(access, ended));

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
        edge={edge}
      >
        {children}
      </Launch>
    </PersistedCache>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
