// Play's Shelf (Ember 04, US-017g) on routes.cc.deliverables: A3's Deliverables (src/cc/deliverables
// useGallery: the chosen type's pages, the pills, Load more, a pull to refresh) as Ember's gallery
// wall. 'Your shelf' (the large screen slot) over the server's count in Geist Mono with Auto beside
// it, idle; A3's type pills (Play's dress: 40 high, round), which stay put; then, scrolling, the
// newest piece lit and the rest two to a row, A3's Load more under them, and A3's own wait, failure
// and empty words when there is nothing to show; the bottom bar under it all. The Command Centre's
// shell steps aside on this path in Play (use-play-shelf.ts), so the screen paints its own top inset.

import { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, type ListRenderItem } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { LoadMoreButton, NoCards } from '../../cc/deliverables/DeliverablesTab';
import { TypePills } from '../../cc/deliverables/TypePills';
import { useGallery, type Gallery } from '../../cc/deliverables/use-gallery';
import { useMinuteClock, usePhoneTimeZone } from '../../cc/shell/use-shell';
import { Screen, Text } from '../../ui';
import { Mascot } from '../mascot/Mascot';
import { PlayBottomBar } from '../play/companion';
import { useCompanionPaint } from '../play/companion/use-companion';
import { PLAY_SHELF_COPY } from '../strings';
import { useTokens } from '../theme';
import { SHELF, shelfRows, shelfView, type ShelfCard, type ShelfView } from './play-shelf';
import { ShelfHero, ShelfTile } from './ShelfCards';

/** The Command Centre's frame keeps the sides and the bottom; the Shelf paints the top. */
const EDGES: readonly Edge[] = ['top'];
const { header, pills, list, grid } = SHELF;

type Row = readonly ShelfCard[];

function ShelfHeader({ count }: { readonly count: string | null }) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const { vars, style } = paint;
  return (
    <View
      style={[styles.header, { paddingHorizontal: header.paddingX, paddingTop: header.paddingTop }]}
    >
      <View style={[styles.titles, { gap: header.titleGap, paddingBottom: header.paddingBottom }]}>
        <Text
          accessibilityRole="header"
          style={[style.type.display('screenLg'), { color: vars.groundText }]}
        >
          {PLAY_SHELF_COPY.title}
        </Text>
        {count ? (
          <Text
            style={[
              style.type.mono(header.count, 400, { uppercase: true }),
              { color: vars.groundText2 },
            ]}
          >
            {count}
          </Text>
        ) : null}
      </View>
      <Mascot size={SHELF.mascot} state="idle" />
    </View>
  );
}

function GridRow({ row }: { readonly row: Row }) {
  return (
    <View style={[styles.row, { gap: grid.gap }]}>
      {row.map((card) => (
        <ShelfTile key={card.id} card={card} />
      ))}
      {row.length < grid.columns ? <View style={styles.spare} /> : null}
    </View>
  );
}

const keyOf = (row: Row) => row[0]?.id ?? '';
const renderRow: ListRenderItem<Row> = ({ item }) => <GridRow row={item} />;

function RowGap() {
  return <View style={{ height: grid.gap }} />;
}

/** A3's pieces are drawn edge to edge with their own inset: the list's is taken back. */
const fullBleed = { marginHorizontal: -list.paddingX };

function Wall({ gallery, view }: { readonly gallery: Gallery; readonly view: ShelfView }) {
  const { colours } = useTokens();
  const rows = useMemo(() => shelfRows(view.grid), [view.grid]);
  const { pull, loadMore } = gallery;
  const { newest } = view;
  return (
    <FlatList
      data={rows}
      keyExtractor={keyOf}
      renderItem={renderRow}
      accessibilityLabel={PLAY_SHELF_COPY.listLabel}
      ListHeaderComponent={newest ? <ShelfHero card={newest} /> : null}
      ListHeaderComponentStyle={{ marginBottom: rows.length > 0 ? list.gap : 0 }}
      ItemSeparatorComponent={RowGap}
      ListEmptyComponent={newest ? null : <NoCards gallery={gallery} />}
      ListFooterComponent={
        view.canLoadMore && newest ? (
          <View style={fullBleed}>
            <LoadMoreButton loadMore={loadMore} />
          </View>
        ) : null
      }
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: list.paddingX, paddingTop: list.paddingTop, paddingBottom: list.gap },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          tintColor={colours.mutedForeground}
          colors={[colours.mutedForeground]}
        />
      }
    />
  );
}

export function PlayShelf() {
  const gallery = useGallery();
  const now = useMinuteClock();
  const timeZone = usePhoneTimeZone();
  const pages = gallery.query.data?.pages ?? null;
  const view = useMemo(
    () => shelfView({ gallery: gallery.view, pages, clock: { now, timeZone } }),
    [gallery.view, pages, now, timeZone],
  );
  return (
    <Screen ground="shelf" edges={EDGES}>
      <ShelfHeader count={view.count} />
      <View style={{ paddingVertical: pills.paddingY }}>
        <TypePills pills={view.pills} onChoose={gallery.choose} />
      </View>
      <Wall gallery={gallery} view={view} />
      <PlayBottomBar active="shelf" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  titles: { flexShrink: 1 },
  row: { flexDirection: 'row' },
  spare: { flex: 1 },
  content: { flexGrow: 1 },
});
