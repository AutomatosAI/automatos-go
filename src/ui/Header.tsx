// The one header (the app standard's rule 4.2, decision D3): a bar drawn from the tokens, never
// the system's. Back, a title and at most two actions. Back goes through the one back hook, which
// falls back to home when there is nothing behind, and is not drawn on a tab's root. Every word is
// the Text primitive and every button the IconButton, so Dynamic Type, contrast, the 44 pt target
// and each style's dress are the primitives' own: the bar paints no ground of its own and sits on
// the Screen's. A screen with a large title at the top of its scrolling content passes
// `collapsing` (use-collapsing-title.ts): the bar's own title then appears once the large one has
// scrolled away. The large title itself is a Text title in the content, not part of this bar.
// The logic and the bar's sizes are in header-model.ts (pure, tested): this file holds no size of its own.

import type { LucideIcon } from 'lucide-react-native';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { StyleSheet, View } from 'react-native';

import { useGoBack } from '../navigation/use-go-back';
import { useTokens } from '../styles/theme';
import { IconButton } from './IconButton';
import { Text } from './Text';
import {
  HEADER_BAR,
  HEADER_BUTTON_SIZE,
  HEADER_TITLE_LEVEL,
  HEADER_TITLE_LINES,
  barTitleShown,
  headerActions,
  headerMinHeight,
  showsBack,
  type CollapsingTitle,
} from './header-model';
import { UI_COPY } from './strings';

/** One action in the bar: an icon, and the name VoiceOver reads for it. */
export type HeaderAction = Readonly<{
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress: () => void;
  accessibilityHint?: string;
  disabled?: boolean;
}>;

/** None, one or two: the type refuses a third. */
export type HeaderActions =
  readonly [] | readonly [HeaderAction] | readonly [HeaderAction, HeaderAction];

export type HeaderProps = {
  readonly title: string;
  /** A tab's root: there is nothing to go back to, so the bar draws no way back. */
  readonly root?: boolean;
  readonly actions?: HeaderActions;
  /** The screen's large title, when it has one: the bar's title waits until it has scrolled away. */
  readonly collapsing?: CollapsingTitle;
  /** Where Back goes when nothing is behind this screen; home when omitted. */
  readonly backFallback?: string;
};

export function Header({ title, root, actions, collapsing, backFallback }: HeaderProps) {
  const { spacing } = useTokens();
  const goBack = useGoBack(backFallback);
  return (
    <View
      style={[
        styles.bar,
        {
          minHeight: headerMinHeight(HEADER_BAR.minHeight),
          paddingHorizontal: spacing[HEADER_BAR.paddingX],
          gap: spacing[HEADER_BAR.gap],
        },
      ]}
    >
      {showsBack(root) ? (
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel={UI_COPY.back}
          onPress={goBack}
          size={HEADER_BUTTON_SIZE}
        />
      ) : null}
      <View style={styles.title}>
        {barTitleShown(collapsing) ? (
          <Text
            variant="title"
            level={HEADER_TITLE_LEVEL}
            accessibilityRole="header"
            numberOfLines={HEADER_TITLE_LINES}
          >
            {title}
          </Text>
        ) : null}
      </View>
      {headerActions<HeaderAction>(actions).map(({ place, action }) => (
        <IconButton
          key={place}
          icon={action.icon}
          accessibilityLabel={action.accessibilityLabel}
          accessibilityHint={action.accessibilityHint}
          onPress={action.onPress}
          disabled={action.disabled}
          size={HEADER_BUTTON_SIZE}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, minWidth: 0 },
});
