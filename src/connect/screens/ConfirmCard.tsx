// The confirm card (KC8): where this phone is about to pair, before anything is sent. The server's
// name, its edition in words, the address that answered (every call goes there, KC5) and the
// address the server lists when that is another one; the unencrypted home network note over
// http:// (D-HTTPS: a word chip and its sentence, not only a colour); KC16's data note. Then Pair
// and Back. While POST /pair runs nothing can be pressed (its answer is the token, sent once); a
// failed pairing shows its words and fix, never a status code, with Try again or, after a wrong or
// spent code, Enter a new code.

import { StyleSheet, View } from 'react-native';

import { StepNote } from '../../auth/screens/StepNote';
import { useTokens } from '../../styles/theme';
import { Button, Card, Chip, Divider, Text } from '../../ui';
import { CONFIRM_COPY } from '../strings';
import type { CardView, ConfirmView } from './connect-view';

const NAME_LEVEL = 3;
const VALUE_LEVEL = 2;
const NOTE_LEVEL = 3;

type RowProps = { readonly label: string; readonly value: string; readonly note?: string };

function Row({ label, value, note }: RowProps) {
  const { spacing } = useTokens();
  return (
    <View
      style={{ gap: spacing.space1, paddingVertical: spacing.space3 }}
      accessible
      accessibilityLabel={[`${label}: ${value}`, note].filter(Boolean).join('. ')}
    >
      <Text variant="eyebrow">{label}</Text>
      <Text level={VALUE_LEVEL} selectable>
        {value}
      </Text>
      {note ? (
        <Text level={NOTE_LEVEL} tone="muted">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function InsecureNote({ note }: { readonly note: NonNullable<CardView['insecureNote']> }) {
  const { spacing } = useTokens();
  return (
    <View
      style={{ gap: spacing.space2, paddingVertical: spacing.space3 }}
      accessible
      accessibilityLabel={`${note.title}. ${note.message}`}
    >
      <Chip label={note.title} tone="warning" />
      <Text level={NOTE_LEVEL} tone="warning">
        {note.message}
      </Text>
    </View>
  );
}

function ServerDetails({ card }: { readonly card: CardView }) {
  const { spacing } = useTokens();
  return (
    <Card padding="space6">
      <Text
        variant="title"
        level={NAME_LEVEL}
        accessibilityRole="header"
        style={{ paddingBottom: spacing.space2 }}
      >
        {card.serverName}
      </Text>
      <Row label={CONFIRM_COPY.edition} value={card.edition} />
      <Divider />
      <Row label={CONFIRM_COPY.address} value={card.address} />
      {card.listedAddress ? (
        <>
          <Divider />
          <Row
            label={CONFIRM_COPY.listedAddress}
            value={card.listedAddress}
            note={CONFIRM_COPY.listedAddressNote}
          />
        </>
      ) : null}
      {card.insecureNote ? (
        <>
          <Divider />
          <InsecureNote note={card.insecureNote} />
        </>
      ) : null}
      <Divider />
      <Text level={NOTE_LEVEL} tone="muted" style={{ paddingTop: spacing.space3 }}>
        {card.dataNote}
      </Text>
    </Card>
  );
}

export type ConfirmCardProps = {
  readonly view: ConfirmView;
  /** Pair, or Try again. */
  readonly onConfirm: () => void;
  readonly onBack: () => void;
};

export function ConfirmCard({ view, onConfirm, onBack }: ConfirmCardProps) {
  const { spacing } = useTokens();
  const primary = view.primaryAction === 'back' ? onBack : onConfirm;
  return (
    <View style={[styles.confirm, { gap: spacing.space5 }]}>
      <ServerDetails card={view.card} />
      {view.failure ? <StepNote note={{ tone: 'error', text: view.failure }} /> : null}
      <Button
        label={view.primaryLabel}
        onPress={primary}
        busy={view.pairing}
        accessibilityHint={view.pairing ? CONFIRM_COPY.pairing : undefined}
        fullWidth
      />
      {view.showBack ? (
        <Button label={CONFIRM_COPY.back} onPress={onBack} variant="ghost" fullWidth />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  confirm: { alignSelf: 'stretch' },
});
