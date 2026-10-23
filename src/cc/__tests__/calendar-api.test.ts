import { describe, expect, it } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { queryKeys } from '../../api/query-keys';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import {
  fetchSchedule,
  scheduleQuery,
  SCHEDULE_RANGE,
  sendPause,
  setScheduledTaskStatus,
  toggleRoutine,
} from '../calendar/api';
import { everyWord, weekdaysWord } from '../calendar/cadence';
import { dailyCron, parseIntervalMinutes } from '../calendar/occurrences';
import { ScheduleSchema } from '../calendar/schemas';
import { zoneOffsetMinutes } from '../calendar/zone';

const WS = '7f1c2a54-0000-4000-8000-000000000001';

// A routine as services/activity_service.py _heartbeat_items serves it at the pinned SHA.
const ROUTINE = {
  id: 'routine-7',
  name: 'Relay Routine',
  type: 'routine',
  next_run_at: '2026-10-22T12:15:00+00:00',
  frequency: 'Every 15m',
  agent_name: 'Relay',
  agent_id: 7,
  recurrence: {
    cron_expression: '*/15 * * * *',
    interval_minutes: 15,
    timezone: 'Europe/London',
    active_hours: { start: '08:00', end: '20:00' },
  },
};

// A scheduled task as _scheduled_task_items serves it (fields the calendar does not read too).
const TASK = {
  id: 'task-12',
  scheduled_task_id: 12,
  task_type: 'recurring',
  deliver_as: 'board_task',
  name: 'Weekly numbers',
  type: 'task',
  next_run_at: '2026-10-23T09:00:00+00:00',
  frequency: '0 9 * * 5',
  agent_name: 'Ledger',
  agent_id: null,
  recurrence: { cron_expression: '0 9 * * 5', interval_minutes: null, timezone: 'UTC' },
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

describe('the schedule schema', () => {
  it('keeps what the calendar reads and ignores the rest', () => {
    const [routine, task] = ScheduleSchema.parse({
      scheduled: [ROUTINE, TASK],
      scheduler_active: true,
    }).scheduled;
    expect(routine).toEqual({
      id: 'routine-7',
      name: 'Relay Routine',
      type: 'routine',
      next_run_at: '2026-10-22T12:15:00+00:00',
      frequency: 'Every 15m',
      agent_name: 'Relay',
      agent_id: 7,
      scheduled_task_id: null,
      playbook_id: null,
      mission_id: null,
      board_task_id: null,
      post_id: null,
      paused: false,
      recurrence: {
        cron_expression: '*/15 * * * *',
        interval_minutes: 15,
        timezone: 'Europe/London',
      },
    });
    expect(task.scheduled_task_id).toBe(12);
    expect(task).not.toHaveProperty('deliver_as');
    expect(task).not.toHaveProperty('task_type');
  });

  it('keeps a kind outside the six as sent, and reads paused when the server sends it', () => {
    const [odd, paused] = ScheduleSchema.parse({
      scheduled: [
        { ...TASK, id: 'call-1', type: 'video_call' },
        { ...TASK, paused: true },
      ],
    }).scheduled;
    expect(odd.type).toBe('video_call');
    expect(paused.paused).toBe(true);
  });

  it("reads a mission's run id as text and an odd recurrence as none", () => {
    const [mission, numbered, bare] = ScheduleSchema.parse({
      scheduled: [
        { ...TASK, id: 'mission-a', type: 'mission', mission_id: '9b2e-41' },
        { ...TASK, id: 'mission-b', type: 'mission', mission_id: 42 },
        { ...TASK, id: 'odd', recurrence: 'daily', paused: 'yes', name: null },
      ],
    }).scheduled;
    expect([mission.mission_id, numbered.mission_id]).toEqual(['9b2e-41', '42']);
    expect([bare.recurrence, bare.paused, bare.name]).toEqual([null, false, '']);
  });

  it('leaves out an item it cannot read, never the whole calendar', () => {
    const parsed = ScheduleSchema.parse({ scheduled: [ROUTINE, { name: 'no id' }, TASK] });
    expect(parsed.scheduled.map((each) => each.id)).toEqual(['routine-7', 'task-12']);
    expect(parsed.scheduler_active).toBe(true);
  });

  it('refuses a body with no list', () => {
    expect(ScheduleSchema.safeParse({ scheduler_active: true }).success).toBe(false);
  });
});

describe('the calendar calls', () => {
  it('reads the seven-day feed under the shared key', async () => {
    const { client, transport } = clientAnswering(200, {
      scheduled: [ROUTINE],
      scheduler_active: true,
    });
    const schedule = await fetchSchedule(client);
    expect(schedule.scheduled.map((each) => each.id)).toEqual(['routine-7']);
    expect(transport.calls[0]).toMatchObject({
      method: 'GET',
      url: `${SERVER.apiUrl}/api/activity/schedule?range=7d`,
    });
    expect(scheduleQuery(client).queryKey).toEqual(queryKeys.schedule(SCHEDULE_RANGE));
  });

  it("flips a routine's heartbeat by its agent", async () => {
    const { client, transport } = clientAnswering(200, {
      id: 7,
      agent_id: 7,
      agent_name: 'Relay',
      enabled: false,
      interval_minutes: 15,
      message: 'Heartbeat paused for Relay',
    });
    expect(await toggleRoutine(client, 7)).toEqual({
      enabled: false,
      message: 'Heartbeat paused for Relay',
    });
    expect(transport.calls[0]).toMatchObject({
      method: 'PATCH',
      url: `${SERVER.apiUrl}/api/heartbeat/7/toggle`,
    });
    expect(transport.calls[0].body).toBeUndefined();
  });

  it('pauses and resumes a scheduled task with the state in the body', async () => {
    const { client, transport } = clientAnswering(200, {
      success: true,
      task_id: 12,
      status: 'paused',
    });
    expect(await setScheduledTaskStatus(client, 12, 'paused')).toEqual({ status: 'paused' });
    await sendPause(client, { kind: 'scheduled_task', id: 12, next: 'active' });
    await sendPause(client, { kind: 'routine', agentId: 7 });
    expect(transport.calls.map((call) => [call.method, call.url, call.body])).toEqual([
      ['PATCH', `${SERVER.apiUrl}/api/v1/scheduled-tasks/12/status`, '{"status":"paused"}'],
      ['PATCH', `${SERVER.apiUrl}/api/v1/scheduled-tasks/12/status`, '{"status":"active"}'],
      ['PATCH', `${SERVER.apiUrl}/api/heartbeat/7/toggle`, undefined],
    ]);
  });

  it('refuses an id that is not a row id: nothing is sent', async () => {
    const { client, transport } = clientAnswering(200, {});
    expect(() => toggleRoutine(client, 0)).toThrow(TypeError);
    expect(() => setScheduledTaskStatus(client, 1.5, 'paused')).toThrow(TypeError);
    expect(transport.calls).toHaveLength(0);
  });

  it("passes the server's refusal through as the taxonomy's error", async () => {
    const { client } = clientAnswering(403, { detail: 'Missing permission: agents:update' });
    const refused = await toggleRoutine(client, 7).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(ApiError);
    expect(refused).toMatchObject({ kind: 'forbidden' });
  });
});

describe('cadence and cron reading', () => {
  it('words an interval as the server does', () => {
    expect([15, 60, 90, 120, 1440, 2880].map(everyWord)).toEqual([
      'every 15 min',
      'hourly',
      'every 90 min',
      'every 2 h',
      'daily',
      'every 2 days',
    ]);
  });

  it('words weekdays', () => {
    expect(weekdaysWord(new Set([0, 1, 2, 3, 4, 5, 6]))).toBe('daily');
    expect(weekdaysWord(new Set([1, 2, 3, 4, 5]))).toBe('weekdays');
    expect(weekdaysWord(new Set([0, 6]))).toBe('weekends');
    expect(weekdaysWord(new Set([5, 1, 3]))).toBe('Mon, Wed, Fri');
  });

  it('reads a cron at a fixed time on every day of the month, and nothing else', () => {
    expect([...(dailyCron('0 9 * * *')?.weekdays ?? [])]).toHaveLength(7);
    expect([...(dailyCron('30 7 * * 1,3-4')?.weekdays ?? [])]).toEqual([1, 3, 4]);
    expect(dailyCron('30 7 * * 1,3-4')).toMatchObject({ hour: 7, minute: 30 });
    expect(dailyCron('0 24 * * *')).toBeNull();
    expect(dailyCron('60 9 * * *')).toBeNull();
    expect([...(dailyCron('0 9 * * 0,7')?.weekdays ?? [])]).toEqual([0]);
    for (const other of ['*/15 * * * *', '0 */2 * * *', '0 9 1 * *', '0 9 * 6 *', '0 9 * * MON']) {
      expect(dailyCron(other)).toBeNull();
    }
    expect(dailyCron('0 9 * * 5-1')).toBeNull();
    expect(dailyCron(null)).toBeNull();
  });

  it("reads the web's 'Every N' frequencies", () => {
    expect(['Every 30m', 'Every 8h', 'Every 1d', 'Daily', null].map(parseIntervalMinutes)).toEqual([
      30,
      480,
      1440,
      null,
      null,
    ]);
  });

  it("reads a zone's offset either side of its clock change", () => {
    expect(zoneOffsetMinutes(Date.parse('2026-10-22T12:00:00Z'), 'Europe/London')).toBe(60);
    expect(zoneOffsetMinutes(Date.parse('2026-10-26T12:00:00Z'), 'Europe/London')).toBe(0);
    expect(zoneOffsetMinutes(Date.parse('2026-10-22T12:00:00Z'), 'America/New_York')).toBe(-240);
    expect(zoneOffsetMinutes(Date.parse('2026-10-22T12:00:30Z'), 'Asia/Kolkata')).toBe(330);
  });
});
