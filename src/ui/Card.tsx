// A card: --card ground, 1 pt --border, the hairline shadow; 8 pt radius (board and needs cards)
// or 10 (panels). Pressable cards take the hover look while pressed and must say what they open.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTokens } from '../styles/theme';
import type { SpaceName, Tokens } from '../styles/tokens';
import { cardPaint } from './variants';

type CardBase = {
  readonly children: ReactNode;
  readonly padding?: SpaceName;
  readonly radius?: 'card' | 'panel';
  readonly style?: StyleProp<ViewStyle>;
};

export type CardProps = CardBase &
  (
    | { readonly onPress?: undefined; readonly accessibilityLabel?: string }
    | {
        readonly onPress: () => void;
        readonly accessibilityLabel: string;
        readonly accessibilityHint?: string;
      }
  );

function frame(tokens: Tokens, padding: SpaceName, radius: 'card' | 'panel', pressed: boolean) {
  const tone = cardPaint(tokens.colours, pressed);
  return {
    padding: tokens.spacing[padding],
    borderRadius: tokens.radii[radius],
    backgroundColor: tone.backgroundColor,
    borderColor: tone.borderColor,
    boxShadow: tokens.shadows.hairline,
  };
}

export function Card(props: CardProps) {
  const { children, padding = 'space5', radius = 'card', style } = props;
  const tokens = useTokens();
  if (props.onPress === undefined) {
    return (
      <View
        style={[styles.card, frame(tokens, padding, radius, false), style]}
        accessibilityLabel={props.accessibilityLabel}
      >
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityHint={props.accessibilityHint}
      accessibilityState={{ disabled: false }}
      style={({ pressed }) => [styles.card, frame(tokens, padding, radius, pressed), style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
});
