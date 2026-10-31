// The home menu in Candy (D73; repoContradictions: the design's Today, Shelf and Team headers have
// none, but the one menu — New chat, Chats, Command Centre, Settings — is reachable from every
// home): a 44 pt circle in the window's fill at a view's top right with lucide's menu in the text
// colour and, while something needs you, needs-you's number beside it in an accent pill (D26), the
// circle growing into a pill to hold it, with Dynamic Type too. The label carries the count
// ('Menu, 3 need you', A2's menuButtonView) and the hint names the menu's rows (MENU_HINT); the
// sheet is A2's HomeMenu, which the home mounts once. On the Chat view's stage (a card gradient) it
// is the P2 mock's 40 pt circle in white at 22 % with the card's white ink and no shadow, taking
// the 44 pt touch through its slop.

import Menu from 'lucide-react-native/icons/menu';
import { Pressable, StyleSheet, View } from 'react-native';

import { MENU_HINT, menuButtonView } from '../../../chat/home/menu';
import { Text } from '../../../ui';
import { ICON_STROKE, MIN_TOUCH, hitSlopFor } from '../../../ui/paint';
import { SHARED_COLOURS } from '../../tokens/candy-catalogue';
import { useCandyPaint, type CandyPaint } from '../parts/use-candy-paint';

const MENU = Object.freeze({ icon: 20, padH: 12, gap: 6, badgePadH: 7, badgeMin: 22, stage: 40 });
const PRESSED_OPACITY = 0.7;
const STAGE_SLOP = hitSlopFor(MENU.stage, MENU.stage);

/** Where the circle sits: a view's header (the window's fill) or the Chat view's stage. */
export type MenuGround = 'win' | 'stage';

export type MenuCircleProps = {
  /** needs-you's total (useNeedsYou), the number the menu's Command Centre row shows too. */
  readonly needsYou: number;
  /** The menu sheet is open. */
  readonly expanded: boolean;
  readonly onPress: () => void;
  /** The window's fill in a header (the default), or white at 22 % on the stage. */
  readonly ground?: MenuGround;
};

function groundPaint(ground: MenuGround, { vars, shadow }: CandyPaint) {
  if (ground === 'stage') {
    const pad = (MENU.stage - MENU.icon) / 2;
    const side = { minWidth: MENU.stage, minHeight: MENU.stage, paddingHorizontal: pad };
    return { box: [side, { backgroundColor: SHARED_COLOURS.white22 }], ink: vars.cardInk };
  }
  return { box: [{ backgroundColor: vars.win }, shadow], ink: vars.text };
}

export function MenuCircle({ needsYou, expanded, onPress, ground = 'win' }: MenuCircleProps) {
  const paint = useCandyPaint();
  const { vars, type, round } = paint;
  const view = menuButtonView(needsYou);
  const { box, ink } = groundPaint(ground, paint);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={ground === 'stage' ? STAGE_SLOP : undefined}
      accessibilityRole="button"
      accessibilityLabel={view.accessibilityLabel}
      accessibilityHint={MENU_HINT}
      accessibilityState={{ expanded }}
      style={({ pressed }) => [
        styles.circle,
        { borderRadius: round, opacity: pressed ? PRESSED_OPACITY : 1 },
        ...box,
      ]}
    >
      <Menu size={MENU.icon} color={ink} strokeWidth={ICON_STROKE} />
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
