// The Command Centre's top bar (handoff §2, §Frame): back to Auto (iOS: chevron and the word 'Auto';
// Android: the arrow alone) and the live word, on the --secondary chrome with a hairline under it.
// It paints the status bar's inset itself, so the chrome runs to the top edge.

import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';

import { routes } from '../../navigation/routes';
import { useGoBack } from '../../navigation/use-go-back';
import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { hitSlopFor } from '../../ui/paint';
import { buttonPaint } from '../../ui/variants';
import { SHELL_COPY } from '../strings';
import { TOP_BAR } from './chrome';
import { LiveWord } from './LiveWord';

const IS_IOS = Platform.OS === 'ios';
const BackIcon = IS_IOS ? ChevronLeft : ArrowLeft;

function BackToAuto() {
  const goBack = useGoBack(routes.home);
  const { colours, radii, spacing } = useTokens();
  return (
    <Pressable
      onPress={goBack}
      hitSlop={hitSlopFor(TOP_BAR.backHeight)}
      accessibilityRole="button"
      accessibilityLabel={SHELL_COPY.backLabel}
      style={({ pressed }) => [
        styles.back,
        {
          minHeight: TOP_BAR.backHeight,
          paddingHorizontal: spacing[TOP_BAR.backPaddingX],
          gap: TOP_BAR.backGap,
          borderRadius: radii.control,
          backgroundColor: buttonPaint(colours, 'ghost', { pressed }).backgroundColor,
        },
      ]}
    >
      <BackIcon
        size={TOP_BAR.backIconSize}
        strokeWidth={TOP_BAR.backIconStroke}
        color={colours.foreground}
      />
      {IS_IOS ? (
        <Text level={TOP_BAR.backLevel} weight={TOP_BAR.backWeight}>
          {SHELL_COPY.back}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function TopBar() {
  const { colours, spacing } = useTokens();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: colours[TOP_BAR.ground],
        borderBottomColor: colours[TOP_BAR.rule],
        borderBottomWidth: TOP_BAR.ruleWidth,
        paddingTop: insets.top + spacing[TOP_BAR.paddingTop],
        paddingBottom: spacing[TOP_BAR.paddingBottom],
        paddingHorizontal: spacing[TOP_BAR.paddingX],
      }}
    >
      <View style={styles.row}>
        <BackToAuto />
        <View style={styles.spacer} />
        <LiveWord />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  back: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
});
