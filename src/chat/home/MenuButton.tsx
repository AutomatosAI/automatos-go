// The header's one menu button (D73): a ghost box of at least 44 pt with lucide's menu at 22 pt, and
// the foundation's orange CountBadge BESIDE the glyph while something needs you (D26), so the
// number still shows on every screen with the header and never covers the bars: the button grows
// to hold it, with Dynamic Type too. The badge says nothing on its own: the button's label carries
// the count ('Menu, 13 need you', menuButtonView), and its hint names the menu's rows (MENU_HINT).

import Menu from 'lucide-react-native/icons/menu';
import { Pressable, StyleSheet } from 'react-native';

import { useTokens } from '../../styles/theme';
import { CountBadge } from '../../ui';
import { ICON_STROKE } from '../../ui/paint';
import { buttonPaint } from '../../ui/variants';
import { HEADER, MENU_HINT, menuButtonView } from './menu';

export type MenuButtonProps = {
  /** The server's needs-you number (useNeedsYou's total). */
  readonly needsYou: number;
  /** The menu is open. */
  readonly expanded: boolean;
  readonly onPress: () => void;
};

export function MenuButton({ needsYou, expanded, onPress }: MenuButtonProps) {
  const { colours, radii, spacing } = useTokens();
  const view = menuButtonView(needsYou);
  const { box, icon, side, badgeGap } = HEADER.menu;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={view.accessibilityLabel}
      accessibilityHint={MENU_HINT}
      accessibilityState={{ expanded }}
      style={({ pressed }) => [
        styles.box,
        {
          minWidth: box,
          minHeight: box,
          paddingHorizontal: spacing[side],
          gap: spacing[badgeGap],
          borderRadius: radii.control,
          backgroundColor: buttonPaint(colours, 'ghost', { pressed }).backgroundColor,
        },
      ]}
    >
      <Menu size={icon} color={colours.foreground} strokeWidth={ICON_STROKE} />
      {view.badge !== null ? <CountBadge count={view.badge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
