// The brief's one call, through the foundation's client (D-ONE-CLIENT): POST
// /api/proactive/brief/open with the phone's local date and IANA timezone. The language is the
// client's Accept-Language (the person's "I speak", src/api/accept-language.ts), which core reads
// when the body names no locale (the W2 kit's K7), so the body carries none. A refusal is the
// client's ApiError.

import type { ApiClient } from '../api/client';
import { BRIEF_ROUTES } from './routes';
import { BriefOpenSchema, type BriefOpen } from './schema';

export type BriefOpenBody = { readonly local_date: string; readonly timezone: string };

export function openBrief(
  client: Pick<ApiClient, 'request'>,
  body: BriefOpenBody,
  signal?: AbortSignal,
): Promise<BriefOpen> {
  return client.request(BRIEF_ROUTES.open, { body, schema: BriefOpenSchema, signal });
}
