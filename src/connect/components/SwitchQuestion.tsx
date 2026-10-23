// The switch question (US-006g, KC8): 'You're connected to {current}. Connect to {new} instead?',
// asked before another server replaces the one this phone uses, by a pairing link (/go/pair) and by
// Connect itself when it opens with another server's address. Only Connect instead moves on, and
// only as far as Connect, which stops at the confirm card; Stay connected changes nothing. The words
// are scan-state.ts's (connectSwitchQuestion, pairLinkIntake).

import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Screen, Text } from '../../ui';
import type { SwitchQuestionView } from '../scanner/scan-state';

const TITLE_LEVEL = 2;
const MESSAGE_LEVEL = 1;
const NOTE_LEVEL = 3;
const ICON_SIZE = 24;

export type SwitchQuestionProps = {
  readonly question: SwitchQuestionView;
  readonly onConnect: () => void;
  readonly onStay: () => void;
};

export function SwitchQuestion({ question, onConnect, onStay }: SwitchQuestionProps) {
  const { colours, spacing } = useTokens();
  return (
    <Screen scroll padding="space9">
      <View style={[styles.content, { gap: spacing.space9 }]}>
        <View style={{ gap: spacing.space5 }}>
          <View importantForAccessibility="no-hide-descendants">
            <ArrowLeftRight size={ICON_SIZE} color={colours.mutedForeground} />
          </View>
          <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
            {question.title}
          </Text>
          <Text level={MESSAGE_LEVEL}>{question.message}</Text>
          <Text level={NOTE_LEVEL} tone="muted">
            {question.note}
          </Text>
        </View>
        <View style={{ gap: spacing.space5 }}>
          <Button label={question.connectLabel} onPress={onConnect} fullWidth />
          <Button label={question.stayLabel} onPress={onStay} variant="outline" fullWidth />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
});
