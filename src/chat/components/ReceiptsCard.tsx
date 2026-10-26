// 'What Auto did' (mirroring components/play/chat/receipts.tsx, a section with no frame): the mono
// title, one line per call with its mark (✓ olive, … waiting, ✕, –) and Play's tag, and the
// closing note. Drawn as a quiet block under the answer, never a box of its own: it sits inside
// Auto's box (AutoMessage, D72; the handoff's card is overruled, as TurnNotice's was). A line
// whose call touched a page opens it through the mapped link. Each line is one element to screen
// readers, read as its status word and its words (§4.6), never as the mark. A link's slop reaches
// toward 44 pt, but only half the gap toward a link beside it (stackedSlop), so a tap between two
// links never opens the wrong page.

import { Pressable, StyleSheet, View } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { stackedSlop, type HitSlop } from '../../ui/paint';
import { textRole } from '../../ui/variants';
import { CHAT_COPY } from '../strings';
import { MARK_COLOURS, type ReceiptRow, type ReceiptsView } from '../view-model';

const LINE_LEVEL = 4;
const NOTE_LEVEL = 6;
const MARK_WIDTH = 12;
const LINE_ROLE = textRole('body', LINE_LEVEL);

type LineProps = {
  readonly row: ReceiptRow;
  readonly onLink: (target: WebLinkTarget) => void;
  /** A link's slop: toward 44 pt, half the gap toward a link beside it. */
  readonly slop: HitSlop;
};

function ReceiptLine({ row, onLink, slop }: LineProps) {
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
      hitSlop={slop}
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
  const { spacing, type } = useTokens();
  const gap = spacing.space2;
  const { lines } = receipts;
  const slopAt = (index: number) =>
    stackedSlop(type[LINE_ROLE].lineHeight, gap, {
      above: Boolean(lines[index - 1]?.link),
      below: Boolean(lines[index + 1]?.link),
    });
  return (
    <View style={{ gap }}>
      <Text variant="mono" tone="muted" accessibilityRole="header">
        {CHAT_COPY.receiptsTitle}
      </Text>
      {lines.map((row, index) => (
        <ReceiptLine key={row.key} row={row} onLink={onLink} slop={slopAt(index)} />
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
