// The header on home and the chat route (D73, Gerard 23 Oct on build 7: "top menu is cluttered...
// have a normal burger menu"): one slim HeaderBar row. On the left, Back (the chat route only) and
// the brand lockup, the sail mark from assets/brand beside 'automatos' in Newsreader 17 on one
// line; on the right, ONE menu button carrying the server's needs-you number (D26). New chat,
// Chats (D28), the Command Centre and Settings sit in the menu it opens (HomeMenu, menu.ts).
// Beside it, where discovery lists `suggestions` and one is open, 'Ideas · N' opens the sheet of
// every open suggestion (PRD-268 US-G01, src/suggestions/use-ideas.tsx).

import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { Image, StyleSheet, View } from 'react-native';

import { useNeedsYou } from '../../api/needs-you';
import { useTokens } from '../../styles/theme';
import { useIdeas } from '../../suggestions/use-ideas';
import { Button, IconButton, Text } from '../../ui';
import { HOME_COPY } from '../strings';
import { HeaderBar } from './HeaderBar';
import { HomeMenu } from './HomeMenu';
import { HEADER } from './menu';
import { MenuButton } from './MenuButton';
import { useHomeMenu } from './use-home-menu';

// the trimmed sail mark (assets/brand/SOURCES.md: 321 × 394), drawn 20 pt high as the handoff's
const BRAND_MARK = require('../../../assets/brand/splash.png');
const MARK_HEIGHT = 20;
const MARK_ASPECT = 321 / 394;

export type HomeHeaderProps = {
  /** The chat route's way back; home has none. */
  readonly onBack?: () => void;
  /** The menu route this screen already is (menu.ts menuHere): its row only closes the menu. */
  readonly here?: string | null;
};

function Brand() {
  const { spacing } = useTokens();
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={HOME_COPY.brand}
      style={[styles.brand, { gap: spacing.space2 }]}
    >
      <Image
        source={BRAND_MARK}
        style={styles.mark}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text
        variant={HEADER.wordmark.variant}
        level={HEADER.wordmark.level}
        numberOfLines={1}
        style={styles.wordmark}
      >
        {HOME_COPY.wordmark}
      </Text>
    </View>
  );
}

export function HomeHeader({ onBack, here = null }: HomeHeaderProps) {
  const { total } = useNeedsYou();
  const menu = useHomeMenu(here);
  const ideas = useIdeas();
  return (
    <>
      <HeaderBar left={onBack ? HEADER.edge.control : HEADER.edge.text} right={HEADER.edge.control}>
        {onBack ? (
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel={HOME_COPY.back}
            onPress={onBack}
            variant="ghost"
            size="md"
          />
        ) : null}
        <Brand />
        {ideas.button ? (
          <Button
            label={ideas.button.text}
            accessibilityLabel={ideas.button.label}
            onPress={ideas.button.onPress}
            variant="ghost"
            size="sm"
          />
        ) : null}
        <MenuButton needsYou={total} expanded={menu.visible} onPress={menu.open} />
      </HeaderBar>
      <HomeMenu menu={menu} needsYou={total} />
      {ideas.sheet}
    </>
  );
}

const styles = StyleSheet.create({
  brand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  // Both sides fixed: a bundled image's own pixel size is a default under the style, and with
  // height + aspectRatio alone iOS let the width win (the mark drew ~290 × 358 pt on a device).
  mark: { width: MARK_HEIGHT * MARK_ASPECT, height: MARK_HEIGHT },
  wordmark: { flexShrink: 1 },
});
