// The writes that ask for Face ID first (D19, KP13; US-015e; PRD-268's Try again), each as its
// gated sender (A4's gated.ts beside A2's and A3's code) and the sender called without it, so a test can prove a
// refused check sends nothing and a passed one sends exactly what the write sent before. The real
// gate is createGuard over createStepUp over the step-up kit's fake LocalAuthentication.

import { vi } from 'vitest';

import { createApiClient, type ApiClient } from '../../api/client';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import type { TransportRequest } from '../../api/transport-types';
import { approveTicket } from '../../cc/board/api';
import type { AnswerChoice } from '../../cc/questions/answer';
import { answerQuestion } from '../../cc/questions/api';
import { answerGated } from '../../cc/questions/gated';
import { approveShown } from '../../cc/social/api';
import { approvePostGated } from '../../cc/social/gated';
import { SocialPostSchema } from '../../cc/social/schemas';
import { sendRetry } from '../../cc/status/api';
import { retryGated } from '../../cc/status/gated';
import { retryAction, type RetryAction } from '../../cc/status/row-status';
import { approveTicketGated } from '../../cc/ticket/gated';
import { approveMission } from '../../chat/cards/api';
import { approvePlanGated, grantToolGated } from '../../chat/cards/gated';
import { grantCall } from '../../chat/cards/grants';
import { createGuard, type Guard } from '../../step-up/guard';
import type { AuthResult, GatedAction } from '../../step-up/policy';
import { createStepUp } from '../../step-up/step-up';
import { fakeAuth } from '../../step-up/__tests__/step-up-fixtures';

const WS = '7f1c2a54-0000-4000-8000-000000000001';
const MISSION_ID = 'c0ffee00-0000-4000-8000-000000000042';
const GRANT_ID = 31;
const QUESTION_ID = 44;
const TASK_ID = 2680;
const POST_ID = '5b0c3f7e-8a51-4c1f-9d2e-0f6a7b8c9d10';
const HASH = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
export const OPTIONS = Object.freeze(['Ship it', 'Wait for me']);
const OPTION: AnswerChoice = { kind: 'option', option: 'Ship it' };
const WORDS: AnswerChoice = { kind: 'words', text: ' Ship it on Monday. ' };

const SHOWN = SocialPostSchema.parse({ id: POST_ID, status: 'needs_approval', content_hash: HASH });
/** A pass never reaches the reload: the fake server answers 200. */
const reload = async () => undefined;

/** A failed ticket's Try again (PRD-268 retry_ticket → Run Now). */
const RETRY = retryAction({ kind: 'retry_ticket' }, { ticketId: TASK_ID, missionId: null });
function retryOf(): RetryAction {
  if (!RETRY) throw new Error('retry_ticket has no route');
  return RETRY;
}

export type GatedCase = Readonly<{
  label: string;
  action: GatedAction;
  /** Where the write goes: method and URL. */
  route: string;
  /** The server's 200 body. */
  answer: unknown;
  /** A4's gated sender; true when it reports the write went out. */
  gated: (guard: Guard, client: ApiClient) => Promise<boolean>;
  /** The sender A2 or A3 called before the gate: what the gated one must send. */
  plain: (client: ApiClient) => Promise<unknown>;
}>;

const api = (path: string) => `POST ${SERVER.apiUrl}${path}`;

export const GATED_CASES: readonly GatedCase[] = Object.freeze([
  {
    label: "A2's plan approval Approve & run",
    action: 'approve_plan',
    route: api(`/api/missions/${MISSION_ID}/approve`),
    answer: { id: MISSION_ID, goal: 'Ship the launch', state: 'running' },
    gated: async (guard, client) => (await approvePlanGated(guard, MISSION_ID)(client)) !== null,
    plain: (client) => approveMission(client, MISSION_ID),
  },
  {
    label: "A2's tool approval Approve & run",
    action: 'grant_tool',
    route: api(`/api/v1/approval-grants/${GRANT_ID}/grant`),
    answer: { grant: { id: GRANT_ID, status: 'granted', details: null } },
    gated: async (guard, client) => (await grantToolGated(guard, GRANT_ID)(client)) !== null,
    plain: (client) => grantCall(GRANT_ID)(client),
  },
  {
    label: "A3's Questions answer, an option",
    action: 'answer',
    route: api(`/api/v1/approval-grants/${QUESTION_ID}/answer`),
    answer: { grant: { id: QUESTION_ID, status: 'granted', answer_text: 'Ship it' } },
    gated: async (guard, client) =>
      (await answerGated(guard, client, QUESTION_ID, OPTION, OPTIONS)).ran,
    plain: (client) => answerQuestion(client, QUESTION_ID, OPTION, OPTIONS),
  },
  {
    label: "A3's Questions answer, in your own words",
    action: 'answer',
    route: api(`/api/v1/approval-grants/${QUESTION_ID}/answer`),
    answer: { grant: { id: QUESTION_ID, status: 'granted', answer_text: 'Ship it on Monday.' } },
    gated: async (guard, client) =>
      (await answerGated(guard, client, QUESTION_ID, WORDS, OPTIONS)).ran,
    plain: (client) => answerQuestion(client, QUESTION_ID, WORDS, OPTIONS),
  },
  {
    label: "A3's ticket Approve",
    action: 'approve_ticket',
    route: api(`/api/v1/tasks/${TASK_ID}/approve`),
    answer: { status: 'done', message: null },
    gated: async (guard, client) => (await approveTicketGated(guard, client, TASK_ID)).ran,
    plain: (client) => approveTicket(client, TASK_ID),
  },
  {
    label: "A3's social Approve",
    action: 'approve_social',
    route: api(`/api/socials/posts/${POST_ID}/approve`),
    answer: { status: 'approved' },
    gated: async (guard, client) => (await approvePostGated(guard, client, SHOWN, reload)).ran,
    plain: (client) => approveShown(client, SHOWN, reload),
  },
  {
    label: "PRD-268's Try again on a failed ticket",
    action: 'retry',
    route: api(`/api/v1/tasks/${TASK_ID}/run-now`),
    answer: { success: true, task_id: TASK_ID, status: 'assigned', message: 'Running again.' },
    gated: async (guard, client) => (await retryGated(guard, client, retryOf())).ran,
    plain: (client) => sendRetry(client, retryOf()),
  },
]);

/** A server that answers every request 200 with body, recording each. */
export function serverAnswering(body: unknown) {
  const transport = fakeTransport(() => jsonReply(200, body));
  const client = createApiClient({
    server: SERVER,
    getToken: async () => 'token',
    getWorkspaceId: () => WS,
    transport,
  });
  return { client, transport };
}

/** What went on the wire, without the signal. */
export const wire = ({ method, url, headers, body }: TransportRequest) => ({
  method,
  url,
  headers,
  body,
});

/** The app's gate over a phone whose prompt answers result; the switch on unless said. */
export function gate(result: AuthResult | Error, settingOn = true) {
  const auth = fakeAuth({ result });
  const notify = vi.fn();
  const check = createStepUp({ auth: auth.port, settingOn: () => settingOn });
  return { guard: createGuard({ check, notify }), auth, notify };
}
