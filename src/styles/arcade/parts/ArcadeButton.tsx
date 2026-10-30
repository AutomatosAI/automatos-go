// Arcade's two buttons (the design kit's ui/ui.module.css .button and .secondary): square, in
// Press Start 2P capitals at the button step, at least 44 pt each way and growing with Dynamic
// Type. 'primary' is the accent with its ink and a 4 pt hard shadow (OPEN, TYPE); 'secondary' the
// page with the window border inside (Skip). A press nudges the button 2 pt down and right, as the
// web's :active does. VoiceOver hears the label (the words, not the capitals), or the label given
// for it where the words say less (the IDEAS chip's count, a suggestion's START), and the hint. A
// busy button (a suggestion's Start while Face ID asks, PRD-268 §6.12.3 'starting') is dimmed as
// the foundation's Button dims one, and does not press.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import { useArcadePaint } from './use-arcade-paint';

const BUTTON = Object.freeze({ padH: 12, ring: 2, shadow: 4, press: 2, busyOpacity: 0.5 });

export type ArcadeButtonProps = {
  /** The words on the button, shown in capitals. */
  readonly label: string;
  readonly onPress: () => void;
  readonly hint?: string;
  readonly kind?: 'primary' | 'secondary';
  /** What VoiceOver hears; the words when omitted. */
  readonly accessibilityLabel?: string;
  /** Working: dimmed and not pressable. */
  readonly busy?: boolean;
};

export function ArcadeButton(props: ArcadeButtonProps) {
  const { label, onPress, hint, kind = 'secondary', busy = false } = props;
  const { vars, type } = useArcadePaint();
  const primary = kind === 'primary';
  return (
    <View style={[styles.box, busy ? styles.busy : null]}>
      {primary ? <View style={[styles.shadow, { backgroundColor: vars.sh }]} /> : null}
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityHint={hint}
        accessibilityState={busy ? { busy, disabled: busy } : undefined}
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
  busy: { opacity: BUTTON.busyOpacity },
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
