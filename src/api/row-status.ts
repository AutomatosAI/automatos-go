// Where a row stands, what happens next and how to try again (PRD-268 §6.11.1, US-C17): the
// server computes them once and adds them to needs-you rows and board task reads; clients only
// draw them. display_state is one of five states, next_step a sentence of at most 90 characters
// in the person's language (Accept-Language, accept-language.ts) and retry what Try again runs.
// All three are optional, so a server without them (core before PRD-268 W1) reads exactly as
// before: absent is undefined, and a value this version does not know (a sixth state, a longer
// sentence, a seventh retry kind) is null. Either way the row draws nothing new.

import { z } from 'zod';

/** §6.11.1's row states, in the order a list sorts them (needs_you first). */
export const DISPLAY_STATES = ['needs_you', 'working', 'ready', 'done', 'failed'] as const;
export type DisplayState = (typeof DISPLAY_STATES)[number];

/** What Try again runs: the failed Mission again, a new plan for it, or the ticket again. */
export const RETRY_KINDS = ['rerun_mission', 'replan_mission', 'retry_ticket'] as const;
export type RetryKind = (typeof RETRY_KINDS)[number];

/** The longest next_step the server writes (§6.11.1). */
export const NEXT_STEP_MAX_CHARS = 90;

export type RowRetry = { readonly kind: RetryKind };

/** Spread into a row's schema: the three fields, each optional and null when unreadable. */
export const ROW_STATUS_FIELDS = {
  display_state: z.enum(DISPLAY_STATES).nullable().optional().catch(null),
  next_step: z.string().trim().min(1).max(NEXT_STEP_MAX_CHARS).nullable().optional().catch(null),
  retry: z
    .object({ kind: z.enum(RETRY_KINDS) })
    .nullable()
    .optional()
    .catch(null),
} as const;

/** A row's status fields as parsed: undefined from an older server, null when unknown. */
export type RowStatusFields = {
  readonly display_state?: DisplayState | null;
  readonly next_step?: string | null;
  readonly retry?: RowRetry | null;
};
