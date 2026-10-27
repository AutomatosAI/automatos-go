// The EN/PT switch as a pill in the style's dress (27 Oct 2026), beside Play's voice button: the
// listening language's letters ('EN', 'PT'), at least 44 pt wide and, with its slop, 44 pt to touch.
// VoiceOver and TalkBack hear 'Speaking English. Switch to Portuguese'; a tap switches it
// (use-language-switch.ts). Nothing for a viewer. HUD's core draws its own (HudButtons).

import { Pressable, StyleSheet } from 'react-native';

import { useDress } from '../../styles/dress/use-dress';
import { useStyle } from '../../styles/theme';
import { Text } from '../../ui';
import { controlLabel, dressedPillPaint } from '../../ui/dressed';
import { MIN_TOUCH, hitSlopFor } from '../../ui/paint';
import { useLanguageSwitch } from './use-language-switch';

const LABEL_LEVEL = 5;

export type LanguageChipProps = {
  /** The person may talk (roleCan 'chat'); otherwise nothing is drawn. */
  readonly shown: boolean;
};

export function LanguageChip({ shown }: LanguageChipProps) {
  const language = useLanguageSwitch(shown);
  const style = useStyle();
  const dress = useDress();
  if (!language) return null;
  const { pill } = dress;
  const face = controlLabel(style, dress, LABEL_LEVEL, pill.restWeight);
  const ink = dressedPillPaint(dress, false).color;
  return (
    <Pressable
      onPress={language.onPress}
      hitSlop={hitSlopFor(pill.minHeight)}
      accessibilityRole="button"
      accessibilityLabel={language.label}
      accessibilityHint={language.hint}
      style={({ pressed }) => {
        const tone = dressedPillPaint(dress, false, { pressed });
        return [
          styles.chip,
          {
            minWidth: MIN_TOUCH,
            minHeight: pill.minHeight,
            paddingHorizontal: style.tokens.spacing.space2,
            borderRadius: pill.radius,
            borderWidth: tone.borderWidth,
            borderColor: tone.borderColor,
            backgroundColor: tone.backgroundColor,
            opacity: tone.opacity,
          },
        ];
      }}
    >
      <Text style={[face, { color: ink }]}>{language.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center' },
});
