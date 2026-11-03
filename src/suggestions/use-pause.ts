// "Pause suggestions" on a screen (PRD-268 §6.9): the person's pause through the one client and
// cache (memory only, pause.ts pauseQueryKeys), read only where discovery lists `suggestions` (an
// older server shows Settings unchanged and lists no suggestions anyway). The Settings switch
// (PauseSection.tsx) and the home's open list (use-suggestions.ts) share the one query, so a press
// takes the suggestions off every surface as soon as the server answers. A press is one PUT, never
// while one is out; a refusal puts the switch back, is kept as the line under it and announced to
// VoiceOver (iOS has no live regions). Only wiring: the calls, the cache and the words are
// pause.ts's.

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { canSuggestions } from '../api/capabilities';
import { NEEDS_YOU_REFETCH_INTERVAL_MS } from '../api/needs-you';
import { useAppSession } from '../app-state/session';
import { logger } from '../lib/logger';
import {
  applyPause,
  fetchMyProactive,
  pauseFailureLine,
  pausedNow,
  pauseQueryKeys,
  pauseView,
  type PauseFailure,
  type PauseView,
} from './pause';

function announce(line: string): void {
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(line);
}

/** GET /api/proactive/me for this server's workspace, only when `enabled`. */
function useMyProactive(enabled: boolean, refetchInterval?: number) {
  const { client, server, workspace } = useAppSession();
  const key = useMemo(
    () => pauseQueryKeys.mine(server.apiUrl, workspace.id),
    [server.apiUrl, workspace.id],
  );
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchMyProactive(client, signal),
    enabled,
    refetchInterval,
  });
  return { key, query };
}

/**
 * The home's view of the pause (pause.ts pausedNow): undefined until it is read. Read again on the
 * open list's 60 s cadence, so a pause or a resume made on the web or another phone reaches this
 * home within a minute.
 */
export function useSuggestionsPaused(offered: boolean): boolean | undefined {
  const { query } = useMyProactive(offered, NEEDS_YOU_REFETCH_INTERVAL_MS);
  return pausedNow({ data: query.data, isError: query.isError });
}

/** The press: one PUT at a time, the choice shown while it is out, a refusal kept as a line. */
function useSavePause(key: QueryKey) {
  const { client } = useAppSession();
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<PauseFailure | null>(null);
  const { mutate, isPending, variables } = useMutation({
    mutationFn: (paused: boolean) => applyPause({ client, queryClient, key }, paused),
    onMutate: () => setFailure(null),
    onError: (error: unknown, paused: boolean) => {
      logger.warn('[suggestions] the pause was refused or failed', error);
      const next: PauseFailure = Object.freeze({ paused, error });
      setFailure(next);
      announce(pauseFailureLine(next));
    },
  });
  const run = useCallback(
    (paused: boolean) => {
      if (!isPending) mutate(paused);
    },
    [isPending, mutate],
  );
  return { choosing: isPending ? (variables ?? null) : null, failure, run };
}

export type PauseSwitch = Readonly<{
  /** Discovery lists `suggestions`: an older server's Settings are unchanged. */
  shown: boolean;
  view: PauseView;
  setPaused: (paused: boolean) => void;
}>;

export function usePauseSwitch(): PauseSwitch {
  const { discovery } = useAppSession();
  const shown = canSuggestions(discovery);
  const { key, query } = useMyProactive(shown);
  const save = useSavePause(key);
  const view = pauseView({
    paused: query.data?.paused,
    choosing: save.choosing,
    loading: query.isLoading,
    readError: query.error,
    failure: save.failure,
  });
  return { shown, view, setPaused: save.run };
}
