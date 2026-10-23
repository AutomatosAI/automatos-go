import { describe, expect, it } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { queryKeys } from '../../api/query-keys';
import { API_ERROR_COPY } from '../../api/strings';
import { WORKSPACE_ROLES, type WorkspaceRole } from '../../api/workspace';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import {
  AnswerInputError,
  answerBody,
  answeredMessage,
  dismissedMessage,
  isForbidden,
  mayAnswer,
  readOnlyReason,
  refusalMessage,
  withoutQuestion,
} from '../questions/answer';
import {
  answerQuestion,
  dismissQuestion,
  fetchQuestions,
  questionsQuery,
  QUESTIONS_KEY,
} from '../questions/api';
import { QuestionsSchema } from '../questions/schemas';
import { QUESTIONS_COPY } from '../strings';

const WS = '7f1c2a54-0000-4000-8000-000000000001';
const OPTIONS = ['Use the read-only key', 'Wait — I’ll rotate it'];
const WRITERS: readonly WorkspaceRole[] = ['owner', 'admin', 'editor'];

// One row of GET /api/v1/approval-grants?status=pending&kind=question at the pinned SHA:
// to_dict + oversight + cascade + owner (api/approval_grants.py list_grants).
const GRANT = {
  id: 31,
  workspace_id: WS,
  subject_type: 'board_task',
  subject_id: '2680',
  status: 'pending',
  kind: 'question',
  question_md: 'The Stripe key expired. **Use** the read-only key, or wait?',
  options: OPTIONS,
  answer_text: null,
  asked_by_agent_id: 7,
  details: {},
  oversight: { risk_class: 'low', tier: 'monitor', rationale: '', requires_approval: false },
  owner: {
    agent: { id: 7, name: 'Ledger' },
    ticket: { id: 2680, title: 'Payouts', number: '#0419' },
  },
  cascade: { total: 2, tasks: [{ id: 2681, title: 'Match payouts', status: 'assigned' }] },
};

function clientAnswering(status: number, body: unknown) {
  const transport = fakeTransport(() => jsonReply(status, body));
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'token',
    getWorkspaceId: () => WS,
    transport,
  });
  return { client, transport };
}

const answered = (answerText: string | null, status = 'granted') => ({
  grant: { ...GRANT, status, answer_text: answerText },
});

describe('the answer payload', () => {
  it('sends an offered option exactly as offered', () => {
    expect(answerBody({ kind: 'option', option: OPTIONS[1] }, OPTIONS)).toEqual({
      ok: true,
      body: { option: 'Wait — I’ll rotate it' },
    });
  });

  it('refuses an option the agent did not offer, and a blank one', () => {
    expect(answerBody({ kind: 'option', option: 'Something else' }, OPTIONS)).toEqual({
      ok: false,
      reason: 'not_offered',
      message: QUESTIONS_COPY.notOffered,
    });
    expect(answerBody({ kind: 'option', option: '  ' }, ['  '])).toMatchObject({ reason: 'empty' });
  });

  it('sends your own words trimmed, and refuses blank words', () => {
    expect(answerBody({ kind: 'words', text: '  Use the vault key.\n' }, OPTIONS)).toEqual({
      ok: true,
      body: { answer_text: 'Use the vault key.' },
    });
    for (const text of ['', '   ', '\n\t']) {
      expect(answerBody({ kind: 'words', text }, [])).toEqual({
        ok: false,
        reason: 'empty',
        message: QUESTIONS_COPY.answerEmpty,
      });
    }
  });
});

describe('the question calls', () => {
  it('lists the open questions under the web key', async () => {
    const { client, transport } = clientAnswering(200, { grants: [GRANT] });
    const list = await fetchQuestions(client);
    expect(list.grants.map((grant) => grant.id)).toEqual([31]);
    const [call] = transport.calls;
    expect(call.method).toBe('GET');
    expect(call.url).toBe(`${SERVER.apiUrl}/api/v1/approval-grants?status=pending&kind=question`);
    expect(questionsQuery(client).queryKey).toEqual(QUESTIONS_KEY);
    expect(QUESTIONS_KEY).toEqual(queryKeys.questions('pending', 'question'));
  });

  it('posts an option to /answer', async () => {
    const { client, transport } = clientAnswering(200, answered(OPTIONS[0]));
    await answerQuestion(client, 31, { kind: 'option', option: OPTIONS[0] }, OPTIONS);
    expect(transport.calls.map((call) => [call.method, call.url, call.body])).toEqual([
      [
        'POST',
        `${SERVER.apiUrl}/api/v1/approval-grants/31/answer`,
        JSON.stringify({ option: OPTIONS[0] }),
      ],
    ]);
  });

  it('posts your own words to /answer', async () => {
    const { client, transport } = clientAnswering(200, answered('Wait for me.'));
    await answerQuestion(client, 31, { kind: 'words', text: ' Wait for me. ' }, OPTIONS);
    expect(transport.calls[0].body).toBe(JSON.stringify({ answer_text: 'Wait for me.' }));
  });

  it('sends nothing for blank words, a foreign option or a bad id', async () => {
    const { client, transport } = clientAnswering(200, answered('x'));
    await expect(
      answerQuestion(client, 31, { kind: 'words', text: ' ' }, OPTIONS),
    ).rejects.toBeInstanceOf(AnswerInputError);
    await expect(
      answerQuestion(client, 31, { kind: 'option', option: 'Nope' }, OPTIONS),
    ).rejects.toMatchObject({ reason: 'not_offered' });
    await expect(
      answerQuestion(client, 0, { kind: 'words', text: 'Yes' }, OPTIONS),
    ).rejects.toBeInstanceOf(TypeError);
    await expect(dismissQuestion(client, 1.5)).rejects.toBeInstanceOf(TypeError);
    expect(transport.calls).toHaveLength(0);
  });

  it('dismisses with POST /deny and no body', async () => {
    const { client, transport } = clientAnswering(200, answered(null, 'denied'));
    const result = await dismissQuestion(client, 31);
    expect(result.grant).toMatchObject({ id: 31, status: 'denied' });
    expect(transport.calls[0]).toMatchObject({
      method: 'POST',
      url: `${SERVER.apiUrl}/api/v1/approval-grants/31/deny`,
    });
    expect(transport.calls[0].body).toBeUndefined();
  });

  it('turns a 409 into a conflict that keeps the server’s words', async () => {
    const { client } = clientAnswering(409, { detail: 'Question #31 was already answered.' });
    const refused = await answerQuestion(client, 31, { kind: 'words', text: 'Yes' }, OPTIONS).catch(
      (error: unknown) => error,
    );
    expect(refused).toMatchObject({ kind: 'conflict', status: 409 });
    expect(refusalMessage(refused)).toBe('Question #31 was already answered.');
  });
});

describe('what the toast says', () => {
  it('says Answered. when the server recorded this answer', () => {
    expect(answeredMessage(answered(OPTIONS[0]), { kind: 'option', option: OPTIONS[0] })).toBe(
      'Answered.',
    );
    expect(answeredMessage(answered('Wait.'), { kind: 'words', text: ' Wait. ' })).toBe(
      'Answered.',
    );
    expect(answeredMessage({ grant: null }, { kind: 'words', text: 'Wait.' })).toBe('Answered.');
  });

  it('never claims the agent is resuming', () => {
    const words = answeredMessage(answered('Wait.'), { kind: 'words', text: 'Wait.' });
    expect(words.toLowerCase()).not.toContain('resum');
  });

  it('says already answered when another answer won the race (200 with the winner’s row)', () => {
    expect(answeredMessage(answered('Use the key'), { kind: 'words', text: 'Wait.' })).toBe(
      QUESTIONS_COPY.alreadyAnswered,
    );
    expect(answeredMessage(answered(null, 'denied'), { kind: 'words', text: 'Wait.' })).toBe(
      QUESTIONS_COPY.alreadyDismissed,
    );
  });

  it('says what a dismiss did: the ticket stays blocked, or the stopped run closes', () => {
    expect(dismissedMessage(false)).toBe(QUESTIONS_COPY.dismissed.blocked);
    expect(dismissedMessage(true)).toBe(QUESTIONS_COPY.dismissed.stoppedRun);
  });
});

describe('the refusals', () => {
  it('shows a 409’s own words (PRD-266)', () => {
    const conflict = new ApiError('conflict', {
      status: 409,
      serverMessage: 'Question #31 was already answered.',
    });
    expect(refusalMessage(conflict)).toBe('Question #31 was already answered.');
  });

  it('says a question no longer open was already answered or dismissed (today’s 422)', () => {
    const notOpen = (status: string) =>
      new ApiError('server', {
        status: 422,
        serverMessage: `Question is not open (status: ${status})`,
      });
    expect(refusalMessage(notOpen('granted'))).toBe(QUESTIONS_COPY.alreadyAnswered);
    expect(refusalMessage(notOpen('denied'))).toBe(QUESTIONS_COPY.alreadyDismissed);
    expect(refusalMessage(notOpen('expired'))).toBe('Question is not open (status: expired)');
    const deny = new ApiError('server', {
      status: 422,
      serverMessage: 'Grant is not pending (status: granted)',
    });
    expect(refusalMessage(deny)).toBe(QUESTIONS_COPY.alreadyAnswered);
  });

  it('shows any other 422 in the server’s words (an option not offered)', () => {
    const foreign = new ApiError('server', {
      status: 422,
      serverMessage: 'option is not one of the offered choices',
    });
    expect(refusalMessage(foreign)).toBe('option is not one of the offered choices');
  });

  it('shows the forbidden copy for a 403, the taxonomy for the rest, and input words as said', () => {
    const forbidden = new ApiError('forbidden', { status: 403, serverMessage: 'Admins only' });
    expect(refusalMessage(forbidden)).toBe(API_ERROR_COPY.forbidden);
    expect(isForbidden(forbidden)).toBe(true);
    expect(isForbidden(new ApiError('network'))).toBe(false);
    expect(refusalMessage(new ApiError('network'))).toBe(API_ERROR_COPY.network);
    expect(refusalMessage(new ApiError('server', { status: 422 }))).toBe(API_ERROR_COPY.server);
    expect(refusalMessage(new AnswerInputError('empty', QUESTIONS_COPY.answerEmpty))).toBe(
      QUESTIONS_COPY.answerEmpty,
    );
  });
});

describe('the role matrix (D16, D17)', () => {
  it('lets owners, admins and editors answer and dismiss', () => {
    for (const role of WRITERS) {
      expect(mayAnswer(role)).toBe(true);
      expect(readOnlyReason(role)).toBeNull();
    }
  });

  it('gives a viewer the questions read-only with the reason', () => {
    expect(mayAnswer('viewer')).toBe(false);
    expect(readOnlyReason('viewer')).toBe(QUESTIONS_COPY.readOnly);
  });

  it('offers nothing and says nothing before the role is known', () => {
    for (const role of [null, undefined]) {
      expect(mayAnswer(role)).toBe(false);
      expect(readOnlyReason(role)).toBeNull();
    }
    expect(WORKSPACE_ROLES.filter(mayAnswer)).toEqual(WRITERS);
  });
});

describe('the card leaves once answered', () => {
  it('drops one question from the list without touching the rest', () => {
    const list = QuestionsSchema.parse({ grants: [GRANT, { ...GRANT, id: 32 }] });
    const left = withoutQuestion(list, 31);
    expect(left.grants.map((grant) => grant.id)).toEqual([32]);
    expect(list.grants).toHaveLength(2);
  });
});
