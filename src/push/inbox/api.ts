// The inbox's calls, through the foundation's one client (D-ONE-CLIENT) with the push wave's route
// table (src/push/routes.ts): the bell's rows, the unread number, read-all, and the two lookups
// that find where an approval's or a Mission plan's card is. Marking ONE row read is src/push/api.ts
// markNotificationRead, shared with the push handler. Every answer is parsed with its schema
// (schemas.ts); a failure is the client's ApiError, passed on as is. A bad id throws before
// anything is sent. Nothing here logs.

import type { ApiClient } from '../../api/client';
import { PENDING_STATUS, UUID_PATTERN } from '../config';
import { PUSH_ROUTES } from '../routes';
import {
  grantPlacesSchema,
  inboxListSchema,
  missionPlaceSchema,
  unreadCountSchema,
  type GrantPlace,
  type InboxList,
  type MissionPlace,
} from './schemas';

/** The rows one inbox read asks for: the server's own most (le=100), newest first. */
export const INBOX_PAGE_SIZE = 50;

export function listNotifications(client: ApiClient, signal?: AbortSignal): Promise<InboxList> {
  return client.request(PUSH_ROUTES.notifications.list, {
    query: { limit: INBOX_PAGE_SIZE, offset: 0 },
    schema: inboxListSchema,
    signal,
  });
}

export async function unreadNotifications(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<number> {
  const answer = await client.request(PUSH_ROUTES.notifications.unreadCount, {
    schema: unreadCountSchema,
    signal,
  });
  return answer.count;
}

/** Every unread row read; the answer's count is not needed (the lists are read again). */
export function markAllNotificationsRead(client: ApiClient): Promise<void> {
  return client.request(PUSH_ROUTES.notifications.readAll);
}

/** The workspace's open grants (questions and approvals), each with where its card is. */
export async function pendingGrantPlaces(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<readonly GrantPlace[]> {
  const answer = await client.request(PUSH_ROUTES.questions.list, {
    query: { status: PENDING_STATUS },
    schema: grantPlacesSchema,
    signal,
  });
  return Object.freeze(answer.grants);
}

export function getMissionPlace(
  client: ApiClient,
  missionId: string,
  signal?: AbortSignal,
): Promise<MissionPlace> {
  if (!UUID_PATTERN.test(missionId)) throw new TypeError('A Mission id is a UUID');
  return client.request(PUSH_ROUTES.mission, {
    params: { mission_id: missionId },
    schema: missionPlaceSchema,
    signal,
  });
}
