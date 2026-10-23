// The verdict on a ticket in Review (D-BOARD, PRD-252 R2): the line that says what approving does,
// then Send back and Approve side by side. Send back opens the note ('What's wrong?'), which must
// have words before the second Send back is enabled; Cancel closes it. A refusal shows in the
// sheet in the server's words or the taxonomy's (a toast would sit under the sheet's Modal). The
// buttons, labels and enabled states are actions.ts's verdictView; nothing shows without a role
// that may approve (roleCan).

import { StyleSheet, View } from 'react-native';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import Undo2 from 'lucide-react-native/icons/undo-2';

import { useTokens } from '../../styles/theme';
import { Button, Text, TextField } from '../../ui';
import type { TicketDetail } from '../board/schemas';
import { SEND_BACK_MAX_CHARS } from '../board/verdict';
import { TICKET_COPY } from '../strings';
import { approveWords, verdictView, type TicketActions, type VerdictView } from './actions';
import { VERDICT } from './chrome';
import { useVerdict } from './use-ticket';

type VerdictState = ReturnType<typeof useVerdict>;

type PanelProps = { readonly view: VerdictView; readonly verdict: VerdictState };

function NoteField({ view, verdict }: PanelProps) {
  return (
    <TextField
      label={TICKET_COPY.note.label}
      placeholder={TICKET_COPY.note.placeholder}
      helper={TICKET_COPY.note.helper}
      error={view.note.error ?? undefined}
      value={verdict.note}
      onChangeText={verdict.setNote}
      maxLength={SEND_BACK_MAX_CHARS}
      disabled={verdict.busy}
      multiline
      autoFocus
    />
  );
}

function VerdictButtons({ view, verdict }: PanelProps) {
  const { spacing } = useTokens();
  const noting = view.note.open;
  return (
    <View style={[styles.buttons, { gap: spacing[VERDICT.buttonGap] }]}>
      {view.secondary ? (
        <View style={styles.button}>
          <Button
            label={view.secondary.label}
            variant="outline"
            icon={noting ? undefined : Undo2}
            disabled={view.secondary.disabled}
            onPress={() => verdict.choose(noting ? 'idle' : 'note')}
            fullWidth
          />
        </View>
      ) : null}
      {view.primary ? (
        <View style={styles.button}>
          <Button
            label={view.primary.label}
            icon={noting ? Undo2 : CircleCheck}
            disabled={view.primary.disabled}
            busy={verdict.busy}
            onPress={noting ? verdict.sendBack : verdict.approve}
            fullWidth
          />
        </View>
      ) : null}
    </View>
  );
}

export type VerdictProps = {
  readonly ticket: TicketDetail;
  readonly actions: TicketActions;
  /** The decision went through: the sheet closes. */
  readonly onDecided: () => void;
};

export function Verdict({ ticket, actions, onDecided }: VerdictProps) {
  const { spacing } = useTokens();
  const verdict = useVerdict(ticket, onDecided);
  const words = approveWords(ticket);
  const view = verdictView(actions, verdict.mode, verdict.note, verdict.busy, words.label);
  // a refusal stays in sight after the ticket it refused has moved on (its buttons are gone)
  if (!view.primary && !view.secondary && !verdict.refusal) return null;
  const noting = view.note.open;
  return (
    <View style={{ gap: spacing[VERDICT.gap] }}>
      {view.primary && !noting ? (
        <Text level={VERDICT.effectLevel} tone={VERDICT.effectTone}>
          {words.effect}
        </Text>
      ) : null}
      {noting ? <NoteField view={view} verdict={verdict} /> : null}
      {verdict.refusal ? (
        <Text level={VERDICT.refusalLevel} tone={VERDICT.refusalTone} accessibilityRole="alert">
          {verdict.refusal}
        </Text>
      ) : null}
      <VerdictButtons view={view} verdict={verdict} />
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row' },
  button: { flex: 1 },
});
