// The user's message (the handoff's thread): a right-hand ink bubble, cream text, 10 pt radius, at
// most 82 % of the row; the files sent with it named under the words.

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { CHAT_COPY } from '../strings';
import type { UserRow } from '../view-model';

const FILES_LEVEL = 6;

export type UserBubbleProps = { readonly row: UserRow };

export function UserBubble({ row }: UserBubbleProps) {
  const { colours, radii, spacing } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={row.accessibilityLabel}
      style={[
        styles.bubble,
        {
          backgroundColor: colours.primary,
          borderRadius: radii.panel,
          paddingVertical: spacing.space4,
          paddingHorizontal: spacing.space5,
          gap: spacing.space1,
        },
      ]}
    >
      {row.text ? (
        <Text tone="inverse" selectable>
          {row.text}
        </Text>
      ) : null}
      {row.files.length > 0 ? (
        <Text level={FILES_LEVEL} tone="inverse">
          {`${CHAT_COPY.attached}: ${row.files.join(', ')}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { alignSelf: 'flex-end', maxWidth: '82%' },
});
