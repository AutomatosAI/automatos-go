// A notice in the thread: a limit Auto reached, a file it could not open, a stop, a stop that did
// not reach the server, or a failed turn, always in the kit's own words (view-model.ts). Drawn as a
// quiet line, never a box of its own (D72): inside Auto's box (AutoMessage; MessageList's Auto box
// for a notice row that starts Auto's run), or bare under the thinking pill. The mark in its tone
// (✕ for a failure) and the words in the muted ink, then Try again under the words where it is
// offered. Only the newest failure the user can ask again offers Try again (the vendored retry.ts
// rule). A failure is announced as an alert; screen readers hear the notice's word and its words,
// never the mark.

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Text } from '../../ui';
import { CHAT_COPY } from '../strings';
import { MARK_COLOURS, type Notice } from '../view-model';

const TEXT_LEVEL = 4;
const MARK_WIDTH = 12;
const ALERT_KINDS: ReadonlySet<Notice['kind']> = new Set(['failed', 'stopFailed']);

export type TurnNoticeProps = {
  readonly notice: Notice;
  /** Asks the last message again; offered only when the notice allows it. */
  readonly onRetry?: () => void;
};

export function TurnNotice({ notice, onRetry }: TurnNoticeProps) {
  const { colours, spacing } = useTokens();
  const alert = ALERT_KINDS.has(notice.kind);
  return (
    <View style={{ gap: spacing.space2 }}>
      <View
        accessible
        accessibilityRole={alert ? 'alert' : 'text'}
        accessibilityLiveRegion={alert ? 'polite' : 'none'}
        accessibilityLabel={notice.accessibilityLabel}
        style={[styles.line, { gap: spacing.space3 }]}
      >
        <Text variant="mono" style={[styles.mark, { color: colours[MARK_COLOURS[notice.tone]] }]}>
          {notice.mark}
        </Text>
        <Text level={TEXT_LEVEL} tone="muted" style={styles.text}>
          {notice.text}
        </Text>
      </View>
      {notice.retry && onRetry ? (
        <View style={[styles.actions, { paddingLeft: MARK_WIDTH + spacing.space3 }]}>
          <Button label={CHAT_COPY.retry} onPress={onRetry} variant="outline" size="sm" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'baseline' },
  mark: { width: MARK_WIDTH },
  text: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row' },
});
