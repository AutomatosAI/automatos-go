// A settings row with a switch: a title, the line that says what it covers, an optional note (who
// may change it, why it cannot be changed yet) and the Switch. The whole row is the one control, at
// least the 44 pt touch target tall: a press anywhere on it turns the switch, and VoiceOver and
// TalkBack hear one switch named by the title, checked or not, with the detail and the note as its
// hint. The Switch inside is only drawn there, out of the touch and out of the accessibility tree,
// so it is neither a second, smaller target nor a second stop. A disabled row neither changes nor
// takes the touch.

import { Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '../styles/theme';
import { Switch, type SwitchProps } from './Switch';
import { Text } from './Text';
import {
  SWITCH_DETAIL_LEVEL,
  SWITCH_ROW_MIN_HEIGHT,
  SWITCH_TITLE_LEVEL,
  pressSwitch,
  switchAccessibilityState,
  switchRowHint,
  switchRowLines,
} from './switch-model';

export type SwitchRowProps = Omit<SwitchProps, 'accessibilityLabel' | 'accessibilityHint'> & {
  readonly title: string;
  readonly detail?: string;
  readonly note?: string | null;
};

export function SwitchRow({ title, detail, note, ...control }: SwitchRowProps) {
  const { spacing } = useTokens();
  const { value, onChange, disabled = false } = control;
  return (
    <Pressable
      onPress={() => pressSwitch(value, disabled, onChange)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={switchRowHint(detail, note)}
      accessibilityState={switchAccessibilityState(value, disabled)}
      style={[styles.row, { gap: spacing.space4, paddingVertical: spacing.space3 }]}
    >
      <View style={[styles.text, { gap: spacing.space1 }]}>
        <Text variant="title" level={SWITCH_TITLE_LEVEL}>
          {title}
        </Text>
        {switchRowLines(detail, note).map((line, index) => (
          <Text key={index} level={SWITCH_DETAIL_LEVEL} tone="muted">
            {line}
          </Text>
        ))}
      </View>
      <View
        style={styles.drawnOnly}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Switch {...control} accessibilityLabel={title} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: SWITCH_ROW_MIN_HEIGHT },
  text: { flex: 1, minWidth: 0 },
  drawnOnly: { pointerEvents: 'none' },
});
