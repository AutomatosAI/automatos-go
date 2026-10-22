// One of Auto's messages (the handoff's thread): the 20 pt ink 'A' mark and the mono 'AUTO' label,
// then the answer as plain 14/1.55 paragraphs with no bubble (KC5), the tool lines, 'What Auto did',
// any notice (a limit, a file Auto could not open, a saved failure) and the cards the reply raised.

import { StyleSheet, View } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import type { SettleCard } from '../cards/model';
import { ThreadCards } from '../cards/ThreadCards';
import { CHAT_COPY } from '../strings';
import type { AutoRow } from '../view-model';
import { ReceiptsCard } from './ReceiptsCard';
import { ToolLines } from './ToolLines';
import { TurnNotice } from './TurnNotice';

const MARK_SIZE = 20;
const MARK_LEVEL = 6;

function AutoHeader() {
  const { colours, radii, spacing } = useTokens();
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={CHAT_COPY.autoSaid}
      style={[styles.header, { gap: spacing.space2 }]}
    >
      <View
        style={[styles.mark, { backgroundColor: colours.primary, borderRadius: radii.segment }]}
      >
        <Text variant="title" level={MARK_LEVEL} tone="inverse">
          {CHAT_COPY.autoMark}
        </Text>
      </View>
      <Text variant="mono" tone="muted">
        {CHAT_COPY.autoLabel}
      </Text>
    </View>
  );
}

export type AutoMessageProps = {
  readonly row: AutoRow;
  readonly onLink: (target: WebLinkTarget) => void;
  /** Asks the last message again, for a notice that offers it. */
  readonly onRetry?: () => void;
  /** Records what the user did with one of the reply's cards. */
  readonly onCard: SettleCard;
};

export function AutoMessage({ row, onLink, onRetry, onCard }: AutoMessageProps) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space3 }}>
      <AutoHeader />
      {row.paragraphs.map((paragraph, index) => (
        // paragraphs carry no id and a message's paragraphs never reorder
        <Text key={`${index}-${paragraph.length}`} selectable>
          {paragraph}
        </Text>
      ))}
      <ToolLines lines={row.toolLines} />
      {row.receipts ? <ReceiptsCard receipts={row.receipts} onLink={onLink} /> : null}
      {row.notices.map((notice) => (
        <TurnNotice key={notice.key} notice={notice} onRetry={onRetry} />
      ))}
      <ThreadCards cards={row.cards} onSettled={onCard} onLink={onLink} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
