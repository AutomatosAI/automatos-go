// The Board tab (handoff §2 'Board', D-BOARD): the status filter pills over the ticket cards, sorted
// Blocked → Review → In progress → Assigned → Inbox → Done, then Failed and Cancelled. It reads the
// Board's one query (the shell's figures share the cache entry); the foundation's stream refreshes
// it live (board_changed invalidates it centrally) and on resume, and a pull refetches it. A load
// that fails with nothing to show is the foundation's ErrorState; each filter has its own empty copy.

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';

import { useApiClient } from '../../app-state/session';
import { useTokens } from '../../styles/theme';
import { EmptyState, ErrorState, LoadingState } from '../../ui';
import { BOARD_COPY } from '../strings';
import { usePullRefresh } from '../use-pull-refresh';
import { boardQuery } from './api';
import type { BoardFilter } from './board';
import { BOARD_LAYOUT } from './chrome';
import { FilterPills } from './FilterPills';
import { TicketCard } from './TicketCard';
import { boardView, type TicketCardView } from './view-model';

const keyOf = (card: TicketCardView) => String(card.id);

function CardGap() {
  const { spacing } = useTokens();
  return <View style={{ height: spacing[BOARD_LAYOUT.cardGap] }} />;
}

function useBoardTab() {
  const client = useApiClient();
  const query = useQuery(boardQuery(client));
  const [chosen, setChosen] = useState<BoardFilter>('all');
  const pull = usePullRefresh(query.refetch);
  const tickets = query.data?.tasks;
  const view = useMemo(() => (tickets ? boardView(tickets, chosen) : null), [tickets, chosen]);
  return { query, view, pull, choose: setChosen };
}

export function BoardTab() {
  const { colours, spacing } = useTokens();
  const { query, view, pull, choose } = useBoardTab();
  const inset = spacing[BOARD_LAYOUT.paddingX];
  const renderCard: ListRenderItem<TicketCardView> = ({ item }) => (
    <View style={{ paddingHorizontal: inset }}>
      <TicketCard view={item} />
    </View>
  );

  if (!view) {
    return query.error ? (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    ) : (
      <LoadingState label={BOARD_COPY.loading} />
    );
  }
  return (
    <FlatList
      data={view.cards}
      keyExtractor={keyOf}
      renderItem={renderCard}
      accessibilityLabel={BOARD_COPY.listLabel}
      ListHeaderComponent={<FilterPills pills={view.pills} onChoose={choose} />}
      ListHeaderComponentStyle={{ marginBottom: spacing[BOARD_LAYOUT.gap] }}
      ItemSeparatorComponent={CardGap}
      ListEmptyComponent={
        view.empty ? <EmptyState title={view.empty.title} message={view.empty.message} /> : null
      }
      contentContainerStyle={{
        paddingTop: spacing[BOARD_LAYOUT.paddingTop],
        paddingBottom: spacing[BOARD_LAYOUT.paddingBottom],
      }}
      refreshControl={
        <RefreshControl
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          tintColor={colours[BOARD_LAYOUT.spinner]}
          colors={[colours[BOARD_LAYOUT.spinner]]}
        />
      }
    />
  );
}
