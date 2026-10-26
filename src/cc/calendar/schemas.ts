// The Calendar's wire shape (D-ONE-CLIENT: zod at the boundary, unknown fields ignored): GET
// /api/activity/schedule?range=7d, services/activity_service.py get_schedule at the pinned SHA. Six
// sources fill one list, each item carrying the row it acts on (agent_id, scheduled_task_id,
// playbook_id, mission_id, board_task_id, post_id). The list is persisted (query-keys.ts
// 'schedule'), so the schema keeps only what the day view, the band and the pause rules read. A
// kind outside the six is kept as sent (day-model.ts gives it its own word); an item this version
// cannot read at all is left out, never the whole calendar. `paused` is a scheduled task's (PRD-266
// D27): a paused task stays in the feed with paused: true; a paused routine is not in the feed.

import { z } from 'zod';

import { logger } from '../../lib/logger';

const Text = z.string().nullable().catch(null);
const RowId = z.number().int().nullable().catch(null);
/** A mission's id is its run's UUID (orchestration_runs.id); a number is read as its text. */
const AnyId = z
  .union([z.string(), z.number()])
  .nullable()
  .catch(null)
  .transform((value) => (value === null ? null : String(value)));

/** How it repeats: a heartbeat's interval, or a cron in its own timezone (the server's math). */
const RecurrenceSchema = z
  .object({
    cron_expression: Text,
    interval_minutes: z.number().int().positive().nullable().catch(null),
    timezone: Text,
  })
  .nullable()
  .catch(null);

export const ScheduleEntrySchema = z.object({
  /** 'routine-7', 'task-12', 'social-<uuid>': unique in the feed, never parsed. */
  id: z.string(),
  name: z.string().catch(''),
  /** routine | recipe | task | mission | task_due | social; another is kept as sent. */
  type: z.string(),
  /** When it next runs (or falls due), as an ISO instant; null when the server has none. */
  next_run_at: Text,
  /** 'Every 2h', 'Daily', a cron, 'One-off', 'SLA deadline'. */
  frequency: Text,
  agent_name: Text,
  agent_id: RowId,
  scheduled_task_id: RowId,
  playbook_id: RowId,
  mission_id: AnyId,
  board_task_id: RowId,
  post_id: Text,
  /** PRD-266 D27: a paused scheduled task stays in the feed, greyed. Absent: not paused. */
  paused: z.boolean().catch(false),
  recurrence: RecurrenceSchema,
});

export type ScheduleEntry = Readonly<z.output<typeof ScheduleEntrySchema>>;
export type ScheduleRecurrence = NonNullable<ScheduleEntry['recurrence']>;

/** The items that parse; one this version cannot read is logged and left out. */
const ScheduleRows = z.array(z.unknown()).transform((items): ScheduleEntry[] =>
  items.flatMap((item) => {
    const parsed = ScheduleEntrySchema.safeParse(item);
    if (parsed.success) return [parsed.data];
    logger.debug('[cc/calendar] left out a calendar item this version cannot read');
    return [];
  }),
);

/** {scheduled, scheduler_active}. A body without the list is invalid. */
export const ScheduleSchema = z.object({
  scheduled: ScheduleRows,
  /** Always true since PRD-162 WS-7 (the listing is read from the database). */
  scheduler_active: z.boolean().catch(true),
});

export type Schedule = Readonly<z.output<typeof ScheduleSchema>>;

/** PATCH /api/heartbeat/{agent_id}/toggle: the heartbeat's new state and the server's words. */
export const RoutineToggleSchema = z.object({
  enabled: z.boolean().nullable().catch(null),
  message: Text,
});

export type RoutineToggle = Readonly<z.output<typeof RoutineToggleSchema>>;

/** PATCH /api/v1/scheduled-tasks/{task_id}/status: {success, task_id, status}. */
export const ScheduledTaskStatusResultSchema = z.object({ status: Text });

export type ScheduledTaskStatusResult = Readonly<z.output<typeof ScheduledTaskStatusResultSchema>>;
