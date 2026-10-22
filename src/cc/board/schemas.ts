// The Board's wire shapes (D-ONE-CLIENT: zod at the boundary, unknown fields ignored). A ticket is
// api/board_tasks.py's board_dict plus its agent (services/board_task_view.py enrich_with_agents) at
// the pinned SHA. The list is persisted (query-keys.ts 'board'), so its schema keeps only what a card
// and the Board's rules read; the ticket sheet's fields are on the detail, which is not. The detail's
// `cost` is never parsed (D8). A status outside the known set is kept as sent (board.ts gives it its
// own word); a row this version cannot read at all is left out, never the whole board.

import { z } from 'zod';

import { logger } from '../../lib/logger';

const Text = z.string().nullable().catch(null);
const RowId = z.number().int().nullable().catch(null);

/** Tags are strings; anything else in the list is dropped, a missing list is empty. */
const Tags = z
  .array(z.unknown())
  .catch([])
  .transform((items) => items.filter((item): item is string => typeof item === 'string'));

/** The ticket's agent from its own workspace; a missing or foreign one is null. */
export const BoardAgentSchema = z.object({ id: z.number().int(), name: z.string() });

export const BOARD_TICKET_FIELDS = {
  /** The integer row id: what GET /api/v1/tasks/{task_id} and the app's routes take. */
  id: z.number().int(),
  /** #0042, a mission step's #0051.3; null on an older server (ticket-number.ts falls back). */
  number: Text,
  workspace_seq: RowId,
  /** What filed it: the kind (ticket-kind.ts) and whether it is a mission step. */
  source_type: Text,
  title: z.string().catch(''),
  /** Kept as sent: a status this version does not know still shows, under its own word. */
  status: z.string(),
  priority: z.string().catch('medium'),
  agent: BoardAgentSchema.nullable().catch(null),
  tags: Tags,
  /** PRD-252 R3 codes (core/services/ticket_reasons.py); ticket-stage.ts words them. */
  review_reason: Text,
  blocked_code: Text,
  /** A mission step's card: the web nests it under its parent rather than listing it. */
  parent_task_id: RowId,
  created_at: Text,
  updated_at: Text,
} as const;

export const BoardTicketSchema = z.object(BOARD_TICKET_FIELDS);

export type BoardTicket = Readonly<z.output<typeof BoardTicketSchema>>;

/** The rows that parse; one this version cannot read is logged and left out. */
const BoardRows = z.array(z.unknown()).transform((items): BoardTicket[] =>
  items.flatMap((item) => {
    const parsed = BoardTicketSchema.safeParse(item);
    if (parsed.success) return [parsed.data];
    logger.debug('[cc/board] left out a ticket this version cannot read');
    return [];
  }),
);

/** GET /api/v1/tasks?finished_limit=200: {tasks, total}. A body without a list is invalid. */
export const BoardSchema = z.object({
  tasks: BoardRows,
  total: z.number().int().nonnegative().optional().catch(undefined),
});

export type Board = Readonly<z.output<typeof BoardSchema>>;

/**
 * What approving runs first (planning_data.approval_action, api/board_tasks.py
 * _run_approval_action): publish_blog, create_blog (on a topic), else nothing. Only the type and
 * topic are read; the rest of planning_data is never parsed.
 */
const ApprovalActionSchema = z.object({ type: z.string(), topic: Text }).nullable().catch(null);

const PlanningSchema = z
  .object({ approval_action: ApprovalActionSchema.optional() })
  .nullable()
  .catch(null);

export type ApprovalAction = NonNullable<z.output<typeof ApprovalActionSchema>>;

/** GET /api/v1/tasks/{task_id}: the card's fields and what the ticket sheet reads. */
export const TicketDetailSchema = z.object({
  ...BOARD_TICKET_FIELDS,
  description: Text,
  /** The agent's answer, as text (it may be long). */
  result: Text,
  error_message: Text,
  blocked_reason: Text,
  started_at: Text,
  completed_at: Text,
  /** A mission ticket's run (orchestration_run_id): its plan and steps live on the mission. */
  orchestration_run_id: Text,
  /** Sends back since the brief was last agreed (PRD-252 D3). */
  times_sent_back: z.number().int().nonnegative().catch(0),
  /** The draft a failed redo keeps on the card's face (F243). */
  kept_draft: Text,
  /** Only its approval_action: what Approve runs, named on the button. */
  planning_data: PlanningSchema.optional().catch(null),
});

export type TicketDetail = Readonly<z.output<typeof TicketDetailSchema>>;

/**
 * POST …/approve: {success, task_id, status, action_result}. A mission's card that approves its
 * plan answers {…, mission_id, message}: the server's own words for what happened.
 */
export const ApproveResultSchema = z.object({
  status: Text,
  action_result: z
    .object({ type: Text, title: Text, topic: Text, warning: Text })
    .nullable()
    .optional()
    .catch(null),
  message: Text,
});

export type ApproveResult = Readonly<z.output<typeof ApproveResultSchema>>;

/** POST …/reject: {success, task_id, status, assigned_agent_id, feedback}. */
export const SendBackResultSchema = z.object({ status: Text, feedback: Text });

export type SendBackResult = Readonly<z.output<typeof SendBackResultSchema>>;
