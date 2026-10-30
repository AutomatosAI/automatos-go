// ARCADE_STAND_IN US-022j: Arcade's Options until its look page lands — the way back, the page's
// name and a line that says the page is coming. Painted by the app's style, as the picker is.

import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { View } from 'react-native';

import { useGoBack } from '../../navigation/use-go-back';
import { IconButton, Screen, Text } from '../../ui';
import { STYLE_SCREENS } from '../nav';
import { ARCADE_OPTIONS_SOON_COPY } from '../strings';
import { useTokens } from '../theme';

const TITLE_LEVEL = 2;

export function ArcadeLookStandIn() {
  const goBack = useGoBack(STYLE_SCREENS.settingsStyle);
  const { spacing } = useTokens();
  const copy = ARCADE_OPTIONS_SOON_COPY;
  return (
    <Screen scroll padding="space9">
      <View style={{ gap: spacing.space6 }}>
        <IconButton icon={ChevronLeft} accessibilityLabel={copy.back} onPress={goBack} />
        <View style={{ gap: spacing.space3 }}>
          <Text variant="eyebrow">{copy.eyebrow}</Text>
          <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
            {copy.title}
          </Text>
        </View>
        <Text>{copy.message}</Text>
      </View>
    </Screen>
  );
}
