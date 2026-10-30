// Face ID before Start (D19, KP13; PRD-268 §6.5.2, US-G01): Start starts work, so the call goes out
// only after guard('start_suggestion', …) from src/step-up passes, and exactly as it would without
// the gate. A refused check sends nothing: the suggestion stays as it was and the gate's toast says
// why. Hide is never gated (api.ts hideSuggestion is called as is). Pure: use-suggestions.ts hands
// in useStepUp().guard.

import type { ApiClient } from '../api/client';
import type { Guard, GuardResult } from '../step-up/guard';
import { startSuggestion } from './api';
import type { StartResult } from './schema';

export function startGated(
  guard: Guard,
  client: Pick<ApiClient, 'request'>,
  suggestionId: string,
): Promise<GuardResult<StartResult>> {
  return guard('start_suggestion', () => startSuggestion(client, suggestionId));
}
