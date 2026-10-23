// One older chat (the web's Play row): the serif title on one line with the 'Auto' word when Auto
// started it and the mono time at the end, the newest message under it in two muted lines. The row
// is one button whose label carries every part (rows.ts). FOUNDATION GAP: the foundation's ListRow
// takes no accessibility label and reads its trailing slot to no one, so the time and the Auto word
// would never reach VoiceOver; this row is feature-local (KC2).

import { Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Chip, Text } from '../../ui';
import { MIN_TOUCH } from '../../ui/paint';
import { cardPaint } from '../../ui/variants';
import { HISTORY_COPY } from '../strings';
import type { ChatRowView } from './rows';

const TITLE_LEVEL = 6;
const PREVIEW_LEVEL = 6;
const PREVIEW_LINES = 2;

export type ChatRowProps = {
  readonly row: ChatRowView;
  readonly onOpen: (chatId: string) => void;
};

export function ChatRow({ row, onOpen }: ChatRowProps) {
  const { colours, radii, spacing } = useTokens();
  return (
    <Pressable
      onPress={() => onOpen(row.id)}
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
      accessibilityHint={HISTORY_COPY.openHint}
      style={({ pressed }) => [
        styles.row,
        {
          gap: spacing.space1,
          paddingVertical: spacing.space4,
          paddingHorizontal: spacing.space4,
          borderRadius: radii.control,
        },
        pressed ? { backgroundColor: cardPaint(colours, true).backgroundColor } : null,
      ]}
    >
      <View style={[styles.top, { gap: spacing.space3 }]}>
        <Text variant="title" level={TITLE_LEVEL} numberOfLines={1} style={styles.title}>
          {row.title}
        </Text>
        {row.auto ? <Chip label={HISTORY_COPY.autoMarker} tone="warning" /> : null}
        {row.time ? (
          <Text variant="mono" tone="muted" numberOfLines={1}>
            {row.time}
          </Text>
        ) : null}
      </View>
      {row.preview ? (
        <Text level={PREVIEW_LEVEL} tone="muted" numberOfLines={PREVIEW_LINES}>
          {row.preview}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, minWidth: 0 },
});
