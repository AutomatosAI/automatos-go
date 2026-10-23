// The owner said no while a request of Auto's still waits on a yes (F091-C2; the web's
// components/chatbot/withdraw-offer-card.tsx): the offer's words, then each request with Withdraw
// (denies its grant) and Keep it (sends nothing). Nothing is withdrawn without the click; each
// request settles on its own as 'Withdrawn.' or 'Kept — it still waits for your yes.'. A role that
// cannot act reads the requests with the D17 words in place of the buttons.

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Card, Text } from '../../ui';
import { GRANT_COPY } from '../strings';
import { grantRefusalText, type CardAccess } from './actions';
import { ReadOnlyNote, RefusalText } from './CardNotes';
import { withdrawAction, type WithdrawChoice } from './grants';
import type { SettleCard } from './model';
import { useCardAccess, useCardRequest } from './use-card-request';
import type { WithdrawRequestRow, WithdrawRow } from './view';

const MESSAGE_LEVEL = 6;
const LABEL_LEVEL = 4;

type RequestProps = {
  readonly request: WithdrawRequestRow;
  readonly access: CardAccess;
  readonly onSettled: SettleCard;
};

function RequestLine({ request, access, onSettled }: RequestProps) {
  const { spacing } = useTokens();
  const call = useCardRequest(request.key, onSettled, grantRefusalText);
  const choose = (choice: WithdrawChoice) => {
    const action = withdrawAction(choice, request.grantId);
    if (action.kind === 'settle') onSettled(request.key, action.outcome);
    else call.run(action.call);
  };
  const open = request.settled === null && access.canAct;
  return (
    <View style={{ gap: spacing.space2 }}>
      <Text level={LABEL_LEVEL}>{request.label}</Text>
      {request.settled ? (
        <Text level={MESSAGE_LEVEL} tone="muted" accessibilityLiveRegion="polite">
          {request.settled}
        </Text>
      ) : null}
      {open ? (
        <View style={[styles.actions, { gap: spacing.space3 }]}>
          <Button
            label={GRANT_COPY.withdraw}
            onPress={() => choose('withdraw')}
            size="sm"
            busy={call.busy}
          />
          <Button
            label={GRANT_COPY.keep}
            onPress={() => choose('keep')}
            size="sm"
            variant="outline"
            disabled={call.busy}
          />
        </View>
      ) : null}
      <RefusalText text={call.error} />
    </View>
  );
}

export type WithdrawOfferCardProps = {
  readonly card: WithdrawRow;
  readonly onSettled: SettleCard;
};

export function WithdrawOfferCard({ card, onSettled }: WithdrawOfferCardProps) {
  const { spacing } = useTokens();
  const access = useCardAccess('approve');
  const waiting = card.requests.some((request) => request.settled === null);
  return (
    <Card padding="space5" style={{ gap: spacing.space3 }}>
      <Text variant="mono" tone="muted" accessibilityRole="header">
        {GRANT_COPY.withdrawEyebrow}
      </Text>
      <Text level={MESSAGE_LEVEL} tone="muted">
        {card.message}
      </Text>
      {card.requests.map((request) => (
        <RequestLine key={request.key} request={request} access={access} onSettled={onSettled} />
      ))}
      {waiting ? <ReadOnlyNote text={access.note} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
