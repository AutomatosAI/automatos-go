// The Mission cards' calls (D-CARDS, D-ONE-CLIENT): through the foundation's client, on the chat's
// route table, every answer parsed with MissionRunSchema. Reject takes only a RejectBody, which
// rejectBody() builds once the reason is there, so no reject ever goes out without one. Failures
// are the client's ApiError taxonomy; refusalText (actions.ts) says them.

import type { ApiClient } from '../../api/client';
import { CHAT_ROUTES } from '../routes';
import { MissionRunSchema, type MissionRun } from '../schemas';
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
