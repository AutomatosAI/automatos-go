// Auto's cards as the thread draws them (pure): each filed card → the words, the request it would
// send and the state it is in. The suggestion carries its POST /api/missions body built from the
// thread's newest messages (the web's recentMessages, live turn included); once filed it links to
// the Mission's page through the vendored missionHref and the foundation's appRouteForWebLink
// (Studio in the system browser: the phone has no Mission screen). The plan shows its goal, its
// numbered tasks with the agent each runs on, and the oversight note (PRD-181 S5), never a cost
// (D8). A dismissed suggestion is not drawn at all (the web returns null).

import type { MissionApprovalTask } from '../../core/web/components/widgets/types';
import { CONTEXT_MESSAGES_KEPT, recentMessages } from '../../core/web/lib/chat/suggestion';
import { missionHref } from '../../core/web/lib/ticket-links';
import { appRouteForWebLink, type WebLinkTarget } from '../../navigation/web-links';
import { joinLabel } from '../../ui/paint';
import { countPhrase } from '../../ui/variants';
import { shownMessages, type ThreadState } from '../controller/thread';
import { CARD_COPY, OVERSIGHT_TIERS } from '../strings';
import { missionCreateBody, type ContextMessage, type MissionCreateBody } from './actions';
import {
  placeCards,
  type CardOutcome,
  type CardPlace,
  type FiledCard,
  type ThreadCard,
} from './model';

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

export type OversightView = { readonly title: string; readonly rationale: string | null };

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
};

export type CardRow = SuggestionRow | PlanRow;

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

function ownWord(words: Readonly<Record<string, string>>, key: string | undefined): string | null {
  return key !== undefined && Object.prototype.hasOwnProperty.call(words, key) ? words[key] : null;
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

/** The oversight note when the plan carries a tier or a reason (the web's condition). */
export function oversightView(plan: Plan): OversightView | null {
  if (!plan.risk_tier && !plan.oversight_rationale) return null;
  const tier = ownWord(OVERSIGHT_TIERS, plan.risk_tier) ?? OVERSIGHT_TIERS.human_in_the_loop;
  const riskClass = plan.risk_class?.replace(/_/g, ' ').trim();
  return {
    title: riskClass ? `${tier} · ${riskClass}` : tier,
    rationale: plan.oversight_rationale?.trim() || null,
  };
}

const DECIDED: Readonly<Partial<Record<CardOutcome['state'], string>>> = Object.freeze({
  approved: CARD_COPY.approved,
  rejected: CARD_COPY.rejected,
});

function planRow(card: FiledCard, plan: Plan): PlanRow {
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
  };
}

function cardRow(card: FiledCard, context: CardContext): CardRow | null {
  if (card.card.kind === 'plan') return planRow(card, card.card.plan);
  if (card.outcome.state === 'dismissed') return null;
  const { suggestion } = card.card;
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

/** The cards in one place of the thread, as drawn (a dismissed suggestion left out). */
export function cardRows(cards: readonly FiledCard[], context: CardContext): CardRow[] {
  return cards.flatMap((card) => cardRow(card, context) ?? []);
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
