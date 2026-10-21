// The Board's calls, through the foundation's one client (D-ONE-CLIENT) and the route table
// (src/cc/routes.ts), keyed by the shared query keys (src/api/query-keys.ts 'board' and 'ticket'),
// so the live stream's board_changed invalidation reaches them with no wiring here (D-LIVE). The
// list is the web's view: every open ticket and the newest 200 finished (use-board-tasks.ts F225).
// Verdicts are sent at once and never queued (the client's mutations run networkMode 'always').

import { queryOptions } from '@tanstack/react-query';

import type { ApiClient } from '../../api/client';
import { queryKeys } from '../../api/query-keys';
import { isTaskId } from '../../navigation/routes';
import { CC_ROUTES } from '../routes';
import {
  ApproveResultSchema,
  BoardSchema,
  SendBackResultSchema,
  TicketDetailSchema,
  type ApproveResult,
  type Board,
  type SendBackResult,
  type TicketDetail,
} from './schemas';
import { approveBody, sendBackBody, VerdictInputError } from './verdict';

/** The web's finished_limit: Done, Cancelled and Closed are windowed to the newest 200. */
export const BOARD_FINISHED_LIMIT = 200;

/** A ticket is called by its board row id (digits); its number is never an id (F414). */
function rowId(taskId: string | number): string {
  const text = String(taskId).trim();
  if (!isTaskId(text)) throw new TypeError('A ticket id is the board row id: digits only');
  return text;
}

export function fetchBoard(client: ApiClient, signal?: AbortSignal): Promise<Board> {
  return client.request(CC_ROUTES.board.list, {
    query: { finished_limit: BOARD_FINISHED_LIMIT },
    schema: BoardSchema,
    signal,
  });
}

export function fetchTicket(
  client: ApiClient,
  taskId: string | number,
  signal?: AbortSignal,
): Promise<TicketDetail> {
  return client.request(CC_ROUTES.board.ticket, {
    params: { task_id: rowId(taskId) },
    schema: TicketDetailSchema,
    signal,
  });
}

/** Approve a ticket in Review, with an optional note; the server's refusal is an ApiError. */
export function approveTicket(
  client: ApiClient,
  taskId: string | number,
  note?: string | null,
): Promise<ApproveResult> {
  return client.request(CC_ROUTES.board.approve, {
    params: { task_id: rowId(taskId) },
    body: approveBody(note),
    schema: ApproveResultSchema,
  });
}

/** Send a ticket back with the words that lead its redo; blank (or too long) is refused unsent. */
export async function sendBack(
  client: ApiClient,
  taskId: string | number,
  feedback: string,
): Promise<SendBackResult> {
  const id = rowId(taskId);
  const checked = sendBackBody(feedback);
  if (!checked.ok) throw new VerdictInputError(checked.reason, checked.message);
  return client.request(CC_ROUTES.board.reject, {
    params: { task_id: id },
    body: checked.body,
    schema: SendBackResultSchema,
  });
}

/** The Board's query: one key for the one view, persisted with the list (query-keys.ts). */
export function boardQuery(client: ApiClient) {
  return queryOptions({
    queryKey: queryKeys.board(),
    queryFn: ({ signal }) => fetchBoard(client, signal),
  });
}

/** One ticket's query, by its row id. */
export function ticketQuery(client: ApiClient, taskId: string) {
  return queryOptions({
    queryKey: queryKeys.ticket(taskId),
    queryFn: ({ signal }) => fetchTicket(client, taskId, signal),
  });
}
