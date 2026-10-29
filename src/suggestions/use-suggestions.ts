// Auto's suggestions, wired (PRD-268 §6.5.2, US-G01; the rules are model.ts's). One query, GET
// /api/proactive/suggestions?status=open, only where discovery lists `suggestions`: memory only
// (query-keys.ts), refetched on a suggestion_changed live event (live-events.ts) and on the 60 s
// poll needs-you uses. Start and Hide are for the roles that may answer (owners, admins, editors;
// a viewer is 403 on both). Start: refused at once while the app is offline (one line, nothing
// queued), else Face ID first (gated.ts), then sent; 'Started. Auto is on it.' shows for 4 s, and
// the suggestion leaves the list at once (so no surface offers it again), and the suggestions, the
// Board and needs-you are read again. One Start at a time across every surface (the pinned card,
// the sheet, HUD's line share the mutation's key). Hide is never gated: the reason menu
// (reason-menu.ts), then the suggestion leaves the list at once and the server is told; a Hide that
// fails puts it back.

import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { canSuggestions } from '../api/capabilities';
import { useLiveStatus } from '../api/live';
import { NEEDS_YOU_REFETCH_INTERVAL_MS } from '../api/needs-you';
import { matchesFamily, type KeyFamilyName } from '../api/query-keys';
import { useAppSession } from '../app-state/session';
import { roleCan } from '../auth/role';
import { logger } from '../lib/logger';
import { useStepUp } from '../step-up/use-step-up';
import { useToast } from '../ui';
import { fetchOpenSuggestions, hideSuggestion } from './api';
import { OPEN_KEY, putBack, takeOff } from './cache';
import { startGated } from './gated';
import { STARTED_FOR_MS, openSuggestions, startRefusal, type SuggestionView } from './model';
import { askHideReason } from './reason-menu';
import type { HideReason, Suggestion } from './schema';
import { SUGGESTION_COPY } from './strings';

/** Every surface's Start shares this key: one Start at a time, its busy row seen everywhere. */
const START_KEY = ['proactive', 'suggestions', 'start'] as const;
/** What a Start changes: the suggestions, and the ticket it filed with what counts it. */
const AFTER_START: readonly KeyFamilyName[] = ['suggestions', 'board', 'needsYou'];

export type OpenSuggestions = {
  /** Discovery lists `suggestions`. */
  readonly offered: boolean;
  /** The open ones, newest first; empty while loading, failing or not offered. */
  readonly open: readonly Suggestion[];
};

export function useOpenSuggestions(): OpenSuggestions {
  const { client, discovery } = useAppSession();
  const offered = canSuggestions(discovery);
  const query = useQuery({
    queryKey: OPEN_KEY,
    queryFn: ({ signal }) => fetchOpenSuggestions(client, signal),
    refetchInterval: NEEDS_YOU_REFETCH_INTERVAL_MS,
    enabled: offered,
  });
  const data = query.data;
  const open = useMemo(
    () => (offered && data ? openSuggestions(data, Date.now()) : []),
    [offered, data],
  );
  return { offered, open };
}

export type SuggestionActions = {
  /** The role may Start and Hide. */
  readonly allowed: boolean;
  readonly start: (view: SuggestionView) => void;
  readonly hide: (view: SuggestionView) => void;
  /** The suggestion Start is being asked for or sent. */
  readonly busyId: string | null;
  /** 'Started. Auto is on it.' for 4 s after a Start, with what was started. */
  readonly started: { readonly id: string; readonly title: string } | null;
  /** Start refused: one line under that suggestion. */
  readonly refusal: { readonly id: string; readonly text: string } | null;
};

/** The started line for 4 s, then gone. */
function useStartedLine() {
  const [started, setStarted] = useState<SuggestionActions['started']>(null);
  useEffect(() => {
    if (!started) return undefined;
    const timer = setTimeout(() => setStarted(null), STARTED_FOR_MS);
    return () => clearTimeout(timer);
  }, [started]);
  return [started, setStarted] as const;
}

function useHide() {
  const { client } = useAppSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: ({ id, reason }: { readonly id: string; readonly reason: HideReason | null }) =>
      hideSuggestion(client, id, reason),
    onMutate: ({ id }) => ({ previous: takeOff(queryClient, id) }),
    onError: (error: unknown, _sent, context) => {
      logger.warn('[suggestions] hide failed', error);
      putBack(queryClient, context?.previous);
      toast.show(SUGGESTION_COPY.hideFailed);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: OPEN_KEY }),
  });
  const { mutate } = mutation;
  return useCallback(
    (view: SuggestionView) => {
      void askHideReason().then((choice) => {
        if (choice.hide) mutate({ id: view.id, reason: choice.reason });
      });
    },
    [mutate],
  );
}

export function useSuggestionActions(): SuggestionActions {
  const { client, workspace } = useAppSession();
  const { guard } = useStepUp();
  const queryClient = useQueryClient();
  const live = useLiveStatus();
  const [started, setStarted] = useStartedLine();
  const [refusal, setRefusal] = useState<SuggestionActions['refusal']>(null);
  const mutation = useMutation({
    mutationKey: START_KEY,
    mutationFn: (view: SuggestionView) => startGated(guard, client, view.id),
    onMutate: () => setRefusal(null),
    onSuccess: (sent, view) => {
      if (!sent.ran) return;
      takeOff(queryClient, view.id);
      setStarted({ id: view.id, title: view.title });
    },
    onError: (error: unknown, view) => setRefusal({ id: view.id, text: startRefusal(error) }),
    onSettled: (sent) =>
      sent?.ran === false
        ? undefined
        : queryClient.invalidateQueries({
            predicate: (query) => AFTER_START.some((name) => matchesFamily(name, query.queryKey)),
          }),
  });
  const allowed = roleCan(workspace.role, 'answer');
  const { mutate } = mutation;
  const busy = useStartingId();
  const start = useCallback(
    (view: SuggestionView) => {
      if (!allowed || busy !== null) return;
      if (live === 'offline') {
        setRefusal({ id: view.id, text: SUGGESTION_COPY.refused.offline });
        return;
      }
      mutate(view);
    },
    [allowed, busy, live, mutate],
  );
  const hide = useHide();
  return {
    allowed,
    start,
    hide: allowed ? hide : () => undefined,
    busyId: busy,
    started,
    refusal,
  };
}

/** The suggestion any surface's Start is asking Face ID for or sending; null when none is. */
function useStartingId(): string | null {
  const pending = useMutationState({
    filters: { mutationKey: START_KEY, status: 'pending' },
    select: (mutation) => (mutation.state.variables as SuggestionView | undefined)?.id ?? null,
  });
  return pending.find((id) => id !== null) ?? null;
}
