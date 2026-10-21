// A status as a dot AND a word ('● IN PROGRESS'): every colour status also has a word (§4.6), so
// the colour is never the only signal. The dot's token and the word come from statusPip(); a word
// may be given for a wider phrase ('Streaming live').

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../styles/theme';
import { Text } from './Text';
import { DOT_SIZE, statusPip, type PipStatus, type TextTone } from './variants';

export type StatusPipProps = {
  /** A PipStatus; a status this version doesn't know shows muted with its own word. */
  readonly status: PipStatus | (string & Record<never, never>);
  readonly word?: string;
  readonly tone?: TextTone;
};

export function StatusPip({ status, word, tone = 'muted' }: StatusPipProps) {
  const { colours, radii, spacing } = useTokens();
  const spec = statusPip(status);
  const said = word ?? spec.word;
  return (
    <View
      style={[styles.pip, { gap: spacing.space1 }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={said}
    >
      <View
        style={[styles.dot, { backgroundColor: colours[spec.tokenKey], borderRadius: radii.full }]}
      />
      <Text variant="mono" tone={tone}>
        {said}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pip: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: DOT_SIZE, height: DOT_SIZE },
});
