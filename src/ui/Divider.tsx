// A 1 pt --border rule (at-sep), across or down, optionally inset from the leading edge. Hidden
// from VoiceOver: it separates, it says nothing.

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../styles/theme';
import type { SpaceName } from '../styles/tokens';

const RULE = 1;

export type DividerProps = {
  readonly vertical?: boolean;
  readonly inset?: SpaceName;
};

export function Divider({ vertical = false, inset }: DividerProps) {
  const { colours, spacing } = useTokens();
  const offset = inset === undefined ? 0 : spacing[inset];
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[
        vertical ? styles.vertical : styles.horizontal,
        { backgroundColor: colours.border },
        vertical ? { marginTop: offset } : { marginLeft: offset },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  horizontal: { height: RULE, alignSelf: 'stretch' },
  vertical: { width: RULE, alignSelf: 'stretch' },
});
