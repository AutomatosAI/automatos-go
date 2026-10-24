// Face ID before approving a ticket (D19, KP13; A4's US-015e): the sheet's Approve goes to
// POST /api/v1/tasks/{id}/approve only after guard('approve_ticket', …) from src/step-up passes, and
// exactly as before (the Board's approveTicket, no note). A refused check sends nothing: the sheet
// stays as it was and the gate's toast says why. Send back never asks (KP13). Pure: use-ticket.ts
// hands in useStepUp().guard.

import type { ApiClient } from '../../api/client';
import type { Guard, GuardResult } from '../../step-up/guard';
import { approveTicket } from '../board/api';
import type { ApproveResult } from '../board/schemas';

export function approveTicketGated(
  guard: Guard,
  client: ApiClient,
  taskId: number,
): Promise<GuardResult<ApproveResult>> {
  return guard('approve_ticket', () => approveTicket(client, taskId));
}
