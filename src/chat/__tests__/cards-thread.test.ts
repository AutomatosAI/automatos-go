import { describe, expect, it } from 'vitest';

import type { Frame } from '../../core/ai-sdk-stream';
import { approvalsInPart } from '../../core/web/lib/chat/approvals';
import { OPEN, fileCards, placeCards, raisedCards, rebaseCards, settleCard } from '../cards/model';
import {
  cardRows,
  oversightView,
  threadContext,
  type PlanRow,
  type SuggestionRow,
} from '../cards/view';
import type { ThreadState } from '../controller/thread';
import { CARD_COPY } from '../strings';
import { LOOSE_CARDS_KEY, threadRows } from '../view-model';
import { CHAT_ID, OTHER_CHAT_ID, saved } from './thread-fixtures';
import { WEB, apply, autoRows, frames, opened, streaming } from './view-model-fixtures';

const MISSION_ID = '5b0e4c1d-0000-4000-8000-0000000000a1';
const SUGGESTION: Frame = {
  kind: 'mission-suggestion',
  suggestion: { goal: 'Launch the spring campaign', complexity: 'organism' },
};
const PLAN_DATA = {
  mission_id: MISSION_ID,
  goal: 'Launch the spring campaign',
  task_count: 2,
  tasks: [
    { title: 'Draft the brief', agent_role: 'writer', sequence: 1, temp_id: 't1' },
    {
      title: 'Book the posts',
      agent_role: 'social',
      sequence: 2,
      match_agent: 'Nova',
      match_reason: 'runs the calendar',
      match_is_override: true,
    },
  ],
  cost_estimate_usd: 4.2,
  cost_ceiling_usd: 10,
  risk_tier: 'human_in_the_loop',
  risk_class: 'external_comms',
  oversight_rationale: 'Posts go out under your name.',
};
const PLAN: Frame = {
  kind: 'tool-data',
  approvals: approvalsInPart({ type: 'tool-data', data: { mission_approval: PLAN_DATA } }),
  deliverables: [],
};
const TEXT: Frame = { kind: 'text', text: 'Here is a plan.' };
const FINISH: Frame = { kind: 'finish', finishReason: 'stop', aiGenerated: true };
const ASKED = saved('m-asked', 'user', 'Status?');
const REPLIED = saved('m-replied', 'assistant', 'Here is a plan.');

const cardsOf = (state: ThreadState) =>
  autoRows(threadRows(state, { webUrl: WEB })).flatMap((row) => row.cards);

/** The turn ran and finished; the refetch brought the saved question and reply. */
function retired(...list: Frame[]): ThreadState {
  return apply(
    streaming(...list, FINISH),
    { type: 'finished' },
    { type: 'refetched', messages: [ASKED, REPLIED] },
  );
}

describe('the cards a turn raises (D-CARDS)', () => {
  it('reads the suggestion and each Mission plan off the turn, in order', () => {
    const state = streaming(SUGGESTION, PLAN);
    expect(raisedCards(state.live!.turn).map((card) => card.kind)).toEqual(['suggestion', 'plan']);
    expect(state.cards.map((card) => [card.key, card.since, card.outcome])).toEqual([
      ['suggestion-0', 0, OPEN],
      [`mission-${MISSION_ID}`, 0, OPEN],
    ]);
  });

  it('files a card once, however often it is raised', () => {
    const state = streaming(SUGGESTION, PLAN, PLAN);
    expect(state.cards).toHaveLength(2);
    const raised = raisedCards(state.live!.turn);
    expect(fileCards(state.cards, raised, 0)).toBe(state.cards);
  });

  it('keeps the cards and their outcome once the saved reply retires the live turn', () => {
    const live = streaming(SUGGESTION, PLAN);
    expect(autoRows(threadRows(live))[0]?.cards).toHaveLength(2);
    const approved = apply(live, {
      type: 'card',
      key: `mission-${MISSION_ID}`,
      outcome: { state: 'approved' },
    });
    const landed = apply(
      approved,
      ...frames(TEXT, FINISH),
      { type: 'finished' },
      { type: 'refetched', messages: [ASKED, REPLIED] },
    );
    expect(landed.live).toBeNull();
    const [reply] = autoRows(threadRows(landed));
    expect(reply?.messageId).toBe(REPLIED.id);
    const states = reply?.cards.map((card) => [
      card.kind,
      'outcome' in card ? card.outcome.state : null,
    ]);
    expect(states).toEqual([
      ['suggestion', 'open'],
      ['plan', 'approved'],
    ]);
  });

  it('settles a card once: a decided card keeps its outcome', () => {
    const state = retired(PLAN);
    const key = `mission-${MISSION_ID}`;
    const rejected = apply(state, { type: 'card', key, outcome: { state: 'rejected' } });
    expect(apply(rejected, { type: 'card', key, outcome: { state: 'approved' } })).toBe(rejected);
    expect(settleCard(rejected.cards, 'nothing-here', { state: 'approved' })).toBe(rejected.cards);
  });

  it('draws a card after the saved messages when its reply was never saved', () => {
    const stopped = apply(streaming(PLAN), { type: 'stopped', at: '2026-10-21T08:31:00Z' });
    const next = apply(
      stopped,
      { type: 'refetched', messages: [ASKED] },
      { type: 'send', draft: { text: 'Go on', files: [], sentAt: null } },
    );
    const rows = threadRows(next);
    const loose = rows.find((row) => row.type === 'cards');
    expect(loose).toMatchObject({ key: LOOSE_CARDS_KEY });
    expect(rows.indexOf(loose!)).toBe(rows.findIndex((row) => row.key === ASKED.id) + 1);
  });

  it('places each card in the first reply at or after its turn, else live, else loose', () => {
    const cards = fileCards([], [{ kind: 'plan', plan: { ...PLAN_DATA, tasks: [] } as never }], 1);
    const thread = [saved('a', 'user', 'x'), saved('b', 'user', 'y'), saved('c', 'assistant', 'z')];
    expect([...placeCards(cards, thread, null).keys()]).toEqual([2]);
    expect([...placeCards(cards, thread.slice(0, 2), null).keys()]).toEqual(['loose']);
    expect([...placeCards(cards, thread.slice(0, 1), 1).keys()]).toEqual(['live']);
  });

  it('a new chat from a stale id keeps only this turn’s cards, moved to its start', () => {
    const earlier = apply(retired(PLAN), {
      type: 'send',
      draft: { text: 'More', files: [], sentAt: null },
    });
    const raised = apply(earlier, ...frames(SUGGESTION));
    expect(raised.cards.map((card) => card.key)).toEqual([`mission-${MISSION_ID}`, 'suggestion-2']);
    const moved = apply(
      raised,
      ...frames({ kind: 'chat-id', chatId: OTHER_CHAT_ID, aiGenerated: true }),
    );
    expect(moved.chatId).toBe(OTHER_CHAT_ID);
    expect(moved.cards.map((card) => [card.key, card.since])).toEqual([['suggestion-0', 0]]);
    expect(rebaseCards([], 3, 0)).toEqual([]);
  });

  it('opening another chat lets every card go', () => {
    expect(apply(retired(PLAN), { type: 'opened', chatId: null }).cards).toEqual([]);
  });
});

describe('the card rows', () => {
  it('the suggestion carries its POST /api/missions body from the thread’s newest messages', () => {
    const state = apply(
      opened([saved('m1', 'user', 'Plan the launch'), saved('m2', 'assistant', 'Sure.')]),
      {
        type: 'send',
        draft: { text: 'Make it a Mission', files: [], sentAt: null },
      },
      ...frames(SUGGESTION, TEXT),
    );
    const [card] = cardsOf(state) as SuggestionRow[];
    expect(card?.complexity).toBe(CARD_COPY.complexity.organism);
    expect(card?.request).toEqual({
      goal: 'Launch the spring campaign',
      config: {
        source: 'chat',
        chat_id: CHAT_ID,
        context_messages: [
          { role: 'user', content: 'Plan the launch' },
          { role: 'assistant', content: 'Sure.' },
          { role: 'user', content: 'Make it a Mission' },
          { role: 'assistant', content: 'Here is a plan.' },
        ],
      },
    });
    expect(threadContext(state)).toHaveLength(4);
  });

  it('a filed suggestion links to the Mission’s page in Studio; a dismissed one is not drawn', () => {
    const key = 'suggestion-0';
    const mission = { id: MISSION_ID, goal: 'Launch', state: 'planning' };
    const filed = apply(retired(SUGGESTION), {
      type: 'card',
      key,
      outcome: { state: 'filed', mission },
    });
    const [card] = cardsOf(filed) as SuggestionRow[];
    expect(card?.missionLink).toEqual({ external: `${WEB}/missions/${MISSION_ID}` });
    const dismissed = apply(retired(SUGGESTION), {
      type: 'card',
      key,
      outcome: { state: 'dismissed' },
    });
    expect(cardsOf(dismissed)).toEqual([]);
    expect(autoRows(threadRows(dismissed))).toHaveLength(1);
  });

  it('an unknown complexity shows no chip, never the server’s tier name', () => {
    const odd: Frame = {
      kind: 'mission-suggestion',
      suggestion: { goal: 'G', complexity: 'constructor' },
    };
    expect((cardsOf(streaming(odd))[0] as SuggestionRow).complexity).toBeNull();
  });

  it('the plan: goal, task count, numbered tasks with their agents and match, the oversight note', () => {
    const [card] = cardsOf(streaming(PLAN)) as PlanRow[];
    expect(card).toMatchObject({
      missionId: MISSION_ID,
      goal: PLAN_DATA.goal,
      summary: '2 tasks',
      decided: null,
    });
    expect(card?.tasks.map((task) => [task.number, task.title, task.agent, task.match])).toEqual([
      ['1', 'Draft the brief', 'writer', null],
      ['2', 'Book the posts', 'social', '→ Nova (your pick) — runs the calendar'],
    ]);
    expect(card?.tasks[1]?.accessibilityLabel).toContain('Book the posts');
    expect(card?.oversight).toEqual({
      title: 'Human approval required · external comms',
      rationale: 'Posts go out under your name.',
    });
  });

  it('never shows the plan’s cost or ceiling (D8)', () => {
    const text = JSON.stringify(cardsOf(streaming(PLAN)));
    expect(text).not.toMatch(/4\.2|\$|cost|ceiling/i);
  });

  it('a decided plan says how it was decided', () => {
    const key = `mission-${MISSION_ID}`;
    const approved = apply(retired(PLAN), { type: 'card', key, outcome: { state: 'approved' } });
    expect((cardsOf(approved)[0] as PlanRow).decided).toBe(CARD_COPY.approved);
    const rejected = apply(retired(PLAN), { type: 'card', key, outcome: { state: 'rejected' } });
    expect((cardsOf(rejected)[0] as PlanRow).decided).toBe(CARD_COPY.rejected);
  });

  it('the oversight note only when the plan carries a tier or a reason; unknown tiers read strictest', () => {
    const plan = {
      ...PLAN_DATA,
      risk_tier: undefined,
      risk_class: undefined,
      oversight_rationale: undefined,
    };
    expect(oversightView(plan as never)).toBeNull();
    expect(oversightView({ ...plan, oversight_rationale: 'Because.' } as never)).toEqual({
      title: 'Human approval required',
      rationale: 'Because.',
    });
    expect(cardRows([], { chatId: null, messages: [] })).toEqual([]);
  });
});
