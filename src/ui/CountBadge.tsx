// The orange count badge (the Command Centre button's needs-you number): mono figures on --accent,
// round, at least 16 pt and growing with Dynamic Type; nothing at 0, '99+' past the cap. When it
// stands alone it says what it counts; inside a button the button's label says it instead.

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../styles/theme';
import { Text } from './Text';
import { BADGE_MIN_SIZE, badgeText, countPhrase, type PluralForms } from './variants';

export type CountBadgeProps = {
  readonly count: number;
  /** What it counts, for VoiceOver ('question' / 'questions'); omit inside a labelled control. */
  readonly noun?: PluralForms;
};

export function CountBadge({ count, noun }: CountBadgeProps) {
  const { colours, radii, spacing } = useTokens();
  const text = badgeText(count);
  if (text === null) return null;
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colours.accent,
          borderRadius: radii.full,
          paddingHorizontal: spacing.space1,
        },
      ]}
      accessible={noun !== undefined}
      accessibilityRole="text"
      accessibilityLabel={noun ? countPhrase(count, noun) : undefined}
    >
      <Text variant="mono" style={[styles.figure, { color: colours.accentForeground }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: BADGE_MIN_SIZE,
    minHeight: BADGE_MIN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figure: { fontVariant: ['tabular-nums'], textAlign: 'center' },
});
