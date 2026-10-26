// The line under the voice screen's state chip (US-019j): voiceLine's words (a viewer's, an error's,
// why hold to talk cannot start, the reducer's message) and its button — Open Settings, Download, or
// 'See it in the chat' on its own. Tokens only; the words are the type scale (nothing under 11 pt)
// and the button at least 44 pt. Announced as it appears (it follows a press or a turn).

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Text } from '../../ui';
import { MIN_TOUCH } from '../../ui/paint';
import type { VoiceLine as Line } from './core-props';
import type { MessageAction } from './voice-view-model';

const TEXT_LEVEL = 4;

export type VoiceLineProps = {
  readonly line: Line | null;
  readonly onAction: (action: MessageAction) => void;
};

export function VoiceLine({ line, onAction }: VoiceLineProps) {
  const { spacing } = useTokens();
  if (line === null) return null;
  const { text, button } = line;
  return (
    <View
      style={[
        styles.line,
        { gap: spacing.space3, paddingTop: spacing.space3, paddingHorizontal: spacing.space9 },
      ]}
    >
      {text === null ? null : (
        <Text
          level={TEXT_LEVEL}
          accessibilityRole={line.kind === 'hint' ? 'text' : 'alert'}
          accessibilityLiveRegion="polite"
          style={styles.text}
        >
          {text}
        </Text>
      )}
      {button === null ? null : (
        <Button
          label={button.label}
          variant="outline"
          onPress={() => onAction(button.action)}
          minHeight={MIN_TOUCH}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { alignItems: 'center' },
  text: { textAlign: 'center' },
});
