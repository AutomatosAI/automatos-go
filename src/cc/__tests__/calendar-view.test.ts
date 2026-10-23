import { describe, expect, it } from 'vitest';

import { createApiClient } from '../../api/client';
import { SERVER, fakeTransport, jsonReply } from '../../api/__tests__/fake-transport';
import { KIND_META } from '../../core/web/components/command-center/calendar-kinds';
import { STUDIO_COLOURS } from '../../styles/tokens/studio';
import { BoardSchema } from '../board/schemas';
import { sendPause } from '../calendar/api';
import { kindTone, pausedOpacity, PAUSED_OPACITY, stripCellPaint } from '../calendar/chrome';
import { dayModel, kindWord } from '../calendar/day-model';
import { ScheduleSchema, type ScheduleEntry } from '../calendar/schemas';
import {
  boardNumberOf,
  itemSheetView,
  pauseButton,
  pausedMessage,
  sheetTarget,
  type SheetOrigin,
} from '../calendar/sheet';
import { calendarView, todayCount } from '../calendar/view-model';
import { CALENDAR_COPY } from '../strings';

// Thursday 22 Oct 2026, 12:00 UTC: 13:00 in London (BST until Sunday 25th).
const NOW = new Date('2026-10-22T12:00:00Z');
const LONDON = 'Europe/London';
const WEB = 'https://studio.example.test';
const WS = '7f1c2a54-0000-4000-8000-000000000001';
const NO_RECURRENCE = { cron_expression: null, interval_minutes: null, timezone: 'UTC' };

// Items as services/activity_service.py get_schedule serves them at the pinned SHA.
const WIRE = {
  band: {
    id: 'routine-7',
    name: 'Inbox triage',
    type: 'routine',
    next_run_at: '2026-10-22T12:15:00+00:00',
    frequency: 'Every 15m',
    agent_name: 'Relay',
    agent_id: 7,
    recurrence: { ...NO_RECURRENCE, interval_minutes: 15 },
  },
  sweep: {
    id: 'routine-8',
    name: 'Digest sweep',
    type: 'routine',
    next_run_at: '2026-10-22T14:00:00+00:00',
    frequency: 'Every 8h',
    agent_name: 'Ledger',
    agent_id: 8,
    recurrence: { ...NO_RECURRENCE, interval_minutes: 480 },
  },
  numbers: {
    id: 'task-12',
    scheduled_task_id: 12,
    name: 'Weekly numbers',
    type: 'task',
    next_run_at: '2026-10-23T09:00:00+00:00',
    frequency: '0 9 * * 5',
    agent_name: 'Ledger',
    agent_id: 8,
    recurrence: { ...NO_RECURRENCE, cron_expression: '0 9 * * 5' },
  },
  due: {
    id: 'task_due-42',
    board_task_id: 42,
    name: 'Ship the launch page copy',
    type: 'task_due',
    next_run_at: '2026-10-22T16:00:00+00:00',
    frequency: 'SLA deadline',
    agent_name: 'Quill',
    agent_id: 3,
    recurrence: null,
  },
  playbook: {
    id: 'recipe-3',
    playbook_id: 3,
    name: 'Morning brief',
    type: 'recipe',
    next_run_at: '2026-10-22T14:30:00+00:00',
    frequency: 'One-off',
    agent_name: null,
    agent_id: null,
    recurrence: NO_RECURRENCE,
  },
  missed: {
    id: 'mission-9',
    mission_id: '0b9e6a52-3c41-4f2e-9d55-1f0c2b7a8e10',
    name: 'Autumn launch',
    type: 'mission',
    next_run_at: '2026-10-20T10:00:00+00:00',
    frequency: 'SLA deadline',
    agent_name: null,
    agent_id: null,
    recurrence: null,
  },
} as const;

function entries(overrides: Partial<Record<keyof typeof WIRE, Record<string, unknown>>> = {}) {
  const wire = (Object.keys(WIRE) as (keyof typeof WIRE)[]).map((key) => ({
    ...WIRE[key],
    ...overrides[key],
  }));
  return ScheduleSchema.parse({ scheduled: wire, scheduler_active: true }).scheduled;
}

function entry(key: keyof typeof WIRE, overrides: Record<string, unknown> = {}): ScheduleEntry {
  const found = entries({ [key]: overrides }).find((item) => item.id === WIRE[key].id);
  if (!found) throw new Error(`no ${key} in the feed`);
  return found;
}

function view(items: ScheduleEntry[], selected?: string) {
  const model = dayModel({ items, now: NOW, timeZone: LONDON, selected });
  return { model, view: calendarView(model) };
}

describe('the Calendar tab view', () => {
  it('words the strip: the chosen chip, today, and how many items a day has', () => {
    const { view: shown } = view(entries());
    const [today, friday] = shown.strip;
    expect(today).toMatchObject({ key: '2026-10-22', selected: true, today: true });
    expect(today.accessibilityLabel).toBe(`Thu 22 Oct, today, ${today.count} items`);
    expect(friday).toMatchObject({ selected: false, today: false, dateLabel: 'Fri 23 Oct' });
    expect(shown.strip[6].accessibilityLabel).toMatch(/^Wed 28 Oct, /);
    expect(shown.selectedDay.key).toBe('2026-10-22');
  });

  it('a day with nothing on it says so, and the band stays', () => {
    const items = [entry('band')];
    const { view: shown } = view(items, '2026-10-24');
    expect(shown.rows).toEqual([]);
    expect(shown.empty).toBe('Nothing scheduled this day.');
    expect(shown.band).toHaveLength(1);
    expect(shown.strip[2].accessibilityLabel).toBe('Sat 24 Oct, nothing scheduled');
  });

  it('rows: the mono time, the kind word, the title, the meta, in time order', () => {
    const { view: shown } = view(entries());
    expect(shown.rows.map((row) => [row.time, row.kind.label, row.title])).toEqual([
      ['11:00', 'Mission SLA', 'Autumn launch'],
      ['07:00', 'Heartbeat', 'Digest sweep'],
      ['15:00', 'Heartbeat', 'Digest sweep'],
      ['15:30', 'Playbook', 'Morning brief'],
      ['17:00', 'Task deadline', 'Ship the launch page copy'],
      ['23:00', 'Heartbeat', 'Digest sweep'],
    ]);
    const sweep = shown.rows[2];
    expect(sweep.meta).toBe('Ledger · every 8 h');
    expect(sweep.accessibilityLabel).toBe('15:00, Heartbeat, Digest sweep, Ledger · every 8 h');
    expect(shown.empty).toBeNull();
  });

  it('a missed deadline is listed today (first: it fell due before today), says Overdue and when', () => {
    const missed = view(entries()).view.rows[0];
    expect(missed.flags).toEqual([{ key: 'overdue', word: 'Overdue' }]);
    expect(missed.meta).toBe('Due Tue 20 Oct');
    expect(missed.accessibilityLabel).toContain('Overdue');
  });

  it('a paused row is still listed, greyed, with the word Paused', () => {
    const items = entries({ sweep: { paused: true } });
    const rows = view(items).view.rows.filter((row) => row.itemId === 'routine-8');
    expect(rows).toHaveLength(3);
    rows.forEach((row) => {
      expect(row.paused).toBe(true);
      expect(row.flags).toEqual([{ key: 'paused', word: 'Paused' }]);
      expect(row.accessibilityLabel).toContain('Paused');
      expect(pausedOpacity(row.paused)).toBe(PAUSED_OPACITY);
    });
    expect(PAUSED_OPACITY).toBeLessThan(1);
    expect(pausedOpacity(false)).toBe(1);
  });

  it('the band: agent and title, its cadence, and Paused when it is', () => {
    const [line] = view(entries({ band: { paused: true } })).view.band;
    expect(line).toMatchObject({
      itemId: 'routine-7',
      line: 'Relay · Inbox triage',
      every: 'every 15 min',
      paused: true,
    });
    expect(line.flags.map((flag) => flag.word)).toEqual(['Paused']);
    expect(line.accessibilityLabel).toBe(
      'Always on, Heartbeat, Paused, Relay · Inbox triage, every 15 min',
    );
  });

  it("the tab's figure is today's rows; the band is not counted", () => {
    expect(todayCount({ items: entries(), now: NOW, timeZone: LONDON })).toBe(6);
    expect(todayCount({ items: [entry('band')], now: NOW, timeZone: LONDON })).toBe(0);
  });
});

describe('the Calendar paints', () => {
  const colours = STUDIO_COLOURS.light;

  it('the chosen day is solid ink, today sits on the card, a day with items has the dot', () => {
    const chosen = stripCellPaint(colours, { selected: true, today: true, hasItems: true });
    expect(chosen).toEqual({
      backgroundColor: colours.foreground,
      borderColor: colours.foreground,
      color: colours.card,
      dot: colours.card,
    });
    const today = stripCellPaint(colours, { selected: false, today: true, hasItems: true });
    expect(today).toMatchObject({ backgroundColor: colours.card, dot: colours.accent });
    const bare = stripCellPaint(colours, { selected: false, today: false, hasItems: false });
    expect(bare).toMatchObject({ backgroundColor: 'transparent', dot: 'transparent' });
  });

  it("a kind's colour is the vendored tone; a kind it does not know is muted", () => {
    expect(kindTone(colours, kindWord('routine'))).toBe(KIND_META.routine.tone);
    expect(kindTone(colours, kindWord('video_call'))).toBe(colours.mutedForeground);
  });
});

const rowOrigin = (item: ScheduleEntry, items = entries()): SheetOrigin => {
  const { model, view: shown } = view(items);
  const row = model.rows.find((each) => each.itemId === item.id);
  if (!row) throw new Error(`no row for ${item.id}`);
  return { row, day: shown.selectedDay };
};

describe('the item sheet', () => {
  it('a routine pauses for an editor; the line says what it does, and that it may leave', () => {
    const item = entry('sweep');
    const sheet = itemSheetView({
      item,
      origin: rowOrigin(item),
      role: 'editor',
      ticketNumber: null,
      webUrl: WEB,
    });
    // the first of its three runs today
    expect(sheet.when).toBe('Thu 22 Oct · 07:00 · Ledger · every 8 h');
    expect(sheet.pause).toEqual({
      label: 'Pause this routine',
      resumes: false,
      effect: CALENDAR_COPY.sheet.effect.routine,
      note: CALENDAR_COPY.sheet.leavesFeed,
      action: { kind: 'routine', agentId: 8 },
    });
    expect(sheet.studio).toBeNull();
    expect(sheet.board).toBeNull();
    expect(sheet.readOnly).toBeNull();
  });

  it('a paused routine and a paused scheduled task offer Resume', () => {
    expect(pauseButton({ kind: 'routine', agentId: 8 }, true)).toMatchObject({
      label: 'Resume this routine',
      resumes: true,
      note: null,
    });
    const task = entry('numbers', { paused: true });
    const { model } = view([task], '2026-10-23');
    const origin = { row: model.rows[0], day: { weekday: 'Fri', day: 23, month: 'Oct' } };
    const sheet = itemSheetView({ item: task, origin, role: 'owner', ticketNumber: null });
    expect(sheet.pause).toMatchObject({
      label: 'Resume this task',
      resumes: true,
      action: { kind: 'scheduled_task', id: 12, next: 'active' },
    });
    expect(sheet.flags.map((flag) => flag.word)).toEqual(['Paused']);
    expect(sheet.when).toBe('Fri 23 Oct · 10:00 · Ledger · Fri');
  });

  it('a viewer reads a routine and is told who pauses it', () => {
    const item = entry('sweep');
    const sheet = itemSheetView({
      item,
      origin: rowOrigin(item),
      role: 'viewer',
      ticketNumber: null,
    });
    expect(sheet.pause).toBeNull();
    expect(sheet.readOnly).toBe(CALENDAR_COPY.sheet.readOnly);
  });

  it("a playbook is managed in Studio, at the web calendar's page for it (D27)", () => {
    const item = entry('playbook');
    const sheet = itemSheetView({
      item,
      origin: rowOrigin(item),
      role: 'owner',
      ticketNumber: null,
      webUrl: WEB,
    });
    expect(sheet.pause).toBeNull();
    expect(sheet.studio).toEqual({ url: `${WEB}/assignments?tab=playbooks&id=3` });
  });

  it('a build with no Studio address says so instead of a dead button', () => {
    const item = entry('playbook');
    const sheet = itemSheetView({
      item,
      origin: rowOrigin(item),
      role: 'owner',
      ticketNumber: null,
      webUrl: '',
    });
    expect(sheet.studio).toEqual({ url: null });
  });

  it('a deadline opens its ticket on the board, by number when the Board has it', () => {
    const item = entry('due');
    const input = { item, origin: rowOrigin(item), role: 'editor' as const, webUrl: WEB };
    const numbered = itemSheetView({ ...input, ticketNumber: '#0427' });
    expect(numbered.board).toEqual({ label: 'Open #0427 on the board', href: '/cc/ticket/42' });
    expect(numbered.studio).toEqual({
      url: `${WEB}/command-center?tab=board&task_id=42`,
    });
    const unnumbered = itemSheetView({ ...input, ticketNumber: null });
    expect(unnumbered.board?.label).toBe('Open the ticket on the board');
  });

  it('a heartbeat in the band says every day, its cadence and its agent', () => {
    const item = entry('band');
    const band = view([item]).model.band[0];
    const sheet = itemSheetView({ item, origin: { band }, role: 'admin', ticketNumber: null });
    expect(sheet.when).toBe('Every day · every 15 min · Relay');
    expect(sheet.pause?.action).toEqual({ kind: 'routine', agentId: 7 });
  });

  it('the toast says what the server answered, else what was asked', () => {
    const pausing = { resumes: false };
    expect(pausedMessage(true, pausing, 'Digest sweep')).toBe(
      'Paused. “Digest sweep” will not run until it is resumed.',
    );
    expect(pausedMessage(false, pausing, 'Digest sweep')).toMatch(/^Resumed\./);
    expect(pausedMessage(null, { resumes: true }, 'Digest sweep')).toMatch(/^Resumed\./);
    expect(pausedMessage(null, pausing, 'Digest sweep')).toMatch(/^Paused\./);
  });
});

describe('what the sheet is open on', () => {
  it('finds the row, the band line, and nothing once the item has left the feed', () => {
    const items = entries();
    const { model, view: shown } = view(items);
    const row = model.rows[1];
    expect(
      sheetTarget(items, model, shown.selectedDay, { itemId: row.itemId, rowKey: row.key }),
    ).toMatchObject({ item: { id: 'routine-8' }, origin: { row: { key: row.key } } });
    expect(
      sheetTarget(items, model, shown.selectedDay, { itemId: 'routine-7', rowKey: null }),
    ).toMatchObject({ origin: { band: { itemId: 'routine-7' } } });
    const after = items.filter((item) => item.id !== 'routine-8');
    expect(
      sheetTarget(after, model, shown.selectedDay, { itemId: row.itemId, rowKey: row.key }),
    ).toBeNull();
    expect(
      sheetTarget(items, model, shown.selectedDay, { itemId: row.itemId, rowKey: 'gone@1' }),
    ).toBeNull();
  });

  it("reads a ticket's number from the Board's list, never its row id", () => {
    const tasks = BoardSchema.parse({
      tasks: [
        { id: 42, number: '#0427', title: 'Ship', status: 'in_progress' },
        { id: 43, number: null, workspace_seq: null, title: 'Old', status: 'inbox' },
      ],
    }).tasks;
    expect(boardNumberOf(tasks, 42)).toBe('#0427');
    expect(boardNumberOf(tasks, 43)).toBeNull();
    expect(boardNumberOf(tasks, 99)).toBeNull();
    expect(boardNumberOf(undefined, 42)).toBeNull();
  });
});

describe('sendPause answers', () => {
  function clientAnswering(body: unknown) {
    const transport = fakeTransport(() => jsonReply(200, body));
    return createApiClient({
      server: SERVER,
      getToken: async () => 'token',
      getWorkspaceId: () => WS,
      transport,
    });
  }

  it('whether the item is paused now, as the server says', async () => {
    const routine = { kind: 'routine', agentId: 7 } as const;
    const task = { kind: 'scheduled_task', id: 12, next: 'paused' } as const;
    await expect(sendPause(clientAnswering({ enabled: false }), routine)).resolves.toBe(true);
    await expect(sendPause(clientAnswering({ enabled: true }), routine)).resolves.toBe(false);
    await expect(sendPause(clientAnswering({ message: 'ok' }), routine)).resolves.toBeNull();
    await expect(sendPause(clientAnswering({ status: 'paused' }), task)).resolves.toBe(true);
    await expect(sendPause(clientAnswering({ status: 'active' }), task)).resolves.toBe(false);
    await expect(sendPause(clientAnswering({ success: true }), task)).resolves.toBeNull();
  });
});
