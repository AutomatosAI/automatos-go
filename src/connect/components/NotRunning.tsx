// Not running (PRD-001 §4.7 Edges, US-006h): the gate's 'not_running', an own server that does not
// answer. It names the server, says it is not connected in words (not only a colour), and how a
// self-hosted install is started: on the server, docker compose up -d; then this phone on the same
// network, or the server published at a public HTTPS address. Retry tries the step again; Forget
// this server, asked first, is the way out. Ember's 07 Not running is its structure (status, title,
// the command in mono, Check again); the words are edges.ts notRunningView's.

import ServerOff from 'lucide-react-native/icons/server-off';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Card, Chip, Screen, Text, UI_COPY } from '../../ui';
import { notRunningView } from '../edges';
import { ForgetServer } from './ForgetServer';

const TITLE_LEVEL = 2;
const MESSAGE_LEVEL = 1;
const STEP_LEVEL = 2;
const COMMAND_LEVEL = 3;
const ICON_SIZE = 24;

export type NotRunningProps = {
  /** The server in words (edges.ts ownServerInWords). */
  readonly server: string;
  readonly onRetry: () => void;
};

export function NotRunning({ server, onRetry }: NotRunningProps) {
  const { colours, radii, spacing } = useTokens();
  const view = notRunningView(server);
  return (
    <Screen scroll padding="space9">
      <View style={[styles.content, { gap: spacing.space9 }]}>
        <View style={{ gap: spacing.space3 }}>
          <View importantForAccessibility="no-hide-descendants">
            <ServerOff size={ICON_SIZE} color={colours.mutedForeground} />
          </View>
          <Chip label={view.status} tone="muted" />
          <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
            {view.title}
          </Text>
          <Text level={MESSAGE_LEVEL} tone="muted">
            {view.message}
          </Text>
        </View>
        <Card padding="space6">
          <View style={{ gap: spacing.space3 }}>
            <Text variant="eyebrow">{view.startTitle}</Text>
            <Text level={STEP_LEVEL}>{view.startStep}</Text>
            <View
              accessible
              accessibilityLabel={view.commandLabel}
              style={{
                backgroundColor: colours.muted,
                borderRadius: radii.control,
                padding: spacing.space3,
              }}
            >
              <Text variant="mono" level={COMMAND_LEVEL} selectable>
                {view.command}
              </Text>
            </View>
            <Text level={STEP_LEVEL}>{view.reachStep}</Text>
          </View>
        </Card>
        <View style={{ gap: spacing.space3 }}>
          <Button label={UI_COPY.retry} onPress={onRetry} fullWidth />
          <ForgetServer question={view.forgetQuestion} variant="ghost" fullWidth />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
});
