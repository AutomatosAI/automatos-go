// A row's status (PRD-268 §6.12.3 'Status row', US-G05): the state as a glyph AND a word (never
// colour alone, D-A11Y), the server's next step as a '▸' line, and Try again when the row offers a
// retry the role may send. StateMark is the glyph and word (a board card's and the ticket sheet's
// kind row draw it where the board's dot would be); StatusBlock is the next step and Try again
// under the title, with the mark first where no kind row carries it (Questions). Every layout
// draws it: HUD its glyph role and its word in capitals (its label face), Arcade HUD's glyph and
// word in the state's colour role, Studio, a theme and Play the state's colour role (row-status.ts
// stateMark). What it says is row-status.ts's.

import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';

import type { RetryKind } from '../../api/row-status';
import { GLYPHS, type StatusState } from '../../styles/dress/status-glyphs';
import { useDress } from '../../styles/dress/use-dress';
import { useTokens } from '../../styles/theme';
import { Button, Text } from '../../ui';
import type { TextLevel } from '../../ui/variants';
import { STATUS_ROW_COPY } from '../strings';
import { stateMark, type RowStatusView } from './row-status';
import type { RetryControl } from './use-retry';

/** The next step at Body 5 (12), muted; 6 between the line and Try again. */
const NEXT_STEP = Object.freeze({ level: 5 as TextLevel, gap: 'space3' as const });

/** The custom action VoiceOver offers on a card that is one button (TicketCard). */
export const RETRY_ACTION_NAME = 'retry';

export function StateMark({ state }: { readonly state: StatusState }) {
  const { colours, scheme, spacing } = useTokens();
  const dress = useDress();
  const spec = stateMark(state, dress.status === 'glyph', scheme, dress.glyphPaint);
  return (
    <View
      style={[styles.mark, { gap: spacing.space1 }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={spec.word}
    >
      <Text variant="mono" style={{ color: colours[spec.glyphToken] }}>
        {spec.glyph}
      </Text>
      <Text variant="mono" style={{ color: colours[spec.wordToken] }}>
        {spec.word}
      </Text>
    </View>
  );
}

/** Try again as VoiceOver's action on a card that is one button; none when not offered. */
export function retryAccessibility(status: RowStatusView | null, retry: RetryControl) {
  if (!status?.retry || !retry.offered) return {};
  return {
    accessibilityActions: [{ name: RETRY_ACTION_NAME, label: STATUS_ROW_COPY.tryAgain }],
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === RETRY_ACTION_NAME) retry.run();
    },
  };
}

export type StatusBlockProps = {
  readonly status: RowStatusView;
  readonly retry: RetryControl;
  /** Draw the state's mark first (Questions: no kind row carries it). */
  readonly withMark?: boolean;
  /**
   * Inside a card that is one button (TicketCard): the card offers Try again as its own action
   * (retryAccessibility), so the visible button is kept out of the accessibility tree.
   */
  readonly retryIsCardAction?: boolean;
};

type TryAgainProps = {
  readonly kind: RetryKind;
  readonly retry: RetryControl;
  readonly hidden: boolean;
};

/** Try again, out of the accessibility tree when the card already offers it as its action. */
function TryAgain({ kind, retry, hidden }: TryAgainProps) {
  return (
    <View
      style={styles.start}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    >
      <Button
        label={STATUS_ROW_COPY.tryAgain}
        variant="outline"
        size="sm"
        busy={retry.busy}
        onPress={retry.run}
        accessibilityHint={STATUS_ROW_COPY.tryAgainHint[kind]}
      />
    </View>
  );
}

export function StatusBlock({
  status,
  retry,
  withMark = false,
  retryIsCardAction = false,
}: StatusBlockProps) {
  const { spacing } = useTokens();
  const kind = status.retry?.kind;
  return (
    <View style={{ gap: spacing[NEXT_STEP.gap] }}>
      {withMark || status.next ? (
        <View
          accessible
          accessibilityLabel={status.accessibilityLabel}
          style={{ gap: spacing.space1 }}
        >
          {withMark ? <StateMark state={status.state} /> : null}
          {status.next ? (
            <Text level={NEXT_STEP.level} tone="muted">
              {`${GLYPHS.running} ${status.next}`}
            </Text>
          ) : null}
        </View>
      ) : null}
      {kind && retry.offered ? (
        <TryAgain kind={kind} retry={retry} hidden={retryIsCardAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { flexDirection: 'row', alignItems: 'center' },
  start: { alignSelf: 'flex-start' },
});
