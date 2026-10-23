// The user's message (D72): a right-hand grey box as the web draws it, primary at 10 % with a 1 pt
// border, cream words in Dark and ink in Light, 10 pt radius, never closer than 48 pt to the left
// edge; the files sent with it named under the words. The words are the thread's 16/24; the files
// line keeps the default ink, since the muted ink is 4.499:1 on this box in Light.

import { View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { CHAT_COPY } from '../strings';
import type { UserRow } from '../view-model';
import { bubbleStyle } from './thread-look';

const FILES_LEVEL = 6;

export type UserBubbleProps = { readonly row: UserRow };

export function UserBubble({ row }: UserBubbleProps) {
  const tokens = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={row.accessibilityLabel}
      style={bubbleStyle(tokens, 'user')}
    >
      {row.text ? (
        <Text variant="thread" selectable>
          {row.text}
        </Text>
      ) : null}
      {row.files.length > 0 ? (
        <Text level={FILES_LEVEL}>{`${CHAT_COPY.attached}: ${row.files.join(', ')}`}</Text>
      ) : null}
    </View>
  );
}
