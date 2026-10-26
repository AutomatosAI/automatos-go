// The Calendar's calls, through the foundation's one client (D-ONE-CLIENT) and the route table
// (src/cc/routes.ts): the seven-day feed under the shared key (query-keys.ts 'schedule', the web's
// activityQueryKeys.schedule('7d')), and the two pauses D27 allows. A pause is sent at once and
// never queued (the client's mutations run networkMode 'always'); the server's answer is the truth.
// After a pause the feed is read again: a paused routine then leaves it (activity_service.py lists
// enabled heartbeats only), and a paused scheduled task stays with paused: true
// (activity_scheduled_task_items.py), greyed, with Resume.

import { queryOptions } from '@tanstack/react-query';

import type { ApiClient } from '../../api/client';
import { queryKeys } from '../../api/query-keys';
import { CC_ROUTES } from '../routes';
import type { PauseState, SentPause } from './pause';
import {
  RoutineToggleSchema,
  ScheduledTaskStatusResultSchema,
  ScheduleSchema,
  type RoutineToggle,
  type Schedule,
  type ScheduledTaskStatusResult,
} from './schemas';

/** The strip's week: the server's 7d range (7d | 14d | 30d). */
export const SCHEDULE_RANGE = '7d';

/** An agent's or a scheduled task's row id: a positive integer, never a feed id ('routine-7'). */
function rowId(value: number, what: string): string {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${what} is a row id`);
  return String(value);
}

export function fetchSchedule(client: ApiClient, signal?: AbortSignal): Promise<Schedule> {
  return client.request(CC_ROUTES.calendar.schedule, {
    query: { range: SCHEDULE_RANGE },
    schema: ScheduleSchema,
    signal,
  });
}

/** The Calendar's query: one key for the week, persisted with the list (query-keys.ts). */
export function scheduleQuery(client: ApiClient) {
  return queryOptions({
    queryKey: queryKeys.schedule(SCHEDULE_RANGE),
    queryFn: ({ signal }) => fetchSchedule(client, signal),
  });
}

/** Pause or resume a routine: the server flips its heartbeat and says which way it went. */
export function toggleRoutine(client: ApiClient, agentId: number): Promise<RoutineToggle> {
  return client.request(CC_ROUTES.calendar.toggleRoutine, {
    params: { agent_id: rowId(agentId, 'An agent id') },
    schema: RoutineToggleSchema,
  });
}

/** Pause ('paused') or resume ('active') an agent-scheduled task. */
export function setScheduledTaskStatus(
  client: ApiClient,
  id: number,
  status: PauseState,
): Promise<ScheduledTaskStatusResult> {
  return client.request(CC_ROUTES.calendar.scheduledTaskStatus, {
    params: { task_id: rowId(id, 'A scheduled task id') },
    body: { status },
    schema: ScheduledTaskStatusResultSchema,
  });
}

/**
 * Send the pause pauseAction decided: the routine's toggle or the task's next state. Resolves with
 * whether the item is paused now as the server answered (a heartbeat not enabled, a task 'paused'),
 * or null when the answer did not say.
 */
export async function sendPause(client: ApiClient, action: SentPause): Promise<boolean | null> {
  if (action.kind === 'routine') {
    const { enabled } = await toggleRoutine(client, action.agentId);
    return enabled === null ? null : !enabled;
  }
  const { status } = await setScheduledTaskStatus(client, action.id, action.next);
  if (status === 'paused') return true;
  return status === 'active' ? false : null;
}
