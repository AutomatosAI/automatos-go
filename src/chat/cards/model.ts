// Auto's cards in a thread (D-CARDS), pure: what a turn raises (the Mission suggestion frame, each
// mission_approval and tool_approval tool-data card, read by the vendored suggestion.ts and
// approvals.ts, and each request of a withdraw_offer frame), filed on the thread as they arrive with
// the outcome the user gave them. The saved reply carries no card (api/chat.py saves text, receipts
// and task cards only), so a card outlives its live turn here: it stays inside the reply that
// raised it, keeps its outcome when it moves from the live reply to the saved one, and sits after
// the thread when its reply was never saved (Play's loose approvals,
// components/play/chat/approval-cards.tsx). Nothing here is persisted (D-CACHE).

import type { ApiClient } from '../../api/client';
import type { ApprovalView } from '../../core/approval-view';
import type { TurnState } from '../../core/turn-reducer';
import type {
  MissionApprovalWidgetData,
  ToolApprovalWidgetData,
} from '../../core/web/components/widgets/types';
import type { MissionSuggestion } from '../../core/web/lib/chat/suggestion';
import type { WithdrawOffer } from '../../core/web/types';
import type { GrantRun, MissionRun, StoredMessage } from '../schemas';

/** One request of a withdraw offer: a grant still waiting on a yes. */
export type WithdrawRequest = WithdrawOffer['requests'][number];

export type ThreadCard =
  | { readonly kind: 'suggestion'; readonly suggestion: MissionSuggestion }
  /** `view`: the ApprovalView@1 core W2 sends beside the card (PRD-268 US-C20a), when it did. */
  | {
      readonly kind: 'plan';
      readonly plan: MissionApprovalWidgetData;
      readonly view?: ApprovalView;
    }
  | { readonly kind: 'tool'; readonly tool: ToolApprovalWidgetData; readonly view?: ApprovalView }
  /** One request of a withdraw offer; the view draws an offer's requests as one card. */
  | { readonly kind: 'withdraw'; readonly message: string; readonly request: WithdrawRequest };

/** open: waiting on the user; the rest are what the user did with it (the server agreed). */
export type CardOutcome =
  | { readonly state: 'open' }
  | { readonly state: 'dismissed' }
  | { readonly state: 'filed'; readonly mission: MissionRun }
  | { readonly state: 'approved' }
  | { readonly state: 'rejected' }
  /** The yes is recorded; `run` is what the resumed call did (null: the grant carried none). */
  | { readonly state: 'granted'; readonly run: GrantRun | null }
  | { readonly state: 'denied' }
  | { readonly state: 'withdrawn' }
  /** Keep it: nothing was sent, the request still waits on the server. */
  | { readonly state: 'kept' };

/** One card action against the server: the outcome it settles the card with once it agrees. */
export type CardCall = (client: ApiClient) => Promise<CardOutcome>;

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
export const DENIED: CardOutcome = Object.freeze({ state: 'denied' });
export const WITHDRAWN: CardOutcome = Object.freeze({ state: 'withdrawn' });
export const KEPT: CardOutcome = Object.freeze({ state: 'kept' });

/** The tool approval's key: the vendored approvals.ts names it by its grant. */
export const toolCardKey = (grantId: number) => `tool-${grantId}`;

/**
 * A suggestion is one per turn; a plan one per Mission and a tool approval one per grant, however
 * often they are raised; a withdraw request one per grant in the turn that offered it.
 */
function keyOf(card: ThreadCard, since: number): string {
  switch (card.kind) {
    case 'suggestion':
      return `suggestion-${since}`;
    case 'plan':
      return `mission-${card.plan.mission_id}`;
    case 'tool':
      return toolCardKey(card.tool.grant_id);
    case 'withdraw':
      return `withdraw-${since}-${card.request.grant_id}`;
  }
}

function withdrawCards(offer: WithdrawOffer | null): ThreadCard[] {
  if (!offer) return [];
  return offer.requests.map((request) => ({ kind: 'withdraw', message: offer.message, request }));
}

/** The cards a turn has raised so far: its suggestion, each approval in arrival order, the offer. */
export function raisedCards(turn: TurnState): ThreadCard[] {
  const suggestion: ThreadCard[] = turn.missionSuggestion
    ? [{ kind: 'suggestion', suggestion: turn.missionSuggestion }]
    : [];
  const approvals = turn.approvals.map((card): ThreadCard => {
    const view = card.view ? { view: card.view } : {};
    return card.kind === 'mission'
      ? { kind: 'plan', plan: card.data, ...view }
      : { kind: 'tool', tool: card.data, ...view };
  });
  return [...suggestion, ...approvals, ...withdrawCards(turn.withdrawOffer)];
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

/** The grant a card acts on: a tool approval's, a withdraw request's; none for a Mission's cards. */
function grantOf(card: ThreadCard): number | null {
  if (card.kind === 'tool') return card.tool.grant_id;
  return card.kind === 'withdraw' ? card.request.grant_id : null;
}

/** Denying a grant withdraws it and withdrawing it denies it: the other cards on it say so too. */
function siblingOutcome(card: ThreadCard, outcome: CardOutcome): CardOutcome | null {
  if (outcome.state !== 'denied' && outcome.state !== 'withdrawn') return null;
  return card.kind === 'tool' ? DENIED : WITHDRAWN;
}

/**
 * `filed` with one card's outcome, and a refused grant's other open cards settled with it; a card
 * that is not open any more keeps the one it has.
 */
export function settleCard(
  filed: readonly FiledCard[],
  key: string,
  outcome: CardOutcome,
): readonly FiledCard[] {
  const target = filed.find((card) => card.key === key && card.outcome.state === 'open');
  if (!target) return filed;
  const grant = grantOf(target.card);
  const next = (card: FiledCard): CardOutcome | null => {
    if (card.outcome.state !== 'open') return null;
    if (card.key === key) return outcome;
    const sameGrant = grant !== null && grantOf(card.card) === grant;
    return sameGrant ? siblingOutcome(card.card, outcome) : null;
  };
  return filed.map((card) => {
    const settled = next(card);
    return settled ? { ...card, outcome: settled } : card;
  });
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
