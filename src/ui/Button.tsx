// The button: primary (ink, cream in Dark), outline (card) or ghost; sm (30) or md (40). Busy shows
// a spinner and takes no presses; disabled dims to half. The label is the accessibility label
// unless one is given; a small button reaches the 44 pt touch target through hitSlop.

import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useTokens } from '../styles/theme';
import { Text } from './Text';
import { ICON_STROKE, hitSlopFor } from './paint';
import {
  BUTTON_LABEL_WEIGHT,
  BUTTON_SIZES,
  buttonPaint,
  type ButtonSize,
  type ButtonVariant,
} from './variants';

export type ButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly icon?: LucideIcon;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  /** Stretches across its container (the ticket sheet's 'Ask Auto about #0419'). */
  readonly fullWidth?: boolean;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  disabled = false,
  busy = false,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { colours, radii, spacing } = useTokens();
  const metrics = BUTTON_SIZES[size];
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      hitSlop={hitSlopFor(metrics.height)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => {
        const tone = buttonPaint(colours, variant, { pressed, disabled });
        return [
          styles.button,
          {
            minHeight: metrics.height,
            paddingHorizontal: spacing[metrics.paddingX],
            gap: spacing[metrics.gap],
            borderRadius: radii.control,
            backgroundColor: tone.backgroundColor,
            borderColor: tone.borderColor,
            opacity: tone.opacity,
          },
          fullWidth ? styles.full : null,
        ];
      }}
    >
      {({ pressed }) => {
        const { color } = buttonPaint(colours, variant, { pressed, disabled });
        return (
          <>
            {busy ? (
              <ActivityIndicator size="small" color={color} />
            ) : Icon ? (
              <Icon size={metrics.iconSize} color={color} strokeWidth={ICON_STROKE} />
            ) : null}
            <Text
              level={metrics.level}
              weight={BUTTON_LABEL_WEIGHT}
              style={[styles.label, { color }]}
              numberOfLines={2}
            >
              {label}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  full: { alignSelf: 'stretch' },
  label: { flexShrink: 1, textAlign: 'center' },
});
