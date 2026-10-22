// Auto's cards in a thread (D-CARDS), pure: what a turn raises (the Mission suggestion frame and
// each mission_approval tool-data card, read by the vendored suggestion.ts and approvals.ts), filed
// on the thread as they arrive with the outcome the user gave them. The saved reply carries no card
// (api/chat.py saves text, receipts and task cards only), so a card outlives its live turn here:
// it stays inside the reply that raised it, keeps its outcome when it moves from the live reply to
// the saved one, and sits after the thread when its reply was never saved (Play's loose approvals,
// components/play/chat/approval-cards.tsx). Nothing here is persisted (D-CACHE).

import type { TurnState } from '../../core/turn-reducer';
import type { MissionApprovalWidgetData } from '../../core/web/components/widgets/types';
import type { MissionSuggestion } from '../../core/web/lib/chat/suggestion';
import type { MissionRun, StoredMessage } from '../schemas';

export type ThreadCard =
  | { readonly kind: 'suggestion'; readonly suggestion: MissionSuggestion }
  | { readonly kind: 'plan'; readonly plan: MissionApprovalWidgetData };

/** open: waiting on the user; the rest are what the user did with it (the server agreed). */
export type CardOutcome =
  | { readonly state: 'open' }
  | { readonly state: 'dismissed' }
  | { readonly state: 'filed'; readonly mission: MissionRun }
  | { readonly state: 'approved' }
  | { readonly state: 'rejected' };

export type FiledCard = {
  readonly key: string;
  /** The saved messages before the turn that raised it (the live turn's `since`). */
  readonly since: number;
  readonly card: ThreadCard;
  readonly outcome: CardOutcome;
};

/** Records what the user did with a card once the server agreed (useThread's settleCard). */
export type SettleCard = (key: string, outcome: CardOutcome) => void;

/** Where a filed card is drawn: inside a saved reply (its index), the live reply, or after both. */
export type CardPlace = number | 'live' | 'loose';

export const OPEN: CardOutcome = Object.freeze({ state: 'open' });

/** A suggestion is one per turn; a plan is one per Mission, however often it is raised. */
function keyOf(card: ThreadCard, since: number): string {
  return card.kind === 'suggestion' ? `suggestion-${since}` : `mission-${card.plan.mission_id}`;
}

/** The cards a turn has raised so far: its suggestion, then each plan, in arrival order. */
export function raisedCards(turn: TurnState): ThreadCard[] {
  const suggestion: ThreadCard[] = turn.missionSuggestion
    ? [{ kind: 'suggestion', suggestion: turn.missionSuggestion }]
    : [];
  const plans = turn.approvals.flatMap((card): ThreadCard[] =>
    card.kind === 'mission' ? [{ kind: 'plan', plan: card.data }] : [],
  );
  return [...suggestion, ...plans];
}

/** `filed` with each raised card it does not hold yet, open, under `since`; the same array if none. */
export function fileCards(
  filed: readonly FiledCard[],
  raised: readonly ThreadCard[],
  since: number,
): readonly FiledCard[] {
  const known = new Set(filed.map((card) => card.key));
  const fresh = raised
    .map((card): FiledCard => ({ key: keyOf(card, since), since, card, outcome: OPEN }))
    .filter((card) => !known.has(card.key));
  return fresh.length === 0 ? filed : [...filed, ...fresh];
}

/** `filed` with one card's outcome; a card that is not open any more keeps the one it has. */
export function settleCard(
  filed: readonly FiledCard[],
  key: string,
  outcome: CardOutcome,
): readonly FiledCard[] {
  const settles = (card: FiledCard) => card.key === key && card.outcome.state === 'open';
  return filed.some(settles)
    ? filed.map((card) => (settles(card) ? { ...card, outcome } : card))
    : filed;
}

/**
 * The server opened a new chat for this turn (a stale id, D-STALE-CHAT): the earlier turns' cards
 * belong to the old chat and go; this turn's (raised from `since` on) move to `to`.
 */
export function rebaseCards(
  filed: readonly FiledCard[],
  since: number,
  to: number,
): readonly FiledCard[] {
  if (filed.length === 0) return filed;
  return filed
    .filter((card) => card.since >= since)
    .map((card) => ({ ...card, since: to, key: keyOf(card.card, to) }));
}

/**
 * Where each card is drawn: the first saved reply at or after its turn's start, else the live
 * reply when the card is the live turn's, else after the saved messages (its reply was never saved).
 */
export function placeCards(
  filed: readonly FiledCard[],
  shown: readonly StoredMessage[],
  liveSince: number | null,
): ReadonlyMap<CardPlace, readonly FiledCard[]> {
  const places = new Map<CardPlace, FiledCard[]>();
  for (const card of filed) {
    const place = placeOf(card, shown, liveSince);
    places.set(place, [...(places.get(place) ?? []), card]);
  }
  return places;
}

function placeOf(
  card: FiledCard,
  shown: readonly StoredMessage[],
  liveSince: number | null,
): CardPlace {
  if (liveSince !== null && card.since >= liveSince) return 'live';
  const reply = shown.findIndex((message, index) => index >= card.since && isReply(message));
  return reply < 0 ? 'loose' : reply;
}

const isReply = (message: StoredMessage) => message.role === 'assistant';
