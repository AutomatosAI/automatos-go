// The Command Centre's top bar (handoff §2, §Frame): back to Auto (iOS: chevron and the word 'Auto';
// Android: the arrow alone) and the live word, on the --secondary chrome with a hairline under it.
// It paints the status bar's inset itself, so the chrome runs to the top edge. A5: back wears the
// dress's ghost paint and control label (Studio unchanged; HUD's 'AUTO' in Geist Mono capitals).

import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';

import { routes } from '../../navigation/routes';
import { useGoBack } from '../../navigation/use-go-back';
import { useDress } from '../../styles/dress/use-dress';
import { useShellDress } from '../../styles/dress/use-cc-dress';
import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { dressedButtonPaint } from '../../ui/dressed';
import { hitSlopFor } from '../../ui/paint';
import { SHELL_COPY } from '../strings';
import { TOP_BAR } from './chrome';
import { LiveWord } from './LiveWord';

const IS_IOS = Platform.OS === 'ios';
const BackIcon = IS_IOS ? ChevronLeft : ArrowLeft;

function BackToAuto() {
  const goBack = useGoBack(routes.home);
  const { colours, radii, spacing } = useTokens();
  const dress = useDress();
  const { back } = useShellDress();
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
          backgroundColor: dressedButtonPaint(dress, 'ghost', { pressed }).backgroundColor,
        },
      ]}
    >
      <BackIcon
        size={TOP_BAR.backIconSize}
        strokeWidth={TOP_BAR.backIconStroke}
        color={colours.foreground}
      />
      {IS_IOS ? (
        <Text level={TOP_BAR.backLevel} weight={TOP_BAR.backWeight} style={back}>
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
