// The discussion behind a conversation about a ticket, wired only (the rules are discussion.ts's).
// The ticket is GET /api/v1/tasks/{id}, in memory (D-CACHE) inside the ticket family, so the
// foundation's board_changed refetches it; it sits under its own key in that family because the
// Command Centre's ticket sheet caches its own reading of the same record under queryKeys.ticket.
// End takes the ticket out of the route, as the web's End takes it out of the link, so nothing
// after it carries the ticket. The rebrief is one call at a time: the toast and the board's
// refetch when the server agrees, refusalText's words when it does not.

import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { LIVE_INVALIDATIONS, invalidateFamilies } from '../../api/live-events';
import { queryKeys } from '../../api/query-keys';
import { useApiClient } from '../../app-state/session';
import type { Discussion } from '../../core/web/lib/discussion';
import { logger } from '../../lib/logger';
import { TICKET_PARAM } from '../../navigation/routes';
import { useToast } from '../../ui';
import { refusalText } from '../cards/actions';
import {
  discussionFrom,
  discussionHolds,
  rebriefBody,
  rebriefDoneText,
  type DiscussionLoad,
} from './discussion';
import { fetchTicket, rebriefTicket } from './ticket';

/** The discussion's own key under queryKeys.ticket (the ticket family). */
const DISCUSSION_KEY = 'discussion';

export type DiscussionState = {
  readonly load: DiscussionLoad;
  /** Null until the ticket is in, and with no ticket. */
  readonly discussion: Discussion | null;
  /** The composer holds the send (discussionHolds). */
  readonly holds: boolean;
  readonly retry: () => void;
  readonly end: () => void;
};

export function useDiscussion(ticketId: string | null): DiscussionState {
  const client = useApiClient();
  const router = useRouter();
  const ticket = useQuery({
    queryKey: [...queryKeys.ticket(ticketId ?? ''), DISCUSSION_KEY],
    queryFn: ticketId ? ({ signal }) => fetchTicket(client, ticketId, signal) : skipToken,
  });
  const { data, error, isFetching, refetch } = ticket;
  // a retry in flight shows the ticket opening, not the failure it may fix
  const shownError = isFetching ? null : error;
  const load = useMemo<DiscussionLoad>(
    () => ({ ticketId, ticket: ticketId ? data : undefined, error: shownError }),
    [ticketId, data, shownError],
  );
  const discussion = useMemo(() => discussionFrom(load), [load]);
  const retry = useCallback(() => void refetch(), [refetch]);
  const end = useCallback(() => router.setParams({ [TICKET_PARAM]: undefined }), [router]);
  return { load, discussion, holds: discussionHolds(load), retry, end };
}

export type RebriefRequest = {
  readonly busy: boolean;
  /** The refusal's words; null before a try and after a success. */
  readonly error: string | null;
  readonly save: (brief: string) => void;
  readonly clear: () => void;
};

export function useRebrief(discussion: Discussion, onDone: () => void): RebriefRequest {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // a second tap while the first call is out sends nothing
  const out = useRef(false);
  const save = useCallback(
    (brief: string) => {
      const body = rebriefBody(brief);
      if (!body || out.current) return;
      out.current = true;
      setBusy(true);
      setError(null);
      rebriefTicket(client, discussion.ticketId, body)
        .then(() => {
          toast.show(rebriefDoneText(discussion));
          void invalidateFamilies(queryClient, LIVE_INVALIDATIONS.board_changed);
          onDone();
        })
        .catch((caught: unknown) => {
          logger.warn('[chat] the rebrief was refused', caught);
          setError(refusalText(caught));
        })
        .finally(() => {
          out.current = false;
          setBusy(false);
        });
    },
    [client, discussion, onDone, queryClient, toast],
  );
  const clear = useCallback(() => setError(null), []);
  return { busy, error, save, clear };
}
