// One line per tool call (components/play/chat/tool-lines.tsx): a spinner and "Searching the web:
// '…'" while it runs, "✓ Searched the web · 3 results · 2.1 s" when done, a failure in words,
// "Waiting for you" on an ask for the owner's click (never drawn as failed). Each line is one
// element to screen readers, read as its status word and its words (§4.6), never as the mark.

import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { CHAT_COPY } from '../strings';
import { MARK_COLOURS, type ToolLineRow } from '../view-model';

const LINE_LEVEL = 6;
const MARK_WIDTH = 12;

function ToolLine({ row }: { readonly row: ToolLineRow }) {
  const { colours, spacing } = useTokens();
  const colour = colours[MARK_COLOURS[row.tone]];
  return (
    <View
      accessible
      accessibilityLabel={row.accessibilityLabel}
      style={[styles.line, { gap: spacing.space3 }]}
    >
      <View style={styles.mark}>
        {row.mark === null ? (
          <ActivityIndicator size="small" color={colour} />
        ) : (
          <Text variant="mono" style={{ color: colour }}>
            {row.mark}
          </Text>
        )}
      </View>
      <Text
        level={LINE_LEVEL}
        tone={row.tone === 'muted' ? 'muted' : 'default'}
        style={styles.text}
      >
        {row.text}
      </Text>
    </View>
  );
}

export type ToolLinesProps = { readonly lines: readonly ToolLineRow[] };

export function ToolLines({ lines }: ToolLinesProps) {
  const { spacing } = useTokens();
  if (lines.length === 0) return null;
  return (
    <View accessibilityLabel={CHAT_COPY.toolLinesLabel} style={{ gap: spacing.space1 }}>
      {lines.map((row) => (
        <ToolLine key={row.key} row={row} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center' },
  mark: { width: MARK_WIDTH, alignItems: 'center' },
  text: { flex: 1, minWidth: 0 },
});
