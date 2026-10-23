// The address this sign-in is for, above the field on every step after the choice, so the user
// can see which account a code or password goes to (Start again changes it).

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { SIGN_IN_SCREEN_COPY } from '../strings';

const VALUE_LEVEL = 2;
const VALUE_WEIGHT = 500;

export type AccountLineProps = { readonly identifier: string };

export function AccountLine({ identifier }: AccountLineProps) {
  const { spacing } = useTokens();
  if (!identifier) return null;
  return (
    <View
      style={[styles.line, { gap: spacing.space1 }]}
      accessible
      accessibilityLabel={`${SIGN_IN_SCREEN_COPY.account}: ${identifier}`}
    >
      <Text variant="eyebrow">{SIGN_IN_SCREEN_COPY.account}</Text>
      <Text level={VALUE_LEVEL} weight={VALUE_WEIGHT} numberOfLines={2}>
        {identifier}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { alignSelf: 'stretch' },
});
