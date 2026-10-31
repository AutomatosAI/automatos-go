// An icon-only button: a lucide icon, and an accessibility label it cannot be without (the icon
// says nothing to VoiceOver). Square (6 pt radius) or round (the composer's send); 30, 36 or 42.
// A5: the dress gives its radius and paints (HUD: square, round too, as HUD rounds nothing).

import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { useDress } from '../styles/dress/use-dress';
import { dressedButtonPaint } from './dressed';
import { ICON_STROKE, hitSlopFor } from './paint';
import { ICON_BUTTON_SIZES, type ButtonVariant, type IconButtonSize } from './variants';

export type IconButtonProps = {
  readonly icon: LucideIcon;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: IconButtonSize;
  readonly round?: boolean;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
  /** A choice that is on (the brief's thumbs): VoiceOver hears it selected. */
  readonly selected?: boolean;
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
  selected,
}: IconButtonProps) {
  const dress = useDress();
  const { box, icon } = ICON_BUTTON_SIZES[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlopFor(box, box)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected === undefined ? { disabled } : { disabled, selected }}
      style={({ pressed }) => {
        const tone = dressedButtonPaint(dress, variant, { pressed, disabled });
        return [
          styles.button,
          {
            width: box,
            height: box,
            borderRadius: round ? dress.radii.full : dress.button.radius,
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
          color={dressedButtonPaint(dress, variant, { pressed, disabled }).color}
          strokeWidth={ICON_STROKE}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
