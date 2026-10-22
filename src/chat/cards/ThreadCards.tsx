// Auto's cards where the thread places them (inside a reply, or after the saved messages when the
// reply was never saved): each card by its kind. The outcome goes to the thread (onSettled), so a
// card drawn again keeps it.

import { View } from 'react-native';

import type { WebLinkTarget } from '../../navigation/web-links';
import { useTokens } from '../../styles/theme';
import type { SettleCard } from './model';
import { MissionSuggestionCard } from './MissionSuggestionCard';
import { PlanApprovalCard } from './PlanApprovalCard';
import type { CardRow } from './view';

export type ThreadCardsProps = {
  readonly cards: readonly CardRow[];
  readonly onSettled: SettleCard;
  readonly onLink: (target: WebLinkTarget) => void;
};

export function ThreadCards({ cards, onSettled, onLink }: ThreadCardsProps) {
  const { spacing } = useTokens();
  if (cards.length === 0) return null;
  return (
    <View style={{ gap: spacing.space3 }}>
      {cards.map((card) =>
        card.kind === 'suggestion' ? (
          <MissionSuggestionCard key={card.key} card={card} onSettled={onSettled} onLink={onLink} />
        ) : (
          <PlanApprovalCard key={card.key} card={card} onSettled={onSettled} />
        ),
      )}
    </View>
  );
}
