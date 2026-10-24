// Settings → Style and look (US-016h, FR-7, D54): US-016a's pickerState as three large cards, each
// a live preview in its own style. A tap flips the whole app at once (useSetStyle: the haptic, the
// crossfade, the choice kept on the phone); Studio's card sets Light / Dark / System (the
// foundation's scheme setter); Play's and HUD's open their look pages. The screen's own frame is
// painted by the app's style, so it repaints with the flip. Installed themes are listed under
// Studio only when the server offers mobile themes; US-016i supplies the list. Nothing here
// points at making an account (D-NO-SIGNUP) or mentions plans (D8).

import { useRouter } from 'expo-router';
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
import { pickerState, type PickerTheme } from '../registry/picker';
import { PICKER_COPY } from '../strings';
import { useTheme, useTokens } from '../theme';
import { pickerCards } from './cards';
import { StyleCard } from './StyleCard';
import { useScreenFocused } from './use-screen-focused';

const TITLE_LEVEL = 2;

/** Until US-016i reads the workspace's installed themes with a phone look. */
const NO_INSTALLED_THEMES: readonly PickerTheme[] = Object.freeze([]);

function useCards() {
  const choice = useStyleStore((state) => state.choice);
  const { choice: studioScheme } = useTheme();
  const { discovery } = useAppSession();
  const offersThemes = canMobileTheme(discovery);
  return useMemo(
    () =>
      pickerCards(
        pickerState({
          choice,
          studioScheme,
          installedThemes: NO_INSTALLED_THEMES,
          canMobileTheme: offersThemes,
        }),
      ),
    [choice, studioScheme, offersThemes],
  );
}

export function StylePicker() {
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
