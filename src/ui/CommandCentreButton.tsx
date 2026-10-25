// The Command Centre button (handoff §1 Header, K5): card ground, 1 pt border, 6 pt radius, 36 pt
// high; layout-dashboard, 'Command Centre' and the orange CountBadge with the server's one needs-you
// number (D26, useNeedsYou). It opens the Board. Since D73 no Studio header mounts it: home and the
// chat route carry the number on the menu button and the menu's Command Centre row. Kept for HUD
// (A5). A5: the dress gives its radius, least height, label face, case and tracking and the
// outline paint (HUD: square, 44 high, Geist Mono capitals on the accent line).

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import LayoutDashboard from 'lucide-react-native/icons/layout-dashboard';

import { useNeedsYou } from '../api/needs-you';
import { routes } from '../navigation/routes';
import { useDress } from '../styles/dress/use-dress';
import { useStyle } from '../styles/theme';
import { CountBadge } from './CountBadge';
import { Text } from './Text';
import { buttonHeight, controlLabel, dressedButtonPaint } from './dressed';
import { ICON_STROKE, hitSlopFor } from './paint';
import { UI_COPY } from './strings';
import { COMMAND_CENTRE_BUTTON, commandCentreLabel } from './variants';

/** It takes nothing: the number and the destination are the app's, the same in every header. */
export type CommandCentreButtonProps = Record<string, never>;

export function CommandCentreButton() {
  const router = useRouter();
  const { total } = useNeedsYou();
  const style = useStyle();
  const dress = useDress();
  const { spacing } = style.tokens;
  const height = buttonHeight(dress, COMMAND_CENTRE_BUTTON.height, false);
  const labelFace = controlLabel(style, dress, COMMAND_CENTRE_BUTTON.level);
  return (
    <Pressable
      onPress={() => router.push(routes.cc.board)}
      hitSlop={hitSlopFor(height)}
      accessibilityRole="button"
      accessibilityLabel={commandCentreLabel(total)}
      accessibilityState={{ disabled: false }}
      style={({ pressed }) => {
        const tone = dressedButtonPaint(dress, 'outline', { pressed });
        return [
          styles.button,
          {
            minHeight: height,
            paddingHorizontal: spacing.space4,
            gap: spacing.space2,
            borderRadius: dress.button.radius,
            backgroundColor: tone.backgroundColor,
            borderColor: tone.borderColor,
            opacity: tone.opacity,
          },
        ];
      }}
    >
      {({ pressed }) => {
        const { color } = dressedButtonPaint(dress, 'outline', { pressed });
        return (
          <>
            <LayoutDashboard
              size={COMMAND_CENTRE_BUTTON.iconSize}
              color={color}
              strokeWidth={ICON_STROKE}
            />
            <Text style={[labelFace, styles.label, { color }]} numberOfLines={2}>
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
