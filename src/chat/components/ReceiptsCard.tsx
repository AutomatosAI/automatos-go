// 'What Auto did' (mirroring components/play/chat/receipts.tsx, a section with no frame): the mono
// title, one line per call with its mark (✓ olive, … waiting, ✕, –) and Play's tag, and the
// closing note. Drawn as a quiet block under the answer, never a box of its own: it sits inside
// Auto's box (AutoMessage, D72; the handoff's card is overruled, as TurnNotice's was). A line
// whose call touched a page opens it through the mapped link. Each line is one element to screen
// readers, read as its status word and its words (§4.6), never as the mark.

import { Pressable, StyleSheet, View } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { CHAT_COPY } from '../strings';
import { MARK_COLOURS, type ReceiptRow, type ReceiptsView } from '../view-model';

const LINE_LEVEL = 4;
const NOTE_LEVEL = 6;
const MARK_WIDTH = 12;

type LineProps = {
  readonly row: ReceiptRow;
  readonly onLink: (target: WebLinkTarget) => void;
};

function ReceiptLine({ row, onLink }: LineProps) {
  const { colours, spacing } = useTokens();
  const { link } = row;
  const words = (
    <View style={[styles.line, { gap: spacing.space3 }]}>
      <Text variant="mono" style={[styles.mark, { color: colours[MARK_COLOURS[row.tone]] }]}>
        {row.mark}
      </Text>
      <Text level={LINE_LEVEL} tone={link ? 'accent' : 'default'} style={styles.text}>
        {row.text}
      </Text>
      {row.badge ? (
        <Text variant="mono" tone="success">
          {row.badge}
        </Text>
      ) : null}
    </View>
  );
  if (!link) {
    return (
      <View accessible accessibilityLabel={row.accessibilityLabel}>
        {words}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => onLink(link)}
      accessibilityRole="link"
      accessibilityLabel={row.accessibilityLabel}
    >
      {words}
    </Pressable>
  );
}

export type ReceiptsCardProps = {
  readonly receipts: ReceiptsView;
  readonly onLink: (target: WebLinkTarget) => void;
};

export function ReceiptsCard({ receipts, onLink }: ReceiptsCardProps) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space2 }}>
      <Text variant="mono" tone="muted" accessibilityRole="header">
        {CHAT_COPY.receiptsTitle}
      </Text>
      {receipts.lines.map((row) => (
        <ReceiptLine key={row.key} row={row} onLink={onLink} />
      ))}
      {receipts.note ? (
        <Text level={NOTE_LEVEL} tone="muted">
          {receipts.note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'baseline' },
  mark: { width: MARK_WIDTH },
  text: { flex: 1, minWidth: 0 },
});
