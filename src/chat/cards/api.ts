// The cards' calls (D-CARDS, D-ONE-CLIENT): through the foundation's client, on the chat's route
// table, every answer parsed (MissionRunSchema, GrantResultSchema). Reject takes only a RejectBody,
// which rejectBody() builds once the reason is there, so no reject ever goes out without one. A
// grant's /grant and /deny send no body (the web's apiClient.grantApproval / denyApproval). Failures
// are the client's ApiError taxonomy; refusalText and grantRefusalText (actions.ts) say them.

import type { ApiClient } from '../../api/client';
import { CHAT_ROUTES } from '../routes';
import { GrantResultSchema, MissionRunSchema, type GrantResult, type MissionRun } from '../schemas';
import { approveBody, type MissionCreateBody, type RejectBody } from './actions';

/** 'File it': POST /api/missions; the run comes back planning. */
export function createMission(
  client: ApiClient,
  body: MissionCreateBody,
  signal?: AbortSignal,
): Promise<MissionRun> {
  return client.request(CHAT_ROUTES.createMission, { body, schema: MissionRunSchema, signal });
}

/** Approve & run: POST /api/missions/{id}/approve with the empty body. */
export function approveMission(
  client: ApiClient,
  missionId: string,
  signal?: AbortSignal,
): Promise<MissionRun> {
  return client.request(CHAT_ROUTES.approveMission, {
    params: { mission_id: missionId },
    body: approveBody(),
    schema: MissionRunSchema,
    signal,
  });
}

/** Reject: POST /api/missions/{id}/reject {reason}. */
export function rejectMission(
  client: ApiClient,
  missionId: string,
  body: RejectBody,
  signal?: AbortSignal,
): Promise<MissionRun> {
  return client.request(CHAT_ROUTES.rejectMission, {
    params: { mission_id: missionId },
    body,
    schema: MissionRunSchema,
    signal,
  });
}

/** Approve & run on a tool approval: POST /api/v1/approval-grants/{id}/grant, no body. */
export function grantApproval(
  client: ApiClient,
  grantId: number,
  signal?: AbortSignal,
): Promise<GrantResult> {
  return client.request(CHAT_ROUTES.grantApproval, {
    params: { grant_id: grantId },
    schema: GrantResultSchema,
    signal,
  });
}

/** Deny on a tool approval, and the withdraw offer's Withdraw: POST …/{id}/deny, no body. */
export function denyApproval(
  client: ApiClient,
  grantId: number,
  signal?: AbortSignal,
): Promise<GrantResult> {
  return client.request(CHAT_ROUTES.denyApproval, {
    params: { grant_id: grantId },
    schema: GrantResultSchema,
    signal,
  });
}
