// Auto's cards where the thread places them (inside a reply, or after the saved messages when the
// reply was never saved): each card by its kind. The outcome goes to the thread (onSettled), so a
// card drawn again keeps it.

import { View } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import type { SettleCard } from './model';
import { MissionSuggestionCard } from './MissionSuggestionCard';
import { PlanApprovalCard } from './PlanApprovalCard';
import { ToolApprovalCard } from './ToolApprovalCard';
import type { CardRow } from './view';
import { WithdrawOfferCard } from './WithdrawOfferCard';

export type ThreadCardsProps = {
  readonly cards: readonly CardRow[];
  readonly onSettled: SettleCard;
  readonly onLink: (target: WebLinkTarget) => void;
};

function ThreadCard({
  card,
  onSettled,
  onLink,
}: Omit<ThreadCardsProps, 'cards'> & {
  readonly card: CardRow;
}) {
  switch (card.kind) {
    case 'suggestion':
      return <MissionSuggestionCard card={card} onSettled={onSettled} onLink={onLink} />;
    case 'plan':
      return <PlanApprovalCard card={card} onSettled={onSettled} />;
    case 'tool':
      return <ToolApprovalCard card={card} onSettled={onSettled} />;
    case 'withdraw':
      return <WithdrawOfferCard card={card} onSettled={onSettled} />;
  }
}

export function ThreadCards({ cards, onSettled, onLink }: ThreadCardsProps) {
  const { spacing } = useTokens();
  if (cards.length === 0) return null;
  return (
    <View style={{ gap: spacing.space3 }}>
      {cards.map((card) => (
        <ThreadCard key={card.key} card={card} onSettled={onSettled} onLink={onLink} />
      ))}
    </View>
  );
}
