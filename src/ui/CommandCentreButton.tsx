// The header's Command Centre button (handoff §1 Header, K5): card ground, 1 pt border, 6 pt radius,
// 36 pt high; layout-dashboard, 'Command Centre' and the orange CountBadge with the server's one
// needs-you number (D26, useNeedsYou). It opens the Board. This is the ONE place a header shows the
// number: home (A2) and the other headers mount this button, never a badge of their own.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import LayoutDashboard from 'lucide-react-native/icons/layout-dashboard';

import { useNeedsYou } from '../api/needs-you';
import { routes } from '../navigation/routes';
import { useTokens } from '../styles/theme';
import { CountBadge } from './CountBadge';
import { Text } from './Text';
import { ICON_STROKE, hitSlopFor } from './paint';
import { UI_COPY } from './strings';
import {
  BUTTON_LABEL_WEIGHT,
  COMMAND_CENTRE_BUTTON,
  buttonPaint,
  commandCentreLabel,
} from './variants';

/** It takes nothing: the number and the destination are the app's, the same in every header. */
export type CommandCentreButtonProps = Record<string, never>;

export function CommandCentreButton() {
  const router = useRouter();
  const { total } = useNeedsYou();
  const { colours, radii, spacing } = useTokens();
  return (
    <Pressable
      onPress={() => router.push(routes.cc.board)}
      hitSlop={hitSlopFor(COMMAND_CENTRE_BUTTON.height)}
      accessibilityRole="button"
      accessibilityLabel={commandCentreLabel(total)}
      accessibilityState={{ disabled: false }}
      style={({ pressed }) => {
        const tone = buttonPaint(colours, 'outline', { pressed });
        return [
          styles.button,
          {
            minHeight: COMMAND_CENTRE_BUTTON.height,
            paddingHorizontal: spacing.space4,
            gap: spacing.space2,
            borderRadius: radii.control,
            backgroundColor: tone.backgroundColor,
            borderColor: tone.borderColor,
            opacity: tone.opacity,
          },
        ];
      }}
    >
      {({ pressed }) => {
        const { color } = buttonPaint(colours, 'outline', { pressed });
        return (
          <>
            <LayoutDashboard
              size={COMMAND_CENTRE_BUTTON.iconSize}
              color={color}
              strokeWidth={ICON_STROKE}
            />
            <Text
              level={COMMAND_CENTRE_BUTTON.level}
              weight={BUTTON_LABEL_WEIGHT}
              style={[styles.label, { color }]}
              numberOfLines={2}
            >
              {UI_COPY.commandCentre}
            </Text>
            <CountBadge count={total} />
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  label: { flexShrink: 1 },
});
