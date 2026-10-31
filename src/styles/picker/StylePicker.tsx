// Settings → Style and look (US-016h, FR-7, D54): US-016a's pickerState as five large cards, each
// a live preview in its own style. A tap flips the whole app at once (useSetStyle: the haptic, the
// crossfade, the choice kept on the phone); Studio's card sets Light / Dark / System (the
// foundation's scheme setter); Play's, HUD's, Arcade's and Candy's open their look pages. The
// screen's own frame is painted by the app's style, so it repaints with the flip. Under Studio,
// 'Same as Studio' comes first (D-PHONE-CHOICE), then the installed themes, listed only when the
// server offers mobile themes (the last read's offered installs, US-016i); the screen asks for a
// read each time it opens (useThemeRefresh). Nothing here points at making an account
// (D-NO-SIGNUP) or mentions plans (D8).

import { useFocusEffect, useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { canMobileTheme } from '../../api/capabilities';
import { useAppSession } from '../../app-state/session';
import { routes } from '../../navigation/routes';
import { useGoBack } from '../../navigation/use-go-back';
import { IconButton, Screen, Text } from '../../ui';
import type { StyleScreenPath } from '../nav';
import { useStyleStore } from '../provider/context';
import { useSetStyle } from '../provider/flip';
import { pickerState } from '../registry/picker';
import { PICKER_COPY } from '../strings';
import { useTheme, useTokens } from '../theme';
import { useThemeRefresh } from '../themes/ThemeSync';
import { pickerCards } from './cards';
import { StyleCard } from './StyleCard';
import { useScreenFocused } from './use-screen-focused';

const TITLE_LEVEL = 2;

function useCards() {
  const choice = useStyleStore((state) => state.choice);
  const followed = useStyleStore((state) => state.followed);
  const installedThemes = useStyleStore((state) => state.themes);
  const { choice: studioScheme } = useTheme();
  const { discovery } = useAppSession();
  const offersThemes = canMobileTheme(discovery);
  return useMemo(
    () =>
      pickerCards(
        pickerState({
          choice,
          studioScheme,
          installedThemes,
          canMobileTheme: offersThemes,
          followed,
        }),
      ),
    [choice, studioScheme, installedThemes, offersThemes, followed],
  );
}

/** A read of the workspace's themes each time the screen opens (joins one already running). */
function useReadOnOpen(): void {
  const refresh = useThemeRefresh();
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
}

export function StylePicker() {
  useReadOnOpen();
  const cards = useCards();
  const setStyle = useSetStyle();
  const { setChoice: setScheme } = useTheme();
  const router = useRouter();
  const goBack = useGoBack(routes.settings);
  const focused = useScreenFocused();
  const { spacing } = useTokens();
  const open = useCallback((href: StyleScreenPath) => router.push(href), [router]);

  return (
    <Screen scroll padding="space9">
      <View style={{ gap: spacing.space6 }}>
        <IconButton icon={ChevronLeft} accessibilityLabel={PICKER_COPY.back} onPress={goBack} />
        <View style={{ gap: spacing.space3 }}>
          <Text variant="eyebrow">{PICKER_COPY.eyebrow}</Text>
          <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
            {PICKER_COPY.title}
          </Text>
        </View>
        {cards.map((card) => (
          <StyleCard
            key={card.id}
            card={card}
            focused={focused}
            onSelect={setStyle}
            onScheme={setScheme}
            onOpen={open}
          />
        ))}
      </View>
    </Screen>
  );
}
