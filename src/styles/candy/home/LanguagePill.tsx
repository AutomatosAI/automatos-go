// A6's EN/PT switch in Candy (27 Oct 2026; HUD's and Arcade's homes draw it beside hold to talk): a
// pill in the chip fill beside the pause control in a view's header, for someone who may talk. Its
// letters ('EN') are the saved "I speak"; VoiceOver hears the language and what a tap switches to.

import { Pressable, StyleSheet } from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import type { HudLanguage } from '../../hud/core/model';
import { useCandyPaint } from '../parts/use-candy-paint';

const PADDING = 16;
const PRESSED_OPACITY = 0.7;

export function LanguagePill({ language }: { readonly language: HudLanguage }) {
  const { vars, type, round } = useCandyPaint();
  return (
    <Pressable
      onPress={language.onPress}
      accessibilityRole="button"
      accessibilityLabel={language.label}
      accessibilityHint={language.hint}
      style={({ pressed }) => [
        styles.pill,
        { borderRadius: round, backgroundColor: vars.chip, opacity: pressed ? PRESSED_OPACITY : 1 },
      ]}
    >
      <Text style={[type.button, { color: vars.text }]}>{language.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    paddingHorizontal: PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
