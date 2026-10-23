// The Mission Auto suggests (the web's MissionSuggestionCard, drawn as the handoff's Mission card):
// the suggested goal, why a Mission, and 'File it' → POST /api/missions with the chat and its newest
// five messages; 'No thanks' puts it away. Filed, it says so in olive with its word and opens the
// Mission's page (Studio, in the system browser). A role that cannot file it reads it with the D17
// words, never a button the server would refuse.

import { Pressable, StyleSheet, View } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import { Button, Text } from '../../ui';
import { CARD_COPY } from '../strings';
import { createMission } from './api';
import type { CardAccess } from './actions';
import type { CardOutcome, SettleCard } from './model';
import { MissionFrame } from './MissionFrame';
import { ReadOnlyNote, RefusalText } from './CardNotes';
import { useCardAccess, useCardRequest, type CardRequest } from './use-card-request';
import type { SuggestionRow } from './view';

const BODY_LEVEL = 3;
const LINK_ARROW = '→';

function FiledLine({
  link,
  onLink,
}: {
  readonly link: WebLinkTarget | null;
  readonly onLink: (target: WebLinkTarget) => void;
}) {
  const { colours } = useTokens();
  const words = link
    ? `${CARD_COPY.filed} · ${CARD_COPY.openMission} ${LINK_ARROW}`
    : CARD_COPY.filed;
  const line = (
    <Text variant="mono" style={{ color: colours.olive }}>
      {words}
    </Text>
  );
  if (!link) return line;
  return (
    <Pressable onPress={() => onLink(link)} accessibilityRole="link" accessibilityLabel={words}>
      {line}
    </Pressable>
  );
}

type FooterProps = {
  readonly card: SuggestionRow;
  readonly access: CardAccess;
  readonly request: CardRequest;
  readonly onFile: () => void;
  readonly onDismiss: () => void;
  readonly onLink: (target: WebLinkTarget) => void;
};

function SuggestionFooter({ card, access, request, onFile, onDismiss, onLink }: FooterProps) {
  const { spacing } = useTokens();
  if (card.outcome.state === 'filed') return <FiledLine link={card.missionLink} onLink={onLink} />;
  if (!access.canAct) return <ReadOnlyNote text={access.note} />;
  return (
    <>
      <View style={[styles.actions, { gap: spacing.space3 }]}>
        <Button label={CARD_COPY.fileIt} onPress={onFile} size="sm" busy={request.busy} />
        <Button
          label={CARD_COPY.noThanks}
          onPress={onDismiss}
          size="sm"
          variant="ghost"
          disabled={request.busy}
        />
      </View>
      <RefusalText text={request.error} />
    </>
  );
}

export type MissionSuggestionCardProps = {
  readonly card: SuggestionRow;
  readonly onSettled: SettleCard;
  readonly onLink: (target: WebLinkTarget) => void;
};

export function MissionSuggestionCard({ card, onSettled, onLink }: MissionSuggestionCardProps) {
  const { spacing } = useTokens();
  const access = useCardAccess('chat');
  const request = useCardRequest(card.key, onSettled);
  const file = () =>
    request.run(async (client): Promise<CardOutcome> => {
      const mission = await createMission(client, card.request);
      return { state: 'filed', mission };
    });
  const dismiss = () => onSettled(card.key, { state: 'dismissed' });
  return (
    <MissionFrame
      eyebrow={CARD_COPY.suggestionEyebrow}
      chip={card.complexity}
      title={card.goal}
      footer={
        <SuggestionFooter
          card={card}
          access={access}
          request={request}
          onFile={file}
          onDismiss={dismiss}
          onLink={onLink}
        />
      }
    >
      <View style={{ paddingHorizontal: spacing.space6, paddingBottom: spacing.space5 }}>
        <Text level={BODY_LEVEL} tone="muted">
          {CARD_COPY.suggestionBody}
        </Text>
      </View>
    </MissionFrame>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center' },
});
