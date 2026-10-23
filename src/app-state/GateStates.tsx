// The gate's whole-screen states (AppGate.tsx; the decisions are gate.ts): loading, an error with
// Retry, a server this app can't use, a paused workspace and an own server that does not answer.
// Every one a signed-in person can be stuck on offers the way out: Sign out on the hosted server,
// Forget this server on an own one (use-sign-out.ts).

import type { LucideIcon } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import CirclePause from 'lucide-react-native/icons/circle-pause';
import ServerOff from 'lucide-react-native/icons/server-off';

import { useTokens } from '../styles/theme';
import { Button, EmptyState, ErrorState, LoadingState, Screen, UI_COPY } from '../ui';
import type { LaunchStep, LaunchView } from './gate';
import { SHELL_COPY } from './strings';
import { useSignOut } from './use-sign-out';

type GateMessageProps = {
  readonly title: string;
  readonly message?: string;
  readonly icon?: LucideIcon;
  readonly action?: { readonly label: string; readonly onPress: () => void };
  readonly children?: ReactNode;
};

export function GateMessage({ title, message, icon, action, children }: GateMessageProps) {
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
function LeaveButton() {
  const { signOut, busy, label } = useSignOut();
  return <Button label={label} onPress={signOut} busy={busy} variant="ghost" />;
}

export function GateLoading({ label }: { readonly label?: string }) {
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
  /** The server in words, for the not-running state. */
  readonly serverName: string;
  readonly onRetry: (step: LaunchStep) => void;
};

type StuckProps<K extends LaunchView['kind']> = Omit<LaunchStateProps, 'view'> & {
  readonly view: Extract<LaunchView, { readonly kind: K }>;
};

function NotRunningState({ view, serverName, onRetry }: StuckProps<'not_running'>) {
  return (
    <GateMessage
      title={SHELL_COPY.notRunningTitle(serverName)}
      message={SHELL_COPY.notRunningMessage}
      icon={ServerOff}
      action={{ label: UI_COPY.retry, onPress: () => onRetry(view.step) }}
    >
      <LeaveButton />
    </GateMessage>
  );
}

function PausedState({ view, onRetry }: StuckProps<'paused'>) {
  return (
    <GateMessage
      title={SHELL_COPY.pausedTitle}
      message={view.message}
      icon={CirclePause}
      action={{ label: UI_COPY.retry, onPress: () => onRetry('workspace') }}
    >
      <LeaveButton />
    </GateMessage>
  );
}

function StepErrorState({ view, onRetry }: StuckProps<'error'>) {
  const { spacing } = useTokens();
  const title =
    view.step === 'discovery' ? SHELL_COPY.discoveryErrorTitle : SHELL_COPY.workspaceErrorTitle;
  return (
    <Screen scroll>
      <View style={[styles.centre, { gap: spacing.space3 }]}>
        <ErrorState error={view.error} title={title} onRetry={() => onRetry(view.step)} />
        <LeaveButton />
      </View>
    </Screen>
  );
}

export function LaunchState({ view, serverName, onRetry }: LaunchStateProps) {
  switch (view.kind) {
    case 'loading':
      return <GateLoading label={SHELL_COPY.connecting} />;
    case 'unsupported':
      return (
        <GateMessage title={view.message} message={view.detail}>
          <LeaveButton />
        </GateMessage>
      );
    case 'paused':
      return <PausedState view={view} serverName={serverName} onRetry={onRetry} />;
    case 'not_running':
      return <NotRunningState view={view} serverName={serverName} onRetry={onRetry} />;
    default:
      return <StepErrorState view={view} serverName={serverName} onRetry={onRetry} />;
  }
}

const styles = StyleSheet.create({
  centre: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
});
