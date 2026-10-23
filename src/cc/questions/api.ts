// The Questions' calls, through the foundation's one client (D-ONE-CLIENT) and the route table
// (src/cc/routes.ts), under the web's key (use-approval-grants.ts useQuestions: list('pending',
// 'question')), so the stream's board_changed invalidation reaches it with no wiring here (D-LIVE).
// An answer or a dismiss is sent at once and never queued (the client's mutations run networkMode
// 'always'); the server's compare-and-swap is the truth (D-WRITES).

import { queryOptions } from '@tanstack/react-query';

import type { ApiClient } from '../../api/client';
import { queryKeys } from '../../api/query-keys';
import { CC_ROUTES } from '../routes';
import { AnswerInputError, answerBody, type AnswerChoice } from './answer';
import {
  DecisionResultSchema,
  QuestionsSchema,
  type DecisionResult,
  type Questions,
} from './schemas';

/** The open questions: pending grants of kind question. */
export const QUESTIONS_STATUS = 'pending';
export const QUESTION_KIND = 'question';

/** The tab's one cache entry. */
export const QUESTIONS_KEY = queryKeys.questions(QUESTIONS_STATUS, QUESTION_KIND);

/** A grant's row id: a positive integer. */
function grantId(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError('A question id is a row id');
  return String(value);
}

export function fetchQuestions(client: ApiClient, signal?: AbortSignal): Promise<Questions> {
  return client.request(CC_ROUTES.questions.list, {
    query: { status: QUESTIONS_STATUS, kind: QUESTION_KIND },
    schema: QuestionsSchema,
    signal,
  });
}

/** The Questions tab's query (never persisted: query-keys.ts 'questions'). */
export function questionsQuery(client: ApiClient) {
  return queryOptions({
    queryKey: QUESTIONS_KEY,
    queryFn: ({ signal }) => fetchQuestions(client, signal),
  });
}

/** Answer with an offered option or in your own words; a blank or foreign choice is refused unsent. */
export async function answerQuestion(
  client: ApiClient,
  id: number,
  choice: AnswerChoice,
  offered: readonly string[],
): Promise<DecisionResult> {
  const grant = grantId(id);
  const checked = answerBody(choice, offered);
  if (!checked.ok) throw new AnswerInputError(checked.reason, checked.message);
  return client.request(CC_ROUTES.questions.answer, {
    params: { grant_id: grant },
    body: checked.body,
    schema: DecisionResultSchema,
  });
}

/** Dismiss (deny): the ticket stays blocked, or a stopped run's question closes its run. */
export async function dismissQuestion(client: ApiClient, id: number): Promise<DecisionResult> {
  return client.request(CC_ROUTES.questions.deny, {
    params: { grant_id: grantId(id) },
    schema: DecisionResultSchema,
  });
}
