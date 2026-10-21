import { describe, expect, it } from 'vitest';

import { createApiClient } from '../client';
import { ApiError } from '../errors';
import { fetchNeedsYou, NeedsYouSchema, NO_NEEDS_YOU } from '../needs-you';
import { SERVER, fakeTransport, jsonReply } from './fake-transport';

const WS = '7f1c2a54-0000-4000-8000-000000000001';

// Shapes as orchestrator/services/needs_you.py builds them at the pinned SHA (_ticket_row,
// _grant_row, _approval_rows' mission rows, _stuck_rows).
const REVIEW_ROW = {
  ticket_id: 42,
  number: '#0042',
  title: 'Draft the launch post',
  agent_name: 'Writer',
  mission_id: null,
  at: '2026-10-20T08:14:00+00:00',
  opens: 'ticket',
};
const QUESTION_ROW = {
  source: 'grant',
  id: '17',
  title: 'Which tone should the post take?',
  ticket_id: 42,
  number: '#0042',
  agent_name: 'Writer',
  at: '2026-10-20T08:15:00+00:00',
};
const MISSION_APPROVAL_ROW = {
  source: 'mission',
  id: 'a2b4c6d8-0000-4000-8000-000000000003',
  title: 'Ship the autumn campaign',
  ticket_id: 51,
  number: '#0051',
  agent_name: null,
  at: null,
};
const STUCK_ROW = {
  ticket_id: 176,
  number: '#0176.9',
  title: 'Check the figures',
  agent_name: null,
  mission_id: 'b1b1b1b1-0000-4000-8000-000000000004',
  mission_number: '#0176',
  mission_title: 'Quarterly report',
  at: '2026-10-19T17:00:00+00:00',
  opens: 'mission',
  why: 'mission_ended',
};

const ANSWER = {
  total: 5,
  counts: { review: 1, question: 1, approval: 2, stuck: 1, failed: 0 },
  rows: {
    review: [REVIEW_ROW],
    question: [QUESTION_ROW],
    approval: [MISSION_APPROVAL_ROW],
    stuck: [STUCK_ROW],
    failed: [],
  },
};

describe('needs-you parsing', () => {
  it("keeps the server's number, its counts and its rows", () => {
    const parsed = NeedsYouSchema.parse(ANSWER);
    expect(parsed.total).toBe(5);
    expect(parsed.counts).toEqual(ANSWER.counts);
    expect(parsed.rows.review[0]).toMatchObject({
      ticket_id: 42,
      number: '#0042',
      opens: 'ticket',
    });
    expect(parsed.rows.question[0]).toMatchObject({ source: 'grant', id: '17', ticket_id: 42 });
    expect(parsed.rows.approval[0]).toMatchObject({ source: 'mission', ticket_id: 51 });
    expect(parsed.rows.stuck[0]).toMatchObject({ opens: 'mission', why: 'mission_ended' });
  });

  it('ignores unknown fields at every level', () => {
    const parsed = NeedsYouSchema.parse({
      ...ANSWER,
      period: null,
      counts: { ...ANSWER.counts, snoozed: 3 },
      rows: { ...ANSWER.rows, snoozed: [{ id: 1 }], review: [{ ...REVIEW_ROW, cost_usd: 1.2 }] },
    });
    expect(parsed).not.toHaveProperty('period');
    expect(parsed.counts).not.toHaveProperty('snoozed');
    expect(parsed.rows).not.toHaveProperty('snoozed');
    expect(parsed.rows.review[0]).not.toHaveProperty('cost_usd');
  });

  it('reads fields an older or newer server sends differently', () => {
    const parsed = NeedsYouSchema.parse({
      total: 2,
      counts: { review: 1, stuck: 1 },
      rows: {
        review: [{ ticket_id: 9, title: null }],
        stuck: [{ ...STUCK_ROW, why: 'gremlins', opens: 'somewhere_new' }],
      },
    });
    expect(parsed.counts).toEqual({ review: 1, question: 0, approval: 0, stuck: 1, failed: 0 });
    expect(parsed.rows.review[0]).toEqual({
      ticket_id: 9,
      number: null,
      title: null,
      agent_name: null,
      mission_id: null,
      mission_number: null,
      mission_title: null,
      opens: 'ticket',
      at: null,
      why: null,
    });
    expect(parsed.rows.stuck[0]).toMatchObject({ why: null, opens: 'ticket' });
    expect(parsed.rows.question).toEqual([]);
  });

  it('leaves out a row it cannot read and keeps the rest and the number', () => {
    const parsed = NeedsYouSchema.parse({
      ...ANSWER,
      rows: {
        ...ANSWER.rows,
        review: [{ title: 'no id' }, REVIEW_ROW, 'junk'],
        question: [{ ...QUESTION_ROW, source: 'telepathy' }, QUESTION_ROW],
      },
    });
    expect(parsed.total).toBe(5);
    expect(parsed.rows.review.map((row) => row.ticket_id)).toEqual([42]);
    expect(parsed.rows.question).toHaveLength(1);
  });

  it('reads counts and rows that are missing or broken as nothing', () => {
    const parsed = NeedsYouSchema.parse({ total: 0, counts: 'n/a', rows: null });
    expect(parsed).toEqual(NO_NEEDS_YOU);
  });

  it('refuses an answer with no number', () => {
    expect(NeedsYouSchema.safeParse({ counts: ANSWER.counts, rows: ANSWER.rows }).success).toBe(
      false,
    );
    expect(NeedsYouSchema.safeParse({ ...ANSWER, total: -1 }).success).toBe(false);
  });
});

describe('fetchNeedsYou', () => {
  function clientAnswering(status: number, body: unknown) {
    const transport = fakeTransport(() => jsonReply(status, body));
    const client = createApiClient({
      server: SERVER,
      getToken: async () => 'jwt.token.value',
      getWorkspaceId: () => WS,
      transport,
    });
    return { client, transport };
  }

  it('reads GET /api/activity/needs-you with the bearer and the workspace', async () => {
    const { client, transport } = clientAnswering(200, ANSWER);
    const needsYou = await fetchNeedsYou(client);
    expect(needsYou.total).toBe(5);
    expect(transport.calls[0]).toMatchObject({
      url: 'https://api.example.test/api/activity/needs-you',
      method: 'GET',
      headers: { Authorization: 'Bearer jwt.token.value', 'X-Workspace-ID': WS },
    });
  });

  it('is an invalid_response when the answer has no number', async () => {
    const { client } = clientAnswering(200, { rows: {} });
    const error = await fetchNeedsYou(client).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('invalid_response');
  });
});
