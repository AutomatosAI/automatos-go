import { describe, expect, it } from 'vitest';

import { WORKSPACE_ROLES } from '../../api/workspace';
import { KIND_META } from '../../core/web/components/command-center/calendar-kinds';
import { dayModel, kindWord } from '../calendar/day-model';
import { pauseAction, pauseOffer, STUDIO_CALENDAR_PATH } from '../calendar/pause';
import { ScheduleSchema, type ScheduleEntry } from '../calendar/schemas';

// Thursday 22 Oct 2026, 12:00 UTC: 13:00 in London (BST until Sunday 25th), 08:00 in New York.
const NOW = new Date('2026-10-22T12:00:00Z');
const NO_RECURRENCE = {
  cron_expression: null,
  interval_minutes: null,
  timezone: 'UTC',
  active_hours: null,
};

// An item as services/activity_service.py get_schedule serves it at the pinned SHA.
function item(overrides: Record<string, unknown> = {}): ScheduleEntry {
  const wire = {
    id: 'social-1',
    post_id: '1',
    name: 'Launch post',
    type: 'social',
    next_run_at: '2026-10-22T15:00:00+00:00',
    frequency: 'One-off',
    agent_name: null,
    agent_id: null,
    recurrence: NO_RECURRENCE,
    ...overrides,
  };
  return ScheduleSchema.parse({ scheduled: [wire] }).scheduled[0];
}

function routine(interval: number, overrides: Record<string, unknown> = {}): ScheduleEntry {
  return item({
    id: 'routine-7',
    post_id: undefined,
    name: 'Inbox triage',
    type: 'routine',
    frequency: `Every ${interval}m`,
    agent_name: 'Relay',
    agent_id: 7,
    recurrence: { ...NO_RECURRENCE, cron_expression: null, interval_minutes: interval },
    ...overrides,
  });
}

// A playbook as the server sends it: next_run_at is croniter's on a UTC clock
// (services/schedule_util.py next_run), the zone beside it; the scheduler fires it in that zone.
function playbook(cron: string, timezone: string, nextRunAt: string): ScheduleEntry {
  return item({
    id: 'recipe-5',
    playbook_id: 5,
    name: 'Morning report',
    type: 'recipe',
    next_run_at: nextRunAt,
    frequency: cron,
    recurrence: { ...NO_RECURRENCE, cron_expression: cron, timezone },
  });
}

function model(items: ScheduleEntry[], timeZone: string | null, selected?: string) {
  return dayModel({ items, now: NOW, timeZone, selected });
}

/** The strip's weekdays: Thursday 22 to Wednesday 28 Oct without the weekend. */
const WEEKDAYS = ['2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28'];

/** Every row on the strip, day by day, as [day, time] on that phone's clock. */
function runsOn(entry: ScheduleEntry, timeZone: string): [string, string | null][] {
  return model([entry], timeZone).strip.flatMap((day) =>
    model([entry], timeZone, day.key).rows.map((row): [string, string | null] => [
      row.day,
      row.time,
    ]),
  );
}

describe('the seven-day strip', () => {
  it('starts today and runs seven days, with the words of each cell', () => {
    const { strip, today, selected } = model([], 'Europe/London');
    expect(today).toBe('2026-10-22');
    expect(selected).toBe('2026-10-22');
    expect(strip.map((day) => day.key)).toEqual([
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ]);
    expect(strip[0]).toEqual({
      key: '2026-10-22',
      weekday: 'Thu',
      day: 22,
      month: 'Oct',
      today: true,
      count: 0,
      hasItems: false,
    });
    expect(strip.filter((day) => day.today)).toHaveLength(1);
  });

  it("is today in the phone's zone, even when that is already tomorrow in UTC", () => {
    const late = new Date('2026-10-22T20:00:00Z');
    expect(dayModel({ items: [], now: late, timeZone: 'Asia/Tokyo' }).today).toBe('2026-10-23');
    expect(dayModel({ items: [], now: late, timeZone: 'America/Los_Angeles' }).today).toBe(
      '2026-10-22',
    );
  });

  it('runs across the turn of the year', () => {
    const keys = dayModel({
      items: [],
      now: new Date('2026-12-29T12:00:00Z'),
      timeZone: 'UTC',
    }).strip.map((day) => day.key);
    expect(keys.slice(2, 5)).toEqual(['2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('shows today when the day asked for is no longer on the strip', () => {
    expect(model([], 'UTC', '2026-10-21').selected).toBe('2026-10-22');
    expect(model([], 'UTC', '2026-10-25').selected).toBe('2026-10-25');
  });

  it("reads the phone's own clock without a zone, or with one the engine cannot read", () => {
    const local = new Date(NOW);
    const key = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
    expect(model([], null).today).toBe(key);
    expect(model([], 'Not/A_Zone').today).toBe(key);
  });
});

describe('grouping by day in the phone timezone', () => {
  const lateNight = item({ next_run_at: '2026-10-22T23:30:00+00:00' });

  it('puts a run after midnight in London on the next day', () => {
    const thursday = model([lateNight], 'Europe/London');
    expect(thursday.rows).toEqual([]);
    expect(thursday.strip.map((day) => day.hasItems).slice(0, 2)).toEqual([false, true]);
    const friday = model([lateNight], 'Europe/London', '2026-10-23');
    expect(friday.rows.map((row) => [row.day, row.time])).toEqual([['2026-10-23', '00:30']]);
  });

  it('keeps the same run on the same evening in New York', () => {
    const thursday = model([lateNight], 'America/New_York');
    expect(thursday.rows.map((row) => [row.day, row.time])).toEqual([['2026-10-22', '19:30']]);
    expect(thursday.strip[0]).toMatchObject({ hasItems: true, count: 1 });
    expect(thursday.strip[1].hasItems).toBe(false);
  });

  it('orders the day by time, then by title, with an untimed item last', () => {
    const rows = model(
      [
        item({ id: 'a', name: 'Later', next_run_at: '2026-10-22T18:00:00Z' }),
        item({ id: 'b', name: 'Untimed', next_run_at: null }),
        item({ id: 'c', name: 'Beta', next_run_at: '2026-10-22T09:00:00Z' }),
        item({ id: 'd', name: 'Alpha', next_run_at: '2026-10-22T09:00:00Z' }),
      ],
      'UTC',
    ).rows;
    expect(rows.map((row) => [row.title, row.time])).toEqual([
      ['Alpha', '09:00'],
      ['Beta', '09:00'],
      ['Later', '18:00'],
      ['Untimed', null],
    ]);
  });
});

describe('repeating items', () => {
  it('steps a routine slower than hourly across the whole day', () => {
    const everyTwo = routine(120, { next_run_at: '2026-10-22T14:00:00+00:00' });
    const { rows, band, strip } = model([everyTwo], 'UTC');
    expect(band).toEqual([]);
    expect(rows.map((row) => row.time)).toEqual(
      Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, '0')}:00`),
    );
    expect(rows[0].meta).toBe('Relay · every 2 h');
    expect(strip.every((day) => day.count === 12)).toBe(true);
  });

  it('holds a weekday cron at its hour in its own zone across the clock change', () => {
    // Fri 09:00Z: the server's anchor for 09:00 London, an hour after Friday's run (08:00Z)
    const report = playbook('0 9 * * 1-5', 'Europe/London', '2026-10-23T09:00:00+00:00');
    expect(model([report], 'Europe/London').strip.map((day) => day.count)).toEqual([
      1, 1, 0, 0, 1, 1, 1,
    ]);
    expect(runsOn(report, 'Europe/London')).toEqual(WEEKDAYS.map((day) => [day, '09:00']));
    expect(model([report], 'Europe/London').rows[0].meta).toBe('weekdays');
    // New York keeps summer time a week longer: 04:00 before London's change, 05:00 after
    expect(runsOn(report, 'America/New_York')).toEqual([
      ['2026-10-22', '04:00'],
      ['2026-10-23', '04:00'],
      ['2026-10-26', '05:00'],
      ['2026-10-27', '05:00'],
      ['2026-10-28', '05:00'],
    ]);
  });

  it('keeps a late Friday cron on Friday at its hour, not at midnight or on Saturday', () => {
    // Fri 23:00Z is Saturday 00:00 in London: the server's anchor, not the run (Fri 22:00Z)
    const late = playbook('0 23 * * 5', 'Europe/London', '2026-10-23T23:00:00+00:00');
    expect(runsOn(late, 'Europe/London')).toEqual([['2026-10-23', '23:00']]);
    expect(model([late], 'Europe/London').strip.map((day) => day.count)).toEqual([
      0, 1, 0, 0, 0, 0, 0,
    ]);
  });

  it("runs a Tokyo weekday cron at 20:00 Tokyo, shown at that moment on a London phone's clock", () => {
    // 20:00Z is 05:00 the next morning in Tokyo: the server's anchor, not the run (11:00Z)
    const tokyo = playbook('0 20 * * 1-5', 'Asia/Tokyo', '2026-10-22T20:00:00+00:00');
    expect(runsOn(tokyo, 'Asia/Tokyo')).toEqual(WEEKDAYS.map((day) => [day, '20:00']));
    expect(runsOn(tokyo, 'Europe/London')).toEqual([
      ['2026-10-22', '12:00'],
      ['2026-10-23', '12:00'],
      ['2026-10-26', '11:00'],
      ['2026-10-27', '11:00'],
      ['2026-10-28', '11:00'],
    ]);
  });

  it('lists a cron on one day of the month once, at its next run', () => {
    const monthly = item({
      type: 'task',
      scheduled_task_id: 12,
      next_run_at: '2026-10-24T09:00:00Z',
      frequency: '0 9 24 * *',
      recurrence: { ...NO_RECURRENCE, cron_expression: '0 9 24 * *' },
    });
    expect(model([monthly], 'UTC').strip.map((day) => day.count)).toEqual([0, 0, 1, 0, 0, 0, 0]);
  });
});

describe('the always-on band', () => {
  it('holds heartbeats every hour or faster, off the rows and without dots', () => {
    const triage = routine(15, { next_run_at: '2026-10-22T12:15:00+00:00' });
    const hourly = routine(60, { id: 'routine-8', agent_id: 8, name: 'Watch', agent_name: 'Owl' });
    const { rows, band, strip } = model([triage, hourly], 'Europe/London');
    expect(rows).toEqual([]);
    expect(strip.some((day) => day.hasItems)).toBe(false);
    expect(band).toEqual([
      {
        itemId: 'routine-7',
        kind: { type: 'routine', label: 'Heartbeat', tone: KIND_META.routine.tone },
        title: 'Inbox triage',
        agent: 'Relay',
        every: 'every 15 min',
        paused: false,
      },
      expect.objectContaining({ itemId: 'routine-8', every: 'hourly' }),
    ]);
  });
});

describe('kinds, deadlines and paused items', () => {
  it("takes each kind's word and colour from calendar-kinds", () => {
    for (const type of ['routine', 'recipe', 'task', 'mission', 'task_due', 'social'] as const) {
      expect(kindWord(type)).toEqual({
        type,
        label: KIND_META[type].label,
        tone: KIND_META[type].tone,
      });
    }
  });

  it('keeps a kind it does not know, under its own word and no colour', () => {
    const call = item({ id: 'call-1', type: 'video_call', name: 'Weekly sync' });
    const [row] = model([call], 'UTC').rows;
    expect(row.kind).toEqual({ type: 'video_call', label: 'Video call', tone: null });
    expect(kindWord('').label).toBe('Scheduled');
    expect(pauseAction(call)).toEqual({ kind: 'manage_in_studio', link: STUDIO_CALENDAR_PATH });
  });

  it('lists a deadline missed before today on today, with the day it was due', () => {
    const missed = item({
      id: 'board-2680',
      type: 'task_due',
      board_task_id: 2680,
      name: 'Draft the launch post',
      agent_name: 'Writer',
      agent_id: 4,
      next_run_at: '2026-10-20T09:00:00+00:00',
      frequency: 'SLA deadline',
    });
    const [row] = model([missed], 'UTC').rows;
    expect(row).toMatchObject({
      day: '2026-10-22',
      time: '09:00',
      dueOn: 'Tue 20 Oct',
      overdue: true,
      meta: 'Writer',
    });
  });

  it('marks a deadline earlier today overdue, a later one not; a missed one-off is not listed', () => {
    const rows = model(
      [
        item({ id: 'mission-a', type: 'mission', next_run_at: '2026-10-22T08:00:00Z' }),
        item({ id: 'mission-b', type: 'mission', next_run_at: '2026-10-22T18:00:00Z' }),
        item({ id: 'task-9', type: 'task', next_run_at: '2026-10-21T08:00:00Z' }),
      ],
      'UTC',
    ).rows;
    expect(rows.map((row) => [row.itemId, row.overdue, row.dueOn])).toEqual([
      ['mission-a', true, null],
      ['mission-b', false, null],
    ]);
  });

  it('greys a paused item and still lists it, in the rows and in the band', () => {
    const paused = item({
      id: 'task-12',
      type: 'task',
      scheduled_task_id: 12,
      paused: true,
      agent_name: 'Ledger',
      frequency: '0 15 * * *',
      recurrence: { ...NO_RECURRENCE, cron_expression: '0 15 * * *' },
    });
    const { rows, band } = model([paused, routine(30, { paused: true })], 'UTC');
    expect(rows).toEqual([expect.objectContaining({ itemId: 'task-12', paused: true })]);
    expect(rows[0].meta).toBe('Ledger · daily');
    expect(band).toEqual([expect.objectContaining({ itemId: 'routine-7', paused: true })]);
    expect(model([item()], 'UTC').rows[0].paused).toBe(false);
  });
});

describe('pause rules (D27)', () => {
  it('pauses a routine by its agent', () => {
    expect(pauseAction(routine(120))).toEqual({ kind: 'routine', agentId: 7 });
  });

  it('pauses an active scheduled task and resumes a paused one', () => {
    const task = { type: 'task', scheduled_task_id: 12, id: 'task-12' };
    expect(pauseAction(item(task))).toEqual({ kind: 'scheduled_task', id: 12, next: 'paused' });
    expect(pauseAction(item({ ...task, paused: true }))).toEqual({
      kind: 'scheduled_task',
      id: 12,
      next: 'active',
    });
  });

  it("sends every other kind to its page in Studio, as the web's calendar opens it", () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ type: 'recipe', playbook_id: 5 }, '/assignments?tab=playbooks&id=5'],
      [{ type: 'mission', mission_id: '9b2e-41' }, '/missions/9b2e-41'],
      [{ type: 'task_due', board_task_id: 2680 }, '/command-center?tab=board&task_id=2680'],
      [{ type: 'social', post_id: 'p 1' }, '/deliverables?tab=socials&post=p%201'],
      [{ type: 'recipe', playbook_id: null, agent_id: 3 }, '/agents?agent=3'],
    ];
    for (const [overrides, link] of cases) {
      expect(pauseAction(item(overrides))).toEqual({ kind: 'manage_in_studio', link });
    }
  });

  it('cannot pause a routine or a task without its row, so Studio manages it', () => {
    expect(pauseAction(routine(120, { agent_id: null }))).toEqual({
      kind: 'manage_in_studio',
      link: STUDIO_CALENDAR_PATH,
    });
    expect(pauseAction(item({ type: 'task', scheduled_task_id: null }))).toEqual({
      kind: 'manage_in_studio',
      link: STUDIO_CALENDAR_PATH,
    });
  });

  it('offers pause to owners, admins and editors; a viewer reads only (D-ROLES)', () => {
    const heartbeat = routine(120);
    const offers = WORKSPACE_ROLES.map((role) => [role, pauseOffer(heartbeat, role).kind]);
    expect(offers).toEqual(
      WORKSPACE_ROLES.map((role) => [role, role === 'viewer' ? 'read_only' : 'routine']),
    );
    expect(pauseOffer(heartbeat, null).kind).toBe('read_only');
    expect(pauseOffer(item({ type: 'recipe', playbook_id: 5 }), 'viewer').kind).toBe(
      'manage_in_studio',
    );
  });
});
