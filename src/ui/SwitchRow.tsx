// A settings row with a switch: a title, the line that says what it covers, an optional note (who
// may change it, why it cannot be changed yet) and the Switch. At least the 44 pt touch target
// tall. VoiceOver hears one switch named by the title, with its detail as the hint.

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../styles/theme';
import { Switch, type SwitchProps } from './Switch';
import { Text } from './Text';
import {
  SWITCH_DETAIL_LEVEL,
  SWITCH_ROW_MIN_HEIGHT,
  SWITCH_TITLE_LEVEL,
  switchRowLines,
} from './switch-model';

export type SwitchRowProps = Omit<SwitchProps, 'accessibilityLabel' | 'accessibilityHint'> & {
  readonly title: string;
  readonly detail?: string;
  readonly note?: string | null;
};

export function SwitchRow({ title, detail, note, ...control }: SwitchRowProps) {
  const { spacing } = useTokens();
  return (
    <View style={[styles.row, { gap: spacing.space4, paddingVertical: spacing.space3 }]}>
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
      <Switch {...control} accessibilityLabel={title} accessibilityHint={detail} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: SWITCH_ROW_MIN_HEIGHT },
  text: { flex: 1, minWidth: 0 },
});
