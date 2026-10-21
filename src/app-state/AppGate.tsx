// The signed-in gate (PRD-001 §4.4, §4.5): app/(app)/_layout.tsx renders its screens through it.
// Thin wiring over gate.ts (the decision, tested): the build and the session first (accessView),
// then, under the persisted cache, discovery and the workspace bootstrap (useLaunch → launchView).
// Ready, the screens get the session (session.tsx); any other state is a whole screen, and every
// one a signed-in person can be stuck on offers Sign out. Signed out, the phone forgets the
// session's cached data (session-cache.ts) and goes to sign-in.

import type { LucideIcon } from 'lucide-react-native';
import { Redirect } from 'expo-router';
import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import CirclePause from 'lucide-react-native/icons/circle-pause';
import ServerOff from 'lucide-react-native/icons/server-off';

import { currentServer, type Server } from '../api/server';
import { useAuthSession, type AuthSession } from '../auth/AuthRoot';
import { logger } from '../lib/logger';
import { routes } from '../navigation/routes';
import { useTokens } from '../styles/theme';
import { Button, EmptyState, ErrorState, LoadingState, Screen, UI_COPY } from '../ui';
import { accessView, type LaunchStep, type LaunchView } from './gate';
import { appPersister, appQueryClient, PersistedCache } from './query-root';
import { AppSessionProvider } from './session';
import { forgetSession } from './session-cache';
import { SHELL_COPY } from './strings';
import { useLaunch } from './use-launch';
import { useSignOut, useSignOutOnExpiry } from './use-sign-out';

type GateMessageProps = {
  readonly title: string;
  readonly message?: string;
  readonly icon?: LucideIcon;
  readonly action?: { readonly label: string; readonly onPress: () => void };
  readonly children?: ReactNode;
};

function GateMessage({ title, message, icon, action, children }: GateMessageProps) {
  const { spacing } = useTokens();
  return (
    <Screen scroll>
      <View style={[styles.centre, { gap: spacing.space3 }]}>
        <EmptyState title={title} message={message} icon={icon} action={action} />
        {children}
      </View>
    </Screen>
  );
}

/** Signed in but stuck (an old app, a paused workspace, a server that refuses): a way out. */
function SignOutButton() {
  const { signOut, busy } = useSignOut();
  return <Button label={SHELL_COPY.signOut} onPress={signOut} busy={busy} variant="ghost" />;
}

function GateLoading({ label }: { readonly label?: string }) {
  return (
    <Screen>
      <View style={styles.centre}>
        <LoadingState label={label} />
      </View>
    </Screen>
  );
}

type LaunchStateProps = {
  readonly view: Exclude<LaunchView, { readonly kind: 'ready' }>;
  readonly onRetry: (step: LaunchStep) => void;
};

function LaunchState({ view, onRetry }: LaunchStateProps) {
  const { spacing } = useTokens();
  if (view.kind === 'loading') return <GateLoading label={SHELL_COPY.connecting} />;
  if (view.kind === 'unsupported') {
    return (
      <GateMessage title={view.message} message={SHELL_COPY.unsupportedMessage}>
        <SignOutButton />
      </GateMessage>
    );
  }
  if (view.kind === 'paused') {
    const action = { label: UI_COPY.retry, onPress: () => onRetry('workspace') };
    return (
      <GateMessage
        title={SHELL_COPY.pausedTitle}
        message={view.message}
        icon={CirclePause}
        action={action}
      >
        <SignOutButton />
      </GateMessage>
    );
  }
  const title =
    view.step === 'discovery' ? SHELL_COPY.discoveryErrorTitle : SHELL_COPY.workspaceErrorTitle;
  return (
    <Screen scroll>
      <View style={[styles.centre, { gap: spacing.space3 }]}>
        <ErrorState error={view.error} title={title} onRetry={() => onRetry(view.step)} />
        <SignOutButton />
      </View>
    </Screen>
  );
}

type LaunchProps = {
  readonly server: Server;
  readonly session: AuthSession;
  readonly children: ReactNode;
};

function Launch({ server, session, children }: LaunchProps) {
  const { view, client, retry } = useLaunch(server, session.clientAuth);
  useSignOutOnExpiry(session.provider);
  if (view.kind !== 'ready') return <LaunchState view={view} onRetry={retry} />;
  return (
    <AppSessionProvider
      server={server}
      discovery={view.discovery}
      workspace={view.workspace}
      client={client}
    >
      {children}
    </AppSessionProvider>
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

export function AppGate({ children }: { readonly children: ReactNode }) {
  const session = useAuthSession();
  const server = useMemo(currentServer, []);
  const access = accessView({
    server,
    isLoaded: session.isLoaded,
    isSignedIn: session.isSignedIn,
    ownerId: session.ownerId,
  });
  useForgetWhenSignedOut(access.kind === 'signed_out');

  if (access.kind === 'not_configured') {
    return (
      <GateMessage
        title={SHELL_COPY.notConfiguredTitle}
        message={SHELL_COPY.notConfiguredMessage}
        icon={ServerOff}
      />
    );
  }
  if (access.kind === 'loading') return <GateLoading />;
  if (access.kind === 'signed_out') return <Redirect href={routes.signIn} />;
  return (
    <PersistedCache ownerId={access.ownerId}>
      <Launch server={access.server} session={session}>
        {children}
      </Launch>
    </PersistedCache>
  );
}

const styles = StyleSheet.create({
  centre: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
});
