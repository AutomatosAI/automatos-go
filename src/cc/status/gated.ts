// Face ID before a row's Try again (D19, KP13; PRD-268): it starts work, as PRD-268's Start
// does, so the call (Run Now, a Mission's Resume or Replan: api.ts sendRetry) goes
// out only after guard('retry', …) from src/step-up passes, and exactly as it would without the
// gate. A refused check sends nothing: the row stays as it was and the gate's toast says why. Pure:
// use-retry.ts hands in useStepUp().guard.

import type { ApiClient } from '../../api/client';
import type { Guard, GuardResult } from '../../step-up/guard';
import { sendRetry, type RetryResult } from './api';
import type { RetryAction } from './row-status';

export function retryGated(
  guard: Guard,
  client: ApiClient,
  action: RetryAction,
): Promise<GuardResult<RetryResult>> {
  return guard('retry', () => sendRetry(client, action));
}
