// The home menu in Candy (D73; repoContradictions: the design's Today, Shelf and Team headers have
// none, but the one menu — New chat, Chats, Command Centre, Settings — is reachable from every
// home): a 44 pt circle in the window's fill at a view's top right with lucide's menu in the text
// colour and, while something needs you, needs-you's number beside it in an accent pill (D26), the
// circle growing into a pill to hold it, with Dynamic Type too. The label carries the count
// ('Menu, 3 need you', A2's menuButtonView) and the hint names the menu's rows (MENU_HINT); the
// sheet is A2's HomeMenu, which the home mounts once.

import Menu from 'lucide-react-native/icons/menu';
import { Pressable, StyleSheet, View } from 'react-native';

import { MENU_HINT, menuButtonView } from '../../../chat/home/menu';
import { Text } from '../../../ui';
import { ICON_STROKE, MIN_TOUCH } from '../../../ui/paint';
import { useCandyPaint } from '../parts/use-candy-paint';

const MENU = Object.freeze({ icon: 20, padH: 12, gap: 6, badgePadH: 7, badgeMin: 22 });
const PRESSED_OPACITY = 0.7;

export type MenuCircleProps = {
  /** needs-you's total (useNeedsYou), the number the menu's Command Centre row shows too. */
  readonly needsYou: number;
  /** The menu sheet is open. */
  readonly expanded: boolean;
  readonly onPress: () => void;
};

export function MenuCircle({ needsYou, expanded, onPress }: MenuCircleProps) {
  const { vars, type, round, shadow } = useCandyPaint();
  const view = menuButtonView(needsYou);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={view.accessibilityLabel}
      accessibilityHint={MENU_HINT}
      accessibilityState={{ expanded }}
      style={({ pressed }) => [
        styles.circle,
        { borderRadius: round, backgroundColor: vars.win, opacity: pressed ? PRESSED_OPACITY : 1 },
        shadow,
      ]}
    >
      <Menu size={MENU.icon} color={vars.text} strokeWidth={ICON_STROKE} />
      {view.badge !== null ? (
        <View style={[styles.badge, { borderRadius: round, backgroundColor: vars.accent }]}>
          <Text style={[type.button, { color: vars.accentInk }]}>{view.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    paddingHorizontal: MENU.padH,
    gap: MENU.gap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: MENU.badgeMin,
    minHeight: MENU.badgeMin,
    paddingHorizontal: MENU.badgePadH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
