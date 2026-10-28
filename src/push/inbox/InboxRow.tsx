// One notification in the inbox: the unread dot, the serif title, the time in mono at the end, and
// the message under them in muted lines. The row is one button whose label carries every part
// ('Unread' first when it is: model.ts), so the dot is heard as well as drawn; the row a push asked
// for is marked selected and tinted like a pressed row.

import { Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { MIN_TOUCH } from '../../ui/paint';
import { cardPaint } from '../../ui/variants';
import { PUSH_INBOX_COPY } from '../strings';
import type { InboxRowView } from './model';

const TITLE_LEVEL = 6;
const MESSAGE_LEVEL = 6;
const TITLE_LINES = 2;
const MESSAGE_LINES = 3;
const DOT = 8;

export type InboxRowProps = {
  readonly row: InboxRowView;
  readonly onOpen: (id: string) => void;
};

function UnreadDot({ shown }: { readonly shown: boolean }) {
  const { colours } = useTokens();
  return (
    <View
      style={[styles.dot, { backgroundColor: shown ? colours.accent : 'transparent' }]}
      importantForAccessibility="no"
      accessibilityElementsHidden
    />
  );
}

export function InboxRow({ row, onOpen }: InboxRowProps) {
  const { colours, radii, spacing } = useTokens();
  const tint = { backgroundColor: cardPaint(colours, true).backgroundColor };
  return (
    <Pressable
      onPress={() => onOpen(row.id)}
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
      accessibilityHint={PUSH_INBOX_COPY.openHint}
      accessibilityState={{ selected: row.focused }}
      style={({ pressed }) => [
        styles.row,
        {
          gap: spacing.space3,
          paddingVertical: spacing.space4,
          paddingHorizontal: spacing.space4,
          borderRadius: radii.control,
        },
        pressed || row.focused ? tint : null,
      ]}
    >
      <UnreadDot shown={row.unread} />
      <View style={[styles.body, { gap: spacing.space1 }]}>
        <View style={[styles.top, { gap: spacing.space3 }]}>
          <Text
            variant="title"
            level={TITLE_LEVEL}
            numberOfLines={TITLE_LINES}
            style={styles.title}
          >
            {row.title}
          </Text>
          {row.time ? (
            <Text variant="mono" tone="muted" numberOfLines={1}>
              {row.time}
            </Text>
          ) : null}
        </View>
        {row.message ? (
          <Text level={MESSAGE_LEVEL} tone="muted" numberOfLines={MESSAGE_LINES}>
            {row.message}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, marginTop: DOT },
  body: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { flex: 1, minWidth: 0 },
});
