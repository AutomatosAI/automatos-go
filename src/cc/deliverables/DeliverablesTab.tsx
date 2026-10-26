// The Deliverables tab (handoff §2 'Deliverables', D-DELIVERABLES, D25): the type filters over the
// cards, newest first as the server lists them, and 'Load more' while there are older ones. The
// filters stay on screen while a filter loads; a filter that fails with nothing to show is the
// foundation's ErrorState, and each filter has its own empty copy. A pull refetches the loaded pages.
// The shell's head opens the list (TabHead), so it scrolls away with the cards.

import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, EmptyState, ErrorState, LoadingState } from '../../ui';
import { TabHead } from '../shell/TabHead';
import { DELIVERABLES_COPY } from '../strings';
import { GALLERY_LAYOUT } from './chrome';
import { DeliverableCard } from './DeliverableCard';
import type { DeliverableCardView } from './gallery';
import { TypePills } from './TypePills';
import { useGallery, type Gallery, type LoadMore } from './use-gallery';

const keyOf = (card: DeliverableCardView) => card.id;

function CardGap() {
  const { spacing } = useTokens();
  return <View style={{ height: spacing[GALLERY_LAYOUT.cardGap] }} />;
}

/**
 * No card to show: the filter's empty copy once it has answered, else its failure or the wait.
 * Play's Shelf draws it too.
 */
export function NoCards({ gallery }: { readonly gallery: Gallery }) {
  const { query, view } = gallery;
  if (view.empty) return <EmptyState title={view.empty.title} message={view.empty.message} />;
  return query.error ? (
    <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  ) : (
    <LoadingState label={DELIVERABLES_COPY.loading} />
  );
}

/** 'Load more' under the last card (Play's Shelf draws it too). */
export function LoadMoreButton({ loadMore }: { readonly loadMore: LoadMore }) {
  const { spacing } = useTokens();
  return (
    <View
      style={{
        paddingHorizontal: spacing[GALLERY_LAYOUT.paddingX],
        paddingTop: spacing[GALLERY_LAYOUT.footerGap],
      }}
    >
      <Button
        label={DELIVERABLES_COPY.loadMore}
        accessibilityHint={DELIVERABLES_COPY.loadMoreHint}
        variant="outline"
        fullWidth
        busy={loadMore.busy}
        onPress={loadMore.load}
      />
    </View>
  );
}

export function DeliverablesTab() {
  const { colours, spacing } = useTokens();
  const gallery = useGallery();
  const { view, pull, loadMore, choose } = gallery;
  const inset = spacing[GALLERY_LAYOUT.paddingX];
  const renderCard: ListRenderItem<DeliverableCardView> = ({ item }) => (
    <View style={{ paddingHorizontal: inset }}>
      <DeliverableCard view={item} />
    </View>
  );

  return (
    <FlatList
      data={view.cards}
      keyExtractor={keyOf}
      renderItem={renderCard}
      accessibilityLabel={DELIVERABLES_COPY.listLabel}
      ListHeaderComponent={
        <>
          <TabHead />
          <TypePills pills={view.pills} onChoose={choose} />
        </>
      }
      ListHeaderComponentStyle={{ marginBottom: spacing[GALLERY_LAYOUT.gap] }}
      ItemSeparatorComponent={CardGap}
      ListEmptyComponent={<NoCards gallery={gallery} />}
      ListFooterComponent={
        view.canLoadMore && view.cards.length > 0 ? <LoadMoreButton loadMore={loadMore} /> : null
      }
      contentContainerStyle={{
        paddingTop: spacing[GALLERY_LAYOUT.paddingTop],
        paddingBottom: spacing[GALLERY_LAYOUT.paddingBottom],
      }}
      refreshControl={
        <RefreshControl
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          tintColor={colours[GALLERY_LAYOUT.spinner]}
          colors={[colours[GALLERY_LAYOUT.spinner]]}
        />
      }
    />
  );
}
