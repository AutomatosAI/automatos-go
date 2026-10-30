// The suggestions' calls, through the foundation's one client (D-ONE-CLIENT): the open list, Start
// and Hide, each answer parsed with schema.ts. Start and Hide say where the person decided (via
// 'go'); Start is sent only after Face ID (gated.ts) and never queued (the client's mutations run
// networkMode 'always'). A refusal is the client's ApiError, its code the server's (expired,
// already_started, not_available, spend_ceiling).

import type { ApiClient } from '../api/client';
import { SUGGESTION_ROUTES } from './routes';
import {
  HideResultSchema,
  StartResultSchema,
  SuggestionListSchema,
  type HideReason,
  type StartResult,
  type Suggestion,
} from './schema';

/** Where the phone's decisions are recorded (api/proactive.py Via). */
export const VIA_GO = 'go';

/** The open suggestions shown at once (the server's own default is larger). */
export const SUGGESTIONS_LIMIT = 20;

export async function fetchOpenSuggestions(
  client: Pick<ApiClient, 'request'>,
  signal?: AbortSignal,
): Promise<readonly Suggestion[]> {
  const answer = await client.request(SUGGESTION_ROUTES.list, {
    query: { status: 'open', limit: SUGGESTIONS_LIMIT },
    schema: SuggestionListSchema,
    signal,
  });
  return answer.suggestions;
}

export function startSuggestion(
  client: Pick<ApiClient, 'request'>,
  suggestionId: string,
): Promise<StartResult> {
  return client.request(SUGGESTION_ROUTES.start, {
    params: { suggestion_id: suggestionId },
    body: { via: VIA_GO },
    schema: StartResultSchema,
  });
}

export async function hideSuggestion(
  client: Pick<ApiClient, 'request'>,
  suggestionId: string,
  reason: HideReason | null,
): Promise<void> {
  await client.request(SUGGESTION_ROUTES.hide, {
    params: { suggestion_id: suggestionId },
    body: reason ? { reason, via: VIA_GO } : { via: VIA_GO },
    schema: HideResultSchema,
  });
}
