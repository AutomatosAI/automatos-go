// The one needs-you number (D26, PRD-252 R5): GET /api/activity/needs-you answers {total, counts,
// rows} (automatos-ai orchestrator/services/needs_you.py; the web's hooks/use-needs-you.ts at the
// pinned SHA). total = review + question + approval + stuck + failed, with no period; questions and
// approvals are counted only for a workspace owner or admin (the server decides, not the app).
// Every counter reads useNeedsYou(), so the header's menu button, the home strip and the Command
// Centre share one cached response and cannot disagree. A board_changed live event
// refetches it at once (live-events.ts); the 60 s poll is the web's, for changes no event carries.
// Rows carry question text, so the family is never persisted (query-keys.ts). A row this version
// cannot read is left out; the number stays the server's.

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { z } from 'zod';

import { useApiClient } from '../app-state/session';
import { logger } from '../lib/logger';
import type { ApiClient } from './client';
import { queryKeys } from './query-keys';
import { routes } from './routes';

/** The web's refetchInterval for needs-you (use-needs-you.ts). */
export const NEEDS_YOU_REFETCH_INTERVAL_MS = 60_000;

/** Why a ticket is stuck (services/needs_you.py STUCK_*). An unknown reason reads as null. */
export const STUCK_REASONS = [
  'no_host',
  'no_agent',
  'not_picked_up',
  'mission_ended',
  'step_failed',
  'over_budget',
  'out_of_credit',
] as const;
export type StuckReason = (typeof STUCK_REASONS)[number];

const Text = z.string().nullable().catch(null);
const Count = z.number().int().nonnegative().catch(0);

/** A ticket in Review, a stuck one or a failed one; it opens the ticket, or its mission. */
export const NeedsYouTicketRowSchema = z.object({
  ticket_id: z.number().int(),
  /** #0042, a mission step's #0051.3 */
  number: Text,
  title: Text,
  agent_name: Text,
  mission_id: Text,
  mission_number: Text,
  mission_title: Text,
  /** What the row opens; a server older than F293 sends none: the ticket. */
  opens: z.enum(['ticket', 'mission']).catch('ticket'),
  at: Text,
  why: z.enum(STUCK_REASONS).nullable().catch(null),
});

/** An open question, an approval grant, or a mission waiting for its plan's approval. */
export const NeedsYouAskRowSchema = z.object({
  source: z.enum(['grant', 'mission']),
  id: z.string(),
  /** A question's words; an approval's ticket title. */
  title: Text,
  ticket_id: z.number().int().nullable().catch(null),
  number: Text,
  agent_name: Text,
  mission_id: Text,
  mission_number: Text,
  mission_title: Text,
  at: Text,
});

export type NeedsYouTicketRow = Readonly<z.output<typeof NeedsYouTicketRowSchema>>;
export type NeedsYouAskRow = Readonly<z.output<typeof NeedsYouAskRowSchema>>;

/** The rows of one kind that parse; a missing list is empty. */
function rowsOf<S extends z.ZodTypeAny>(row: S) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((items): z.output<S>[] =>
      items.flatMap((item) => {
        const parsed = row.safeParse(item);
        if (parsed.success) return [parsed.data as z.output<S>];
        logger.debug('[needs-you] left out a row this version cannot read');
        return [];
      }),
    );
}

const ZERO_COUNTS = Object.freeze({ review: 0, question: 0, approval: 0, stuck: 0, failed: 0 });

export const NeedsYouSchema = z.object({
  total: z.number().int().nonnegative(),
  counts: z
    .object({ review: Count, question: Count, approval: Count, stuck: Count, failed: Count })
    .catch(ZERO_COUNTS),
  rows: z
    .object({
      review: rowsOf(NeedsYouTicketRowSchema),
      question: rowsOf(NeedsYouAskRowSchema),
      approval: rowsOf(NeedsYouAskRowSchema),
      stuck: rowsOf(NeedsYouTicketRowSchema),
      failed: rowsOf(NeedsYouTicketRowSchema),
    })
    .catch({ review: [], question: [], approval: [], stuck: [], failed: [] }),
});

export type NeedsYou = Readonly<z.output<typeof NeedsYouSchema>>;
export type NeedsYouCounts = NeedsYou['counts'];
export type NeedsYouRows = NeedsYou['rows'];

/** Before the first answer (and while it fails): nothing to show, so the badge stays hidden. */
export const NO_NEEDS_YOU: NeedsYou = Object.freeze({
  total: 0,
  counts: ZERO_COUNTS,
  rows: Object.freeze({ review: [], question: [], approval: [], stuck: [], failed: [] }),
});

export function fetchNeedsYou(client: ApiClient, signal?: AbortSignal): Promise<NeedsYou> {
  return client.request(routes.needsYou, { schema: NeedsYouSchema, signal });
}

export type NeedsYouView = NeedsYou & {
  /** The query, for a screen that shows loading and errors (the Command Centre's list). */
  readonly query: UseQueryResult<NeedsYou>;
};

/** The server's one number and its rows; only under the signed-in gate. */
export function useNeedsYou(): NeedsYouView {
  const client = useApiClient();
  const query = useQuery({
    queryKey: queryKeys.needsYou(),
    queryFn: ({ signal }) => fetchNeedsYou(client, signal),
    refetchInterval: NEEDS_YOU_REFETCH_INTERVAL_MS,
  });
  return { ...(query.data ?? NO_NEEDS_YOU), query };
}
