// A switch: React Native's own, painted from the tokens, with its state also in a word beside it
// (§4.6: never only a colour). VoiceOver hears one switch, named by what it switches, checked or
// not; the word beside it is hidden so it is not read twice. A row of settings puts it in a
// SwitchRow, which names it by the row's title. The paint and the word are switch-model.ts's.

import { Switch as NativeSwitch, StyleSheet, View } from 'react-native';

import { useTokens } from '../styles/theme';
import { Text } from './Text';
import {
  SWITCH_DETAIL_LEVEL,
  switchAccessibilityState,
  switchPaint,
  switchWord,
} from './switch-model';

export type SwitchProps = {
  readonly value: boolean;
  readonly onChange: (next: boolean) => void;
  /** What it switches (a settings row's title). */
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
  const paint = switchPaint(colours);
  return (
    <View style={[styles.control, { gap: spacing.space2 }]}>
      <Text
        level={SWITCH_DETAIL_LEVEL}
        tone="muted"
        importantForAccessibility="no"
        accessible={false}
      >
        {switchWord(value)}
      </Text>
      <NativeSwitch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={switchAccessibilityState(value, disabled)}
        trackColor={paint.trackColor}
        thumbColor={paint.thumbColor}
        ios_backgroundColor={paint.iosBackground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  control: { flexDirection: 'row', alignItems: 'center' },
});
