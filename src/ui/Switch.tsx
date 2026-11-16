// A switch: React Native's own, painted from the tokens (switch-model.ts switchPaint: a track and a
// thumb that read at 3 to 1 in every palette), with its state also in a word beside it (§4.6: never
// only a colour). The native switch and the word are only drawn, out of the touch and out of the
// accessibility tree: the press round them is the control, grown to the 44 pt touch target by its
// slop, and it is the one switch VoiceOver and TalkBack hear, named by what it switches, checked or
// not. A disabled one neither changes nor takes the touch. A row of settings puts it in a SwitchRow,
// where the whole row is the control instead.

import { Switch as NativeSwitch, Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '../styles/theme';
import { Text } from './Text';
import {
  SWITCH_DETAIL_LEVEL,
  SWITCH_SLOP,
  pressSwitch,
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

type FaceProps = { readonly value: boolean; readonly disabled: boolean };

/** The word and the native switch, drawn only: what holds them takes the touch and is heard. */
function SwitchFace({ value, disabled }: FaceProps) {
  const { colours, spacing } = useTokens();
  const paint = switchPaint(colours);
  return (
    <View
      style={[styles.face, { gap: spacing.space2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text level={SWITCH_DETAIL_LEVEL} tone="muted">
        {switchWord(value)}
      </Text>
      <NativeSwitch
        value={value}
        disabled={disabled}
        accessible={false}
        trackColor={paint.trackColor}
        thumbColor={paint.thumbColor}
        ios_backgroundColor={paint.iosBackground}
      />
    </View>
  );
}

export function Switch({
  value,
  onChange,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
}: SwitchProps) {
  return (
    <Pressable
      onPress={() => pressSwitch(value, disabled, onChange)}
      disabled={disabled}
      hitSlop={SWITCH_SLOP}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={switchAccessibilityState(value, disabled)}
    >
      <SwitchFace value={value} disabled={disabled} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: { flexDirection: 'row', alignItems: 'center', pointerEvents: 'none' },
});
