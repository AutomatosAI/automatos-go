// An icon-only button: a lucide icon, and an accessibility label it cannot be without (the icon
// says nothing to VoiceOver). Square (6 pt radius) or round (the composer's send); 30, 36 or 42.

import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { useTokens } from '../styles/theme';
import { ICON_STROKE, hitSlopFor } from './paint';
import {
  ICON_BUTTON_SIZES,
  buttonPaint,
  type ButtonVariant,
  type IconButtonSize,
} from './variants';

export type IconButtonProps = {
  readonly icon: LucideIcon;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: IconButtonSize;
  readonly round?: boolean;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
};

export function IconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  variant = 'ghost',
  size = 'md',
  round = false,
  disabled = false,
  accessibilityHint,
}: IconButtonProps) {
  const { colours, radii } = useTokens();
  const { box, icon } = ICON_BUTTON_SIZES[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlopFor(box, box)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => {
        const tone = buttonPaint(colours, variant, { pressed, disabled });
        return [
          styles.button,
          {
            width: box,
            height: box,
            borderRadius: round ? radii.full : radii.control,
            backgroundColor: tone.backgroundColor,
            borderColor: tone.borderColor,
            opacity: tone.opacity,
          },
        ];
      }}
    >
      {({ pressed }) => (
        <Icon
          size={icon}
          color={buttonPaint(colours, variant, { pressed, disabled }).color}
          strokeWidth={ICON_STROKE}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
