// Loading: the system spinner in --muted-foreground with its words ('Loading…'), centred in a
// block or inline in a row. Busy to VoiceOver, with the same words.

import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTokens } from '../styles/theme';
import { UI_COPY } from './strings';
import { Text } from './Text';

const LABEL_LEVEL = 3;

export type LoadingStateProps = {
  readonly label?: string;
  readonly inline?: boolean;
};

export function LoadingState({ label = UI_COPY.loading, inline = false }: LoadingStateProps) {
  const { colours, spacing } = useTokens();
  return (
    <View
      style={[
        inline ? styles.inline : styles.block,
        { gap: spacing.space3, padding: inline ? 0 : spacing.space9 },
      ]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator size="small" color={colours.mutedForeground} />
      <Text level={LABEL_LEVEL} tone="muted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center' },
});
