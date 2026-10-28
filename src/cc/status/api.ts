// Try again's call, through the foundation's one client (D-ONE-CLIENT): the route and id
// row-status.ts chose (Run Now, a Mission's Resume or Replan), sent at once and never queued.
// None takes a body. Run Now answers {success, task_id, status, rerun_of, started, message};
// Resume and Replan the Mission (api/missions.py _run_to_response). Only the server's own words
// are read, for the toast; a refusal is the client's ApiError.

import { z } from 'zod';

import type { ApiClient } from '../../api/client';
import type { RetryKind } from '../../api/row-status';
import { STATUS_ROW_COPY } from '../strings';
import type { RetryAction } from './row-status';

export const RetryResultSchema = z.object({
  message: z.string().trim().min(1).nullable().optional().catch(null),
});

export type RetryResult = Readonly<z.output<typeof RetryResultSchema>>;

export function sendRetry(client: ApiClient, action: RetryAction): Promise<RetryResult> {
  return client.request(action.route, { params: action.params, schema: RetryResultSchema });
}

/** The toast once the server took it: its own words when it sent any, else what was started. */
export function retriedMessage(result: RetryResult | undefined, kind: RetryKind): string {
  return result?.message ?? STATUS_ROW_COPY.retried[kind];
}
