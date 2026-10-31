// P3 Shelf (PRD-001 §4.6.2 D-CAN-6, US-023i; CANDY-LAYOUT §4 P3 and the 390 mock), over shelf.ts:
// the band 300 tall behind the top of the view, then a column 20 in from each side, 16 apart: the
// header at the top inset + 8 — 'Deliverables' (Outfit 600 30), the pause control and the home
// menu circle at the right (no search circle: the gallery has none) — then the type chips (36 tall,
// sliding sideways past the right gutter, the chosen one in the accent), then the grid: two tiles
// to a row, 12 apart, each at least 168 tall with rs corners on the window's fill and 7 inside, its
// colour block in its kind's gradient (radius 16) with a 34 pt white circle holding the type's
// initial in the set's b stop, then the title (Nunito 800 13, one line) and '{type} · {day}' (12,
// quiet). A tile opens the Deliverable's own screen. Under the grid, More while the gallery has
// another page and All Deliverables (the Command Centre's page). The wait and a failure are A3's
// gallery's own (NoCards); an empty shelf is Auto asleep, its words and a Chat pill to the Chat
// view, and an empty type A3's words with Show all. Auto asleep floats, so the pause control is
// drawn here (D-CAN-5, WCAG 2.2.2). A pull refetches the loaded pages; the column's foot clears the
// floating tab bar.

import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoCards } from '../../../cc/deliverables/DeliverablesTab';
import type { LoadMore } from '../../../cc/deliverables/use-gallery';
import { DELIVERABLES_COPY } from '../../../cc/strings';
import { Text } from '../../../ui';
import { CANDY_LEADING, CANDY_MIN, candyAvatarInitial } from '../../typeface/candy-type';
import { CandyAuto } from '../auto/CandyAuto';
import { CandyPauseButton } from '../CandyPauseButton';
import { Band } from '../parts/Band';
import { GradientCard } from '../parts/GradientCard';
import { PAGE_GUTTER } from '../parts/orb-model';
import { Pill, PillRow } from '../parts/Pill';
import { BAND_CURVE } from '../parts/shapes';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_SHELF_COPY } from '../strings';
import { MenuCircle, type MenuCircleProps } from './MenuCircle';
import {
  SHELF,
  SHELF_ALL_ROUTE,
  SHELF_CHIPS,
  shelfRows,
  type ShelfChipId,
  type ShelfEmpty,
  type ShelfTile,
} from './shelf';
import { useShelf, type Shelf } from './use-shelf';

const PRESSED_OPACITY = 0.7;
const said = CANDY_SHELF_COPY;

function ShelfHeader({ menu }: { readonly menu: MenuCircleProps }) {
  const { vars, type } = useCandyPaint();
  return (
    <View style={styles.header}>
      <Text
        accessibilityRole="header"
        style={[type.display('screen'), styles.title, { color: vars.text }]}
      >
        {said.title}
      </Text>
      <View style={styles.controls}>
        <CandyPauseButton />
        <MenuCircle {...menu} />
      </View>
    </View>
  );
}

type ChipsProps = { readonly chip: ShelfChipId; readonly onChip: (id: ShelfChipId) => void };

function TypeChips({ chip, onChip }: ChipsProps) {
  return (
    <PillRow role="tablist" accessibilityLabel={DELIVERABLES_COPY.filtersLabel} bleed={PAGE_GUTTER}>
      {SHELF_CHIPS.map((each) => (
        <Pill
          key={each.id}
          label={each.label}
          selected={each.id === chip}
          onPress={() => onChip(each.id)}
          ground="win"
          role="tab"
        />
      ))}
    </PillRow>
  );
}

function Tile({ tile }: { readonly tile: ShelfTile }) {
  const router = useRouter();
  const { vars, type, rs } = useCandyPaint();
  const meta = type.body(CANDY_MIN, 400, { leading: CANDY_LEADING.label });
  return (
    <Pressable
      onPress={() => router.push(tile.href)}
      accessibilityRole="button"
      accessibilityLabel={tile.label}
      accessibilityHint={DELIVERABLES_COPY.openHint}
      style={({ pressed }) => [
        styles.tile,
        { borderRadius: rs, backgroundColor: vars.win, opacity: pressed ? PRESSED_OPACITY : 1 },
      ]}
    >
      <GradientCard
        set={tile.set}
        radius={SHELF.block}
        shadow={false}
        style={styles.block}
        contentStyle={styles.blockContent}
      >
        <View style={[styles.badge, { backgroundColor: vars.cardInk }]}>
          <Text style={[candyAvatarInitial(SHELF.initial), { color: vars[tile.initialInk] }]}>
            {tile.initial}
          </Text>
        </View>
      </GradientCard>
      <View style={styles.words}>
        <Text numberOfLines={1} style={[type.display('cardSm'), { color: vars.text }]}>
          {tile.title}
        </Text>
        <Text style={[meta, { color: vars.quiet }]}>{tile.line}</Text>
      </View>
    </Pressable>
  );
}

function Grid({ tiles }: { readonly tiles: readonly ShelfTile[] }) {
  return (
    <View style={styles.grid}>
      {shelfRows(tiles).map((row) => (
        <View key={row[0].id} style={styles.row}>
          {row.map((tile) => (
            <Tile key={tile.id} tile={tile} />
          ))}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

function ShelfFoot({ more, loadMore }: { readonly more: boolean; readonly loadMore: LoadMore }) {
  const router = useRouter();
  return (
    <View style={styles.foot}>
      {more ? (
        <Pill
          label={loadMore.busy ? said.loadingMore : said.more}
          onPress={loadMore.busy ? undefined : loadMore.load}
          ground="win"
          accessibilityHint={DELIVERABLES_COPY.loadMoreHint}
        />
      ) : null}
      <Pill
        label={said.all}
        onPress={() => router.push(SHELF_ALL_ROUTE)}
        ground="win"
        accessibilityHint={said.allHint}
      />
    </View>
  );
}

type EmptyProps = {
  readonly empty: ShelfEmpty;
  readonly onChat: () => void;
  readonly onAll: () => void;
};

function Empty({ empty, onChat, onAll }: EmptyProps) {
  const { vars, type } = useCandyPaint();
  const chat = empty.action === 'chat';
  return (
    <View style={styles.empty}>
      {chat ? <CandyAuto state="sleeping" size={SHELF.auto} /> : null}
      <Text
        accessibilityRole="header"
        style={[type.display('card'), styles.centred, { color: vars.text }]}
      >
        {empty.title}
      </Text>
      <Text style={[type.label, styles.centred, { color: vars.quiet }]}>{empty.message}</Text>
      {chat ? (
        <Pill label={said.chat} onPress={onChat} ground="win" accessibilityHint={said.chatHint} />
      ) : (
        <Pill label={said.showAll} onPress={onAll} ground="win" accessibilityHint={said.showAllHint} />
      )}
    </View>
  );
}

function ShelfBody({ shelf, onChat }: { readonly shelf: Shelf; readonly onChat: () => void }) {
  const { gallery, tiles, empty, onChip } = shelf;
  if (empty) return <Empty empty={empty} onChat={onChat} onAll={() => onChip('all')} />;
  if (tiles.length === 0) return <NoCards gallery={gallery} />;
  return (
    <>
      <Grid tiles={tiles} />
      <ShelfFoot more={gallery.view.canLoadMore} loadMore={gallery.loadMore} />
    </>
  );
}

export type ShelfViewProps = {
  /** The home menu at the top right, as on every view (D73). */
  readonly menu: MenuCircleProps;
  /** The room the floating tab bar takes at the view's foot. */
  readonly footRoom: number;
  /** Shows the Chat view (an empty shelf's Chat pill). */
  readonly onChat: () => void;
};

export function ShelfView({ menu, footRoom, onChat }: ShelfViewProps) {
  const { vars } = useCandyPaint();
  const insets = useSafeAreaInsets();
  const shelf = useShelf();
  const { pull } = shelf.gallery;
  const pad = { paddingTop: insets.top + SHELF.top, paddingBottom: footRoom };
  return (
    <ScrollView
      style={styles.view}
      contentContainerStyle={[styles.column, pad]}
      refreshControl={
        <RefreshControl
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          tintColor={vars.accent}
          colors={[vars.accent]}
        />
      }
    >
      <Band height={SHELF.band} curve={BAND_CURVE.max} />
      <ShelfHeader menu={menu} />
      <TypeChips chip={shelf.chip} onChip={shelf.onChip} />
      <ShelfBody shelf={shelf} onChat={onChat} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  view: { flex: 1 },
  column: { flexGrow: 1, paddingHorizontal: PAGE_GUTTER, gap: SHELF.gap },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SHELF.headerGap },
  title: { flexGrow: 1, flexShrink: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: SHELF.headerGap },
  grid: { gap: SHELF.tileGap },
  row: { flexDirection: 'row', gap: SHELF.tileGap },
  cell: { flex: 1 },
  tile: { flex: 1, minHeight: SHELF.tile, padding: SHELF.tilePad, gap: SHELF.tileInnerGap },
  block: { flexGrow: 1, minHeight: SHELF.badge + SHELF.blockPad * 2 },
  blockContent: { padding: SHELF.blockPad, alignItems: 'flex-start' },
  badge: {
    width: SHELF.badge,
    height: SHELF.badge,
    borderRadius: SHELF.badge / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { paddingHorizontal: SHELF.wordsPadH, paddingBottom: SHELF.wordsPadBottom },
  foot: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SHELF.headerGap },
  empty: { alignItems: 'center', gap: SHELF.headerGap, paddingVertical: SHELF.gap },
  centred: { textAlign: 'center' },
});
