// The Calendar tab's hooks: they read the week's feed, the clock, the phone's timezone and the role,
// and run a pause through the Calendar's calls (api.ts); the day is day-model.ts's, the views
// view-model.ts's and sheet.ts's. A pause is sent at once, never queued (the client's mutations run
// networkMode 'always'), and its answer, a success or a refusal, reads the feed again: the stream's
// board_changed does not touch the schedule. The item sheet is a sheet over the tab (no route of
// its own); 'Open #n on the board' slides it away, then shows the ticket over the Board.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { queryKeys } from '../../api/query-keys';
import { useApiClient, useAppSession } from '../../app-state/session';
import { useToast } from '../../ui';
import { SHEET_DURATION_MS } from '../../ui/overlay';
import { boardQuery } from '../board/api';
import { useMinuteClock, usePhoneTimeZone } from '../shell/use-shell';
import { BOARD_SCREEN } from '../shell/tabs';
import { refusalMessage } from '../ticket/actions';
import { usePullRefresh } from '../use-pull-refresh';
import { SCHEDULE_RANGE, scheduleQuery, sendPause } from './api';
import { dayModel } from './day-model';
import { boardNumberOf, pausedMessage, type OpenedItem, type PauseButtonView } from './sheet';
import { calendarView } from './view-model';

/** The week's feed, the chosen day and its view; a pull reads the feed again. */
export function useCalendarTab() {
  const client = useApiClient();
  const query = useQuery(scheduleQuery(client));
  const now = useMinuteClock();
  const timeZone = usePhoneTimeZone();
  const [chosen, setChosen] = useState<string | null>(null);
  const pull = usePullRefresh(query.refetch);
  const items = query.data?.scheduled;
  const model = useMemo(
    () => (items ? dayModel({ items, now, timeZone, selected: chosen }) : null),
    [items, now, timeZone, chosen],
  );
  const view = useMemo(() => (model ? calendarView(model) : null), [model]);
  return { query, items, model, view, pull, choose: setChosen };
}

/** Which item the sheet shows, whether it shows, and the way out to a ticket on the Board. */
export function useItemSheet() {
  const router = useRouter();
  const [opened, setOpened] = useState<OpenedItem | null>(null);
  const [shown, setShown] = useState(false);
  const [toTicket, setToTicket] = useState<string | null>(null);

  useEffect(() => {
    if (!toTicket) return undefined;
    const timer = setTimeout(() => {
      setToTicket(null);
      router.replace(BOARD_SCREEN);
      router.push(toTicket);
    }, SHEET_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toTicket, router]);

  return {
    opened,
    visible: shown && toTicket === null,
    open: (next: OpenedItem) => {
      setOpened(next);
      setShown(true);
    },
    close: () => setShown(false),
    /** Slide the sheet away, then the Board with this ticket's sheet over it. */
    openOnBoard: (href: string) => {
      setShown(false);
      setToTicket(href);
    },
  };
}

/** The ticket's board number from the Board's own query (the shell keeps it), or null. */
export function useBoardNumber(taskId: number | null): string | null {
  const client = useApiClient();
  const tasks = useQuery({ ...boardQuery(client), enabled: taskId !== null }).data?.tasks;
  return taskId === null ? null : boardNumberOf(tasks, taskId);
}

type PauseRequest = { readonly button: PauseButtonView; readonly title: string };

/** Pause or resume one item: the toast and onDone on success, the refusal in words otherwise. */
export function usePause(onDone: () => void, onRefused: (words: string | null) => void) {
  const { client, workspace } = useAppSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: ({ button }: PauseRequest) => sendPause(client, button.action),
    onSuccess: (pausedNow, { button, title }) => {
      toast.show(pausedMessage(pausedNow, button, title));
      onDone();
    },
    onError: (error: unknown) => onRefused(refusalMessage(error)),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.schedule(SCHEDULE_RANGE) }),
  });
  return {
    role: workspace.role,
    busy: mutation.isPending,
    send: (request: PauseRequest) => {
      onRefused(null);
      mutation.mutate(request);
    },
  };
}
