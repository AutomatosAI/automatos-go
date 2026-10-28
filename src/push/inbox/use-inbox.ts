// The inbox's hooks (only under the signed-in gate): the bell's rows, the menu's unread number
// (read again every INBOX_REFETCH_INTERVAL_MS while something shows it), and the two actions over
// the one client, the router, the browser and the Toast. A tap marks its row read at once on screen
// (a new list in the cache, never the old one changed) and reads both again once the server has
// answered; Mark all read does the same for every row. Only wiring: the decisions are actions.ts's,
// open.ts's and model.ts's.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { userMessage } from '../../api/errors';
import { useApiClient } from '../../app-state/session';
import { openInBrowser } from '../../cc/open-studio';
import { useToast } from '../../ui';
import { markNotificationRead } from '../api';
import { INBOX_REFETCH_INTERVAL_MS } from '../config';
import { staleChecksFor } from '../links/stale';
import { pushQueryKeys } from '../query-keys';
import { markAllRead, openInboxRow } from './actions';
import { listNotifications, markAllNotificationsRead, unreadNotifications } from './api';
import { withRead } from './model';
import type { InboxList, InboxNotification } from './schemas';

export function useInboxList() {
  const client = useApiClient();
  return useQuery({
    queryKey: pushQueryKeys.inbox(),
    queryFn: ({ signal }) => listNotifications(client, signal),
  });
}

/** The server's unread number for the menu and Play's button; 0 until it answers. */
export function useUnreadCount(): number {
  const client = useApiClient();
  const query = useQuery({
    queryKey: pushQueryKeys.unread(),
    queryFn: ({ signal }) => unreadNotifications(client, signal),
    refetchInterval: INBOX_REFETCH_INTERVAL_MS,
  });
  return query.data ?? 0;
}

/** The cached list with these rows read now; the unread number drops with them. */
function markReadOnScreen(queryClient: QueryClient, ids: ReadonlySet<string> | 'all'): void {
  const at = new Date().toISOString();
  queryClient.setQueryData<InboxList>(pushQueryKeys.inbox(), (list) =>
    list
      ? Object.freeze({ ...list, notifications: [...withRead(list.notifications, ids, at)] })
      : list,
  );
}

function readAgain(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: pushQueryKeys.inbox() });
}

export type InboxActions = Readonly<{
  open: (row: InboxNotification) => void;
  markAll: () => void;
  markingAll: boolean;
}>;

export function useInboxActions(): InboxActions {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { show } = useToast();
  const checks = useMemo(() => staleChecksFor(client), [client]);
  const open = useCallback(
    (row: InboxNotification) => {
      markReadOnScreen(queryClient, new Set([row.id]));
      void openInboxRow(row, {
        checks,
        markRead: (id) => markNotificationRead(client, id),
        navigate: (route) => router.push(route),
        openBrowser: openInBrowser,
        notify: show,
      }).finally(() => readAgain(queryClient));
    },
    [checks, client, queryClient, router, show],
  );
  const all = useMutation({
    mutationFn: () => markAllRead(() => markAllNotificationsRead(client), show, userMessage),
    onMutate: () => markReadOnScreen(queryClient, 'all'),
    onSettled: () => readAgain(queryClient),
  });
  const markAll = useCallback(() => all.mutate(), [all]);
  return { open, markAll, markingAll: all.isPending };
}
