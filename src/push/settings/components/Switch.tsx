// A settings switch, feature-local because src/ui has no switch primitive (FOUNDATION GAP: no switch
// primitive): React Native's own Switch painted from the tokens, with its state also in a word
// beside it (§4.6: never only a colour). SwitchRow is the row it sits in: a title, the line that
// says what it covers, an optional note (who may change it, why it cannot be changed yet) and the
// switch. VoiceOver hears one switch named by the title, its detail as the hint.

import { Switch as NativeSwitch, StyleSheet, View } from 'react-native';

import { useTokens } from '../../../styles/theme';
import { Text } from '../../../ui';
import { switchWord } from '../view-model';

const TITLE_LEVEL = 6;
const DETAIL_LEVEL = 6;
const MIN_ROW_HEIGHT = 44;

export type SwitchProps = {
  readonly value: boolean;
  readonly onChange: (next: boolean) => void;
  /** What it switches (the row's title). */
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  readonly disabled?: boolean;
};

export function Switch({
  value,
  onChange,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
}: SwitchProps) {
  const { colours, spacing } = useTokens();
  return (
    <View style={[styles.control, { gap: spacing.space2 }]}>
      <Text level={DETAIL_LEVEL} tone="muted" importantForAccessibility="no" accessible={false}>
        {switchWord(value)}
      </Text>
      <NativeSwitch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ checked: value, disabled }}
        trackColor={{ false: colours.muted, true: colours.primary }}
        thumbColor={colours.card}
        ios_backgroundColor={colours.muted}
      />
    </View>
  );
}

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
        <Text variant="title" level={TITLE_LEVEL}>
          {title}
        </Text>
        {detail ? (
          <Text level={DETAIL_LEVEL} tone="muted">
            {detail}
          </Text>
        ) : null}
        {note ? (
          <Text level={DETAIL_LEVEL} tone="muted">
            {note}
          </Text>
        ) : null}
      </View>
      <Switch {...control} accessibilityLabel={title} accessibilityHint={detail} />
    </View>
  );
}

const styles = StyleSheet.create({
  control: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_ROW_HEIGHT },
  text: { flex: 1, minWidth: 0 },
});
