import { describe, expect, it } from 'vitest';

import { NO_NEEDS_YOU, NeedsYouSchema, type NeedsYou } from '../../api/needs-you';
import { routes } from '../../navigation/routes';
import { needsStrip, type SocialNeedRow, type StripCard } from '../home/needs-strip';
import { NEEDS_COPY } from '../strings';
import { WEB } from './view-model-fixtures';

const AT = '2026-10-23T08:14:00Z';

const ticketRow = (ticketId: number, number: string, title: string | null) => ({
  ticket_id: ticketId,
  number,
  title,
  agent_name: 'Ledger',
  mission_id: null,
  mission_number: null,
  mission_title: null,
  opens: 'ticket',
  at: AT,
  why: null,
});

const askRow = (source: 'grant' | 'mission', id: string, overrides: object = {}) => ({
  source,
  id,
  title: 'Which supplier should I use for the oat milk?',
  ticket_id: 419,
  number: '#0419',
  agent_name: 'Ledger',
  mission_id: null,
  mission_number: null,
  mission_title: null,
  at: AT,
  ...overrides,
});

/** A needs-you answer as the server sends it, read through the foundation's own schema. */
function answer(total: number, rows: Partial<Record<keyof NeedsYou['rows'], unknown[]>>) {
  return NeedsYouSchema.parse({
    total,
    counts: { review: 0, question: 0, approval: 0, stuck: 0, failed: 0 },
    rows: { review: [], question: [], approval: [], stuck: [], failed: [], ...rows },
  });
}

const cardsOf = (needs: NeedsYou, social: readonly SocialNeedRow[] = []) =>
  needsStrip({ ...needs, social }, { webUrl: WEB })?.cards ?? [];
const only = (cards: readonly StripCard[]): StripCard => {
  expect(cards).toHaveLength(1);
  return cards[0];
};

describe('the needs strip: each row kind opens its own screen', () => {
  it('opens a question in the Questions tab, as QUESTION · #0419 with the agent named', () => {
    const card = only(cardsOf(answer(1, { question: [askRow('grant', '77')] })));
    expect(card).toMatchObject({
      kind: 'question',
      pip: 'blocked',
      word: NEEDS_COPY.kinds.question.word,
      title: 'Ledger: Which supplier should I use for the oat milk?',
      meta: 'Question · #0419',
      target: { app: routes.cc.questions },
    });
    expect(routes.cc.questions).toBe('/cc/questions');
    expect(card.accessibilityLabel).toBe(
      'Needs an answer, Ledger: Which supplier should I use for the oat milk?, Question · #0419',
    );
  });

  it('opens a ticket in review on the ticket sheet by its row id', () => {
    const card = only(cardsOf(answer(1, { review: [ticketRow(425, '#0425', 'Draft the menu')] })));
    expect(card).toMatchObject({
      kind: 'review',
      pip: 'review',
      word: NEEDS_COPY.kinds.review.word,
      title: 'Draft the menu',
      meta: 'Review · #0425',
      target: { app: routes.cc.ticket(425) },
    });
    expect(routes.cc.ticket(425)).toBe('/cc/ticket/425');
  });

  it('opens a social post awaiting approval on its approval screen', () => {
    const social = [{ postId: 'post-81', title: 'Autumn menu launch', channel: 'LinkedIn' }];
    const card = only(cardsOf(answer(1, {}), social));
    expect(card).toMatchObject({
      kind: 'social',
      pip: 'review',
      word: NEEDS_COPY.kinds.social.word,
      title: 'Autumn menu launch',
      meta: 'Social post · LinkedIn',
      target: { app: routes.cc.social('post-81') },
    });
    expect(routes.cc.social('post-81')).toBe('/cc/social/post-81');
  });

  it('opens stuck and failed tickets on the ticket sheet too, each status in its own word', () => {
    const cards = cardsOf(
      answer(2, {
        stuck: [ticketRow(430, '#0430', 'Reconcile invoices')],
        failed: [ticketRow(431, '#0431', 'Post the rota')],
      }),
    );
    expect(
      cards.map(({ kind, pip, word, meta, target }) => ({ kind, pip, word, meta, target })),
    ).toEqual([
      {
        kind: 'stuck',
        pip: 'blocked',
        word: 'Stuck',
        meta: 'Stuck · #0430',
        target: { app: routes.cc.ticket(430) },
      },
      {
        kind: 'failed',
        pip: 'failed',
        word: 'Failed',
        meta: 'Failed · #0431',
        target: { app: routes.cc.ticket(431) },
      },
    ]);
  });

  it("opens a tool approval at its ticket, and one with no ticket on Studio's governance tab", () => {
    const cards = cardsOf(
      answer(2, {
        approval: [askRow('grant', '90'), askRow('grant', '91', { ticket_id: null, number: null })],
      }),
    );
    expect(cards.map((card) => card.target)).toEqual([
      { app: routes.cc.ticket(419) },
      { external: `${WEB}/command-center?tab=governance` },
    ]);
    expect(cards[1].accessibilityHint).toBe(NEEDS_COPY.opensStudio);
    expect(cards[0].accessibilityHint).toBeUndefined();
  });

  it("opens a Mission's plan on its Studio page: the phone has no Missions screen", () => {
    const plan = askRow('mission', 'mission-uuid-1', {
      title: null,
      ticket_id: null,
      number: null,
      mission_number: 'M-0012',
      mission_title: 'Open the second site',
    });
    const card = only(cardsOf(answer(1, { approval: [plan] })));
    expect(card).toMatchObject({
      kind: 'plan',
      title: 'Open the second site',
      meta: 'Mission plan · M-0012',
      target: { external: `${WEB}/missions/mission-uuid-1` },
    });
  });

  it('puts what blocks an agent first: questions, approvals, social posts, then tickets', () => {
    const cards = cardsOf(
      answer(6, {
        failed: [ticketRow(5, '#0005', 'F')],
        review: [ticketRow(3, '#0003', 'R')],
        approval: [askRow('grant', '2')],
        stuck: [ticketRow(4, '#0004', 'S')],
        question: [askRow('grant', '1')],
      }),
      [{ postId: 'p', title: 'P', channel: null }],
    );
    expect(cards.map((card) => card.kind)).toEqual([
      'question',
      'approval',
      'social',
      'review',
      'stuck',
      'failed',
    ]);
    expect(new Set(cards.map((card) => card.key)).size).toBe(cards.length);
  });

  it('gives a row with no title the kind’s own words, and a row id that is no board id no link', () => {
    const cards = cardsOf(
      answer(3, {
        question: [askRow('grant', '1', { title: '  ', number: null })],
        review: [ticketRow(-4, '#0004', null)],
      }),
      [{ postId: ' ', title: null, channel: null }],
    );
    expect(cards.map(({ title, meta, target }) => ({ title, meta, target }))).toEqual([
      {
        title: NEEDS_COPY.untitledQuestion,
        meta: 'Question',
        target: { app: routes.cc.questions },
      },
      { title: NEEDS_COPY.untitledPost, meta: 'Social post', target: null },
      { title: NEEDS_COPY.untitledTicket, meta: 'Review · #0004', target: null },
    ]);
  });
});

describe("each card carries its row's agent and time (US-023g)", () => {
  it('names the agent, trimmed, and the time the row started waiting, as served', () => {
    const cards = cardsOf(
      answer(3, {
        question: [askRow('grant', '1', { agent_name: '  Ledger ' })],
        approval: [askRow('mission', 'm-1', { agent_name: null, at: null })],
        stuck: [ticketRow(9, '#0009', 'Stuck')],
      }),
      [{ postId: 'p-1', title: 'Launch', channel: 'X' }],
    );
    expect(cards.map(({ kind, agent, at }) => ({ kind, agent, at }))).toEqual([
      { kind: 'question', agent: 'Ledger', at: AT },
      { kind: 'plan', agent: null, at: null },
      { kind: 'social', agent: null, at: null },
      { kind: 'stuck', agent: 'Ledger', at: AT },
    ]);
  });

  it('names no agent for a blank name', () => {
    const card = only(cardsOf(answer(1, { review: [{ ...ticketRow(4, '#0004', 'T'), agent_name: ' ' }] })));
    expect(card.agent).toBeNull();
  });
});

describe("the needs strip's count is the server's total (D26)", () => {
  it('heads the strip with the total, not the number of cards, and links to the Command Centre', () => {
    const strip = needsStrip(answer(9, { question: [askRow('grant', '1')] }), { webUrl: WEB });
    expect(strip).toMatchObject({
      heading: 'Needs you · 9',
      count: 9,
      more: { app: routes.cc.board },
    });
    expect(strip?.cards).toHaveLength(1);
  });

  it('still heads the strip when the server lists none of the rows it counts', () => {
    const strip = needsStrip(answer(4, {}), { webUrl: WEB });
    expect(strip).toMatchObject({ heading: 'Needs you · 4', count: 4, cards: [] });
  });

  it('leaves out a row the foundation could not read, and the count stays the server’s', () => {
    const strip = needsStrip(
      answer(2, { review: [{ ticket_id: 'x' }, ticketRow(7, '#0007', 'T')] }),
    );
    expect(strip?.count).toBe(2);
    expect(strip?.cards.map((card) => card.key)).toEqual(['review-7']);
  });
});

describe('the needs strip is hidden when nothing needs you', () => {
  it('is null before the first answer (the foundation’s NO_NEEDS_YOU)', () => {
    expect(needsStrip(NO_NEEDS_YOU)).toBeNull();
  });

  it('is null when the total is zero, whatever rows came with it', () => {
    expect(needsStrip(answer(0, { question: [askRow('grant', '1')] }))).toBeNull();
    expect(
      needsStrip({ ...NO_NEEDS_YOU, social: [{ postId: 'p', title: 'P', channel: null }] }),
    ).toBeNull();
  });
});
