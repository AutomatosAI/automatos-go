// Auto's cards as the thread draws them (pure): each filed card → the words, the request it would
// send and the state it is in. The suggestion carries its POST /api/missions body built from the
// thread's newest messages (the web's recentMessages, live turn included); once filed it links to
// the Mission's page through the vendored missionHref and the foundation's appRouteForWebLink
// (Studio in the system browser: the phone has no Mission screen). The plan shows its goal, its
// numbered tasks with the agent each runs on, and the oversight note (PRD-181 S5), never a cost
// (D8). A dismissed suggestion is not drawn at all (the web returns null). The tool approval, the
// withdraw offer (an offer's requests drawn as one card) and the ticket card are view-tools.ts's.

import type { ApprovalView } from '../../core/approval-view';
import type { MissionApprovalTask } from '../../core/web/components/widgets/types';
import {
  CONTEXT_MESSAGES_KEPT,
  recentMessages,
  type MissionSuggestion,
} from '../../core/web/lib/chat/suggestion';
import { missionHref } from '../../core/web/lib/ticket-links';
import { appRouteForWebLink, type WebLinkTarget } from '../../navigation/web-links';
import { joinLabel } from '../../ui/paint';
import { countPhrase } from '../../ui/variants';
import { shownMessages, type ThreadState } from '../controller/thread';
import { CARD_COPY } from '../strings';
import { missionCreateBody, type ContextMessage, type MissionCreateBody } from './actions';
import {
  placeCards,
  type CardOutcome,
  type CardPlace,
  type FiledCard,
  type ThreadCard,
} from './model';
import { oversightView, ownWord, type OversightView } from './oversight';
import { toolRow, withdrawRow, type ToolApprovalRow, type WithdrawRow } from './view-tools';

export { oversightView, type OversightView } from './oversight';
export type { TicketRow, ToolApprovalRow, WithdrawRequestRow, WithdrawRow } from './view-tools';

export type SuggestionRow = {
  readonly kind: 'suggestion';
  readonly key: string;
  readonly goal: string;
  /** The web's complexity chip; null for a tier it does not name. */
  readonly complexity: string | null;
  readonly request: MissionCreateBody;
  readonly outcome: CardOutcome;
  /** The filed Mission's page; null until filed, or when this build has no Studio URL. */
  readonly missionLink: WebLinkTarget | null;
};

export type PlanTaskRow = {
  readonly key: string;
  readonly number: string;
  readonly title: string;
  /** The role the plan gave it (the handoff's mono agent on the right). */
  readonly agent: string | null;
  /** PRD-164 S2's match preview: '→ Nova (your pick) — best at research'. */
  readonly match: string | null;
  readonly accessibilityLabel: string;
};

export type PlanRow = {
  readonly kind: 'plan';
  readonly key: string;
  readonly missionId: string;
  readonly goal: string;
  readonly summary: string;
  readonly tasks: readonly PlanTaskRow[];
  readonly oversight: OversightView | null;
  readonly outcome: CardOutcome;
  /** 'Plan approved. …' or 'Plan rejected.' once decided; null while open. */
  readonly decided: string | null;
  /** ApprovalView@1 (PRD-268 US-G08): the card then opens the answer sheet; null, today's card. */
  readonly view: ApprovalView | null;
};

export type CardRow = SuggestionRow | PlanRow | ToolApprovalRow | WithdrawRow;

export type CardContext = {
  readonly chatId: string | null;
  /** The thread's newest messages, oldest first (threadContext). */
  readonly messages: readonly ContextMessage[];
  /** Studio's base URL (EXPO_PUBLIC_WEB_URL by default). */
  readonly webUrl?: string;
};

type Plan = Extract<ThreadCard, { kind: 'plan' }>['plan'];

/**
 * The thread's newest five messages as {role, content}: the saved ones, then the live turn's (the
 * user's words and Auto's so far). A turn reopened mid-way has no draft: its saved question counts.
 */
export function threadContext(state: ThreadState): ContextMessage[] {
  const live = state.live;
  const saved = recentMessages([...(live?.draft ? shownMessages(state) : state.messages)]);
  const asked = live?.draft?.text.trim();
  const answered = live?.turn.text.trim();
  return [
    ...saved,
    ...(asked ? [{ role: 'user', content: asked }] : []),
    ...(answered ? [{ role: 'assistant', content: answered }] : []),
  ].slice(-CONTEXT_MESSAGES_KEPT);
}

function missionLink(outcome: CardOutcome, webUrl: string | undefined): WebLinkTarget | null {
  return outcome.state === 'filed'
    ? appRouteForWebLink(missionHref(outcome.mission.id), webUrl)
    : null;
}

/** chat.tsx's match preview line. */
function matchLine(task: MissionApprovalTask): string | null {
  const agent = task.match_agent?.trim();
  if (!agent) return null;
  const pick = task.match_is_override ? ` ${CARD_COPY.yourPick}` : '';
  const reason = task.match_reason?.trim() ? ` — ${task.match_reason.trim()}` : '';
  return `${CARD_COPY.matchedAgent(agent)}${pick}${reason}`;
}

function taskRow(task: MissionApprovalTask, index: number): PlanTaskRow {
  const number = String(task.sequence ?? index + 1);
  const agent = task.agent_role?.trim() || null;
  const match = matchLine(task);
  return {
    key: `${index}-${task.temp_id ?? number}`,
    number,
    title: task.title,
    agent,
    match,
    accessibilityLabel: joinLabel(`${number}.`, task.title, agent, match),
  };
}

const DECIDED: Readonly<Partial<Record<CardOutcome['state'], string>>> = Object.freeze({
  approved: CARD_COPY.approved,
  rejected: CARD_COPY.rejected,
});

function planRow(card: FiledCard, plan: Plan, view?: ApprovalView): PlanRow {
  return {
    kind: 'plan',
    key: card.key,
    missionId: plan.mission_id,
    goal: plan.goal,
    summary: countPhrase(plan.task_count, CARD_COPY.tasks),
    tasks: plan.tasks.map(taskRow),
    oversight: oversightView(plan),
    outcome: card.outcome,
    decided: DECIDED[card.outcome.state] ?? null,
    view: view ?? null,
  };
}

function suggestionRow(
  card: FiledCard,
  suggestion: MissionSuggestion,
  context: CardContext,
): SuggestionRow | null {
  if (card.outcome.state === 'dismissed') return null;
  return {
    kind: 'suggestion',
    key: card.key,
    goal: suggestion.goal,
    complexity: ownWord(CARD_COPY.complexity, suggestion.complexity),
    request: missionCreateBody(suggestion.goal, context.chatId, context.messages),
    outcome: card.outcome,
    missionLink: missionLink(card.outcome, context.webUrl),
  };
}

/** One card's row; a withdraw request is drawn with the rest of its offer (cardRows). */
function cardRow(card: FiledCard, context: CardContext): CardRow | null {
  switch (card.card.kind) {
    case 'plan':
      return planRow(card, card.card.plan, card.card.view);
    case 'tool':
      return toolRow(card, card.card.tool, card.card.view);
    case 'suggestion':
      return suggestionRow(card, card.card.suggestion, context);
    case 'withdraw':
      return null;
  }
}

const isWithdraw = (card: FiledCard) => card.card.kind === 'withdraw';

/**
 * The cards in one place of the thread, as drawn: a dismissed suggestion left out, and an offer's
 * requests as one card where its first request sits.
 */
export function cardRows(cards: readonly FiledCard[], context: CardContext): CardRow[] {
  const rowOf = (card: FiledCard): CardRow | null => {
    if (!isWithdraw(card)) return cardRow(card, context);
    const offer = cards.filter((other) => isWithdraw(other) && other.since === card.since);
    return offer[0] === card ? withdrawRow(offer) : null;
  };
  return cards.flatMap((card) => rowOf(card) ?? []);
}

/** The cards for each place in the thread: inside a saved reply, the live reply, or after both. */
export type PlacedCards = {
  readonly at: (messageIndex: number) => readonly CardRow[];
  readonly live: readonly CardRow[];
  readonly loose: readonly CardRow[];
};

export function placedCards(state: ThreadState, webUrl?: string): PlacedCards {
  const places = placeCards(state.cards, shownMessages(state), state.live?.since ?? null);
  const context: CardContext = { chatId: state.chatId, messages: threadContext(state), webUrl };
  const at = (place: CardPlace) => cardRows(places.get(place) ?? [], context);
  return { at, live: at('live'), loose: at('loose') };
}
