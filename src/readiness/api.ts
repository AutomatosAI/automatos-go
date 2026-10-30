// Readiness's two calls, through the foundation's client (D-ONE-CLIENT). The language is the
// client's Accept-Language (the person's "I speak", src/api/accept-language.ts), which core reads
// for the items' copy, so no call names one. A refusal is the client's ApiError (a 429 carries the
// server's code and words: src/api/errors.ts detailOf).

import type { ApiClient } from '../api/client';
import { READINESS_ROUTES } from './routes';
import { ReadinessSchema, type Readiness } from './schema';

type Requester = Pick<ApiClient, 'request'>;

/** GET /api/readiness. */
export function fetchReadiness(client: Requester, signal?: AbortSignal): Promise<Readiness> {
  return client.request(READINESS_ROUTES.current, { schema: ReadinessSchema, signal });
}

/** POST /api/readiness/check: Check again. Sent once per press, never retried (D-WRITES). */
export function checkReadiness(client: Requester): Promise<Readiness> {
  return client.request(READINESS_ROUTES.check, { schema: ReadinessSchema });
}
