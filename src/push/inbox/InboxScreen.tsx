// The notifications inbox (pushScreens.inbox): every bell notification of this workspace, newest
// first, the one a push asked for (the route's focus) at the top, each a button that opens what it
// is about and marks it read; Mark all read in the header. Reached from the header menu (Studio and
// HUD), Play's Chats, and every push the phone could not open on its own screen. It only wires:
// the rows are model.ts's, a tap actions.ts's.

import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { routes } from '../../navigation/routes';
import { useGoBack } from '../../navigation/use-go-back';
import { useTokens } from '../../styles/theme';
import { Divider, EmptyState, ErrorState, LoadingState, Screen } from '../../ui';
import { inboxFocusFrom } from '../nav';
import { PUSH_INBOX_COPY } from '../strings';
import { InboxHeader } from './InboxHeader';
import { InboxRow } from './InboxRow';
import { hasUnread, inboxRows, type InboxRowView } from './model';
import type { InboxNotification } from './schemas';
import { useInboxActions, useInboxList } from './use-inbox';

/** The header runs up under the status bar itself. */
const SCREEN_EDGES: readonly Edge[] = ['left', 'right', 'bottom'];

const keyOf = (row: InboxRowView) => row.id;

const NO_NOTIFICATIONS: readonly InboxNotification[] = Object.freeze([]);

type ListProps = {
  readonly rows: readonly InboxRowView[];
  readonly onOpen: (id: string) => void;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
};

function InboxList({ rows, onOpen, refreshing, onRefresh }: ListProps) {
  const { spacing } = useTokens();
  const renderItem = useCallback<ListRenderItem<InboxRowView>>(
    ({ item }) => <InboxRow row={item} onOpen={onOpen} />,
    [onOpen],
  );
  return (
    <FlatList
      data={rows}
      keyExtractor={keyOf}
      renderItem={renderItem}
      ItemSeparatorComponent={Divider}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentContainerStyle={{ paddingHorizontal: spacing.space3, paddingBottom: spacing.space6 }}
    />
  );
}

export function InboxScreen() {
  const focus = inboxFocusFrom(useLocalSearchParams());
  const goBack = useGoBack(routes.home);
  const list = useInboxList();
  const actions = useInboxActions();
  const notifications = useMemo<readonly InboxNotification[]>(
    () => list.data?.notifications ?? NO_NOTIFICATIONS,
    [list.data],
  );
  // the times are read against the moment each answer arrives
  const rows = useMemo(() => inboxRows(notifications, new Date(), focus), [notifications, focus]);
  const { open } = actions;
  const onOpen = useCallback(
    (id: string) => {
      const row = notifications.find((notification) => notification.id === id);
      if (row) open(row);
    },
    [notifications, open],
  );
  const refetch = useCallback(() => void list.refetch(), [list]);
  const body = (() => {
    if (list.isError && !list.data) return <ErrorState error={list.error} onRetry={refetch} />;
    if (!list.data) return <LoadingState />;
    if (rows.length === 0) {
      return (
        <EmptyState title={PUSH_INBOX_COPY.emptyTitle} message={PUSH_INBOX_COPY.emptyMessage} />
      );
    }
    return (
      <InboxList rows={rows} onOpen={onOpen} refreshing={list.isRefetching} onRefresh={refetch} />
    );
  })();
  return (
    <Screen edges={SCREEN_EDGES}>
      <InboxHeader
        onBack={goBack}
        onMarkAll={hasUnread(notifications) ? actions.markAll : null}
        marking={actions.markingAll}
      />
      {body}
    </Screen>
  );
}
