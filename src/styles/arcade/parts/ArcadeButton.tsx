// Arcade's two buttons (the design kit's ui/ui.module.css .button and .secondary): square, in
// Press Start 2P capitals at the button step, at least 44 pt each way and growing with Dynamic
// Type. 'primary' is the accent with its ink and a 4 pt hard shadow (OPEN, TYPE); 'secondary' the
// page with the window border inside (Skip). A press nudges the button 2 pt down and right, as the
// web's :active does. VoiceOver hears the label (the words, not the capitals) and the hint.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import { useArcadePaint } from './use-arcade-paint';

const BUTTON = Object.freeze({ padH: 12, ring: 2, shadow: 4, press: 2 });

export type ArcadeButtonProps = {
  /** The words on the button, shown in capitals. */
  readonly label: string;
  readonly onPress: () => void;
  readonly hint?: string;
  readonly kind?: 'primary' | 'secondary';
};

export function ArcadeButton({ label, onPress, hint, kind = 'secondary' }: ArcadeButtonProps) {
  const { vars, type } = useArcadePaint();
  const primary = kind === 'primary';
  return (
    <View style={styles.box}>
      {primary ? <View style={[styles.shadow, { backgroundColor: vars.sh }]} /> : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        style={({ pressed }) => [
          styles.button,
          primary
            ? { backgroundColor: vars.ac }
            : { backgroundColor: vars.page, borderWidth: BUTTON.ring, borderColor: vars.bd },
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[type.button, { color: primary ? vars.aci : vars.tx }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'flex-start' },
  shadow: {
    position: 'absolute',
    top: BUTTON.shadow,
    left: BUTTON.shadow,
    right: -BUTTON.shadow,
    bottom: -BUTTON.shadow,
  },
  button: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    paddingHorizontal: BUTTON.padH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ translateX: BUTTON.press }, { translateY: BUTTON.press }] },
});
