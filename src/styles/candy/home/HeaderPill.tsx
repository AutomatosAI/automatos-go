// A pill in a view's header in Candy (US-023g, US-023n): the chip fill with Nunito 800 13 in the
// text colour, the filled pause control's pair, at least 44 pt each way and growing with Dynamic
// Type. It carries A6's EN/PT switch (LanguagePill) and Today's 'Ideas · N' (PRD-268 US-G01,
// today.ts ideasPill), beside the pause control. Its words are what it shows; VoiceOver hears its
// label and hint.

import { Pressable, StyleSheet } from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import { useCandyPaint } from '../parts/use-candy-paint';
import type { HeaderPillView } from './today';

const PADDING = 16;
const PRESSED_OPACITY = 0.7;

export function HeaderPill({ text, label, hint, onPress }: HeaderPillView) {
  const { vars, type, round } = useCandyPaint();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.pill,
        { borderRadius: round, backgroundColor: vars.chip, opacity: pressed ? PRESSED_OPACITY : 1 },
      ]}
    >
      <Text style={[type.button, { color: vars.text }]}>{text}</Text>
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
