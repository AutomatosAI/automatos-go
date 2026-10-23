// The ticket a discussion is about (D-ASK-AUTO) and 'Update ticket and re-queue', over the
// foundation's client on the chat's route table. GET /api/v1/tasks/{task_id} (api/board_tasks.py
// get_task: the ticket's columns, its number, its agent) is read into the vendored BoardTask the
// way the web's mapTaskToBoardTask reads it (hooks/use-board-tasks.ts), for what discussionOf reads
// and what a BoardTask cannot be without; zod drops the rest, the cost line among them (D8). Its
// number is the vendored ticketNumber (#0042, else its workspace_seq): never its row id (F414).
// POST /api/v1/tasks/{task_id}/rebrief {brief} (api/board_task_rebrief.py) answers {success,
// task_id, status}. Failures are the client's ApiError taxonomy (a ticket of another workspace is
// a 404).

import { z } from 'zod';

import type { ApiClient } from '../../api/client';
import { ticketNumber } from '../../core/web/lib/ticket-number';
import type { BoardStatus, BoardTask, ReviewMode, TaskPriority } from '../../core/web/types/board';
import { CHAT_ROUTES } from '../routes';
import { DISCUSSION_COPY } from '../strings';

const STATUSES = [
  'inbox',
  'assigned',
  'in_progress',
  'review',
  'blocked',
  'done',
  'failed',
  'cancelled',
  'closed',
] as const satisfies readonly BoardStatus[];
const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const satisfies readonly TaskPriority[];
const REVIEW_MODES = ['human', 'llm', 'auto'] as const satisfies readonly ReviewMode[];
const BOARD_TYPES: readonly string[] = [
  'routine',
  'playbook',
  'task',
  'mission',
] satisfies readonly BoardTask['type'][];
/** The web's tag for a Mission's card: its name, not a tag the board shows. */
const MISSION_TAG = 'mission:';

const Text = z.string().nullish().catch(null);
const RowId = z.union([z.number().int(), z.string().min(1)]).transform(String);

const TicketAgentSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  agent_icon: Text,
});

const TicketWireSchema = z.object({
  id: RowId,
  title: Text,
  type: Text,
  status: z.enum(STATUSES).catch('inbox'),
  priority: z.enum(PRIORITIES).catch('medium'),
  review_mode: z.enum(REVIEW_MODES).catch('auto'),
  tags: z.array(z.string()).catch([]),
  source_type: Text,
  source_id: RowId.nullish().catch(null),
  orchestration_run_id: Text,
  number: Text,
  workspace_seq: z.number().int().nullish().catch(null),
  agent: TicketAgentSchema.nullish().catch(null),
});

type TicketWire = z.output<typeof TicketWireSchema>;

function isBoardType(value: string): value is BoardTask['type'] {
  return BOARD_TYPES.includes(value);
}

/** The web's boardType: a playbook's run, a Mission's card or step, else the ticket's own type. */
function boardType(ticket: TicketWire): BoardTask['type'] {
  const source = ticket.source_type;
  if (source === 'recipe' || source === 'playbook') return 'playbook';
  if (source === 'orchestration' || source === 'orchestration_task') return 'mission';
  const type = ticket.type ?? 'task';
  return isBoardType(type) ? type : 'task';
}

function boardTaskOf(ticket: TicketWire): BoardTask {
  const { agent, orchestration_run_id: missionId, source_type: sourceType } = ticket;
  return {
    id: ticket.id,
    type: boardType(ticket),
    name: ticket.title ?? DISCUSSION_COPY.untitled,
    status: ticket.status,
    priority: ticket.priority,
    tags: ticket.tags.filter((tag) => !tag.startsWith(MISSION_TAG)),
    review_mode: ticket.review_mode,
    source_id: ticket.source_id ?? ticket.id,
    ...(missionId ? { mission_id: missionId } : {}),
    ...(agent
      ? { assignee: { agent_id: agent.id, agent_name: agent.name, agent_icon: agent.agent_icon } }
      : {}),
    ...(sourceType ? { source_type: sourceType } : {}),
    number: ticketNumber(ticket),
    workspace_seq: ticket.workspace_seq,
  };
}

export const TicketSchema = TicketWireSchema.transform(boardTaskOf);

export const RebriefResultSchema = z.object({
  task_id: z.number().int(),
  status: z.string(),
});

export type RebriefResult = z.output<typeof RebriefResultSchema>;

export type RebriefBody = { readonly brief: string };

/** One ticket by its board row id; not_found (404) when this workspace has no such ticket. */
export function fetchTicket(
  client: ApiClient,
  taskId: string,
  signal?: AbortSignal,
): Promise<BoardTask> {
  return client.request(CHAT_ROUTES.task, {
    params: { task_id: taskId },
    schema: TicketSchema,
    signal,
  });
}

/** 'Update ticket and re-queue': the agreed brief becomes the ticket's, and it goes back to work. */
export function rebriefTicket(
  client: ApiClient,
  taskId: string,
  body: RebriefBody,
  signal?: AbortSignal,
): Promise<RebriefResult> {
  return client.request(CHAT_ROUTES.rebrief, {
    params: { task_id: taskId },
    body,
    schema: RebriefResultSchema,
    signal,
  });
}
