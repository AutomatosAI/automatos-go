// The Inventory in the handheld's screen (PRD-001 §4.6.1 D-ARC-6, US-022n; README 'Pages'
// /deliverables, the 'Phone 390' bag and the design kit's deliverables/bag.tsx at 034fa629c): ▶
// Inventory on the D-pad shows it in place of the chat (no route). The tabs (ALL, REPORTS,
// DOCUMENTS, IMAGES) and the count over the bag window: two slots to a row, newest first, each its
// kind word, its pixel icon, its title and its day, with MORE while the gallery has older pages;
// the bag scrolls inside its window, which keeps a share of the screen. 'Opening your bag…' until
// the read answers, "Couldn't open your bag." with Try again when it cannot, and an empty bag is
// Auto asleep, 'Your bag is empty.' and GO TO CHAT, which shows the chat again. Pressing a slot
// puts the ▶ cursor on it (the newest until then); the info window under the bag names it
// ('Laptop shortlist · Report · Today') with OPEN (the Deliverable's own screen) and ALL
// DELIVERABLES (the Command Centre's page). The items are A3's Deliverables read (use-inventory.ts).

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import { ARCADE_DRESS_COPY, ARCADE_INVENTORY_COPY } from '../../strings';
import { ARCADE_BODY_MIN } from '../../typeface/arcade-type';
import { ArcadeButton } from '../parts/ArcadeButton';
import { ArcadeWindow } from '../parts/ArcadeWindow';
import { useArcadePaint } from '../parts/use-arcade-paint';
import { ItemIcon } from '../sprite/ItemIcon';
import { PixelSprite } from '../sprite/PixelSprite';
import {
  INVENTORY_ALL_ROUTE,
  INVENTORY_TABS,
  bagRows,
  infoLine,
  itemRoute,
  type InventoryItem,
  type InventoryTabId,
} from './inventory';
import { useInventory, type Inventory } from './use-inventory';

/**
 * The 'Phone 390' bag (and the kit's inventory.module.css under 1024 px): 8 pt between the tabs, 10
 * between slots, a slot at least 150 high with 10 inside and 6 between its lines, a 16 pt title;
 * the bag's least height a share of the screen.
 */
const BAG = Object.freeze({
  pad: 10,
  gap: 10,
  tabGap: 8,
  slotGap: 6,
  iconPad: 6,
  ring: 2,
  slot: 150,
  title: 16,
  titleLines: 3,
  share: 0.4,
});
const said = ARCADE_INVENTORY_COPY;

type TabsProps = { readonly tab: InventoryTabId; readonly onTab: (id: InventoryTabId) => void };

function Tabs({ tab, onTab }: TabsProps) {
  const { vars, type } = useArcadePaint();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={said.tabsLabel}
      contentContainerStyle={styles.tabs}
    >
      {INVENTORY_TABS.map((each) => {
        const on = each.id === tab;
        return (
          <Pressable
            key={each.id}
            onPress={() => onTab(each.id)}
            accessibilityRole="tab"
            accessibilityLabel={each.label}
            accessibilityState={{ selected: on }}
            style={[styles.tab, { borderColor: vars.bd, backgroundColor: on ? vars.hl : vars.win }]}
          >
            <Text style={[type.label, { color: on ? vars.hlt : vars.tx }]}>{each.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type SlotProps = {
  readonly item: InventoryItem;
  readonly selected: boolean;
  readonly onPick: (id: string) => void;
};

function Slot({ item, selected, onPick }: SlotProps) {
  const { vars, type } = useArcadePaint();
  const ink = selected ? vars.hlt : vars.tx;
  return (
    <Pressable
      onPress={() => onPick(item.id)}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityHint={said.slotHint}
      accessibilityState={{ selected }}
      style={[
        styles.slot,
        { borderColor: vars.bd, backgroundColor: selected ? vars.hl : vars.page },
      ]}
    >
      <View style={styles.slotHead}>
        <Text style={[type.label, styles.shrink, { color: ink }]}>{item.word}</Text>
        {selected ? (
          <Text style={[type.label, { color: ink }]}>{ARCADE_DRESS_COPY.cursor}</Text>
        ) : null}
      </View>
      <View style={styles.icon}>
        <ItemIcon kind={item.kind} />
      </View>
      <Text numberOfLines={BAG.titleLines} style={[type.body(BAG.title), { color: ink }]}>
        {item.title}
      </Text>
      {item.day ? (
        <Text style={[type.body(ARCADE_BODY_MIN), { color: selected ? vars.hlt : vars.tx2 }]}>
          {item.day}
        </Text>
      ) : null}
    </Pressable>
  );
}

type GridProps = {
  readonly items: readonly InventoryItem[];
  readonly selected: string | null;
  readonly onPick: (id: string) => void;
};

function Grid({ items, selected, onPick }: GridProps) {
  return (
    <>
      {bagRows(items).map((row) => (
        <View key={row[0].id} style={styles.row}>
          {row.map((item) => (
            <Slot key={item.id} item={item} selected={item.id === selected} onPick={onPick} />
          ))}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </>
  );
}

function Empty({ onChat }: { readonly onChat: () => void }) {
  const { vars, type } = useArcadePaint();
  return (
    <View style={styles.centre}>
      <PixelSprite state="sleeping" />
      <Text
        accessibilityRole="header"
        style={[type.display('screen'), styles.centred, { color: vars.tx }]}
      >
        {said.emptyTitle}
      </Text>
      <Text style={[type.body(ARCADE_BODY_MIN), styles.centred, { color: vars.tx2 }]}>
        {said.emptyLine}
      </Text>
      <ArcadeButton
        kind="primary"
        label={said.goToChat}
        hint={said.goToChatHint}
        onPress={onChat}
      />
    </View>
  );
}

function Unread({ failed, retry }: { readonly failed: boolean; readonly retry: () => void }) {
  const { vars, type } = useArcadePaint();
  if (!failed) {
    return (
      <Text
        accessibilityLiveRegion="polite"
        style={[type.body(ARCADE_BODY_MIN), { color: vars.tx2 }]}
      >
        {said.loading}
      </Text>
    );
  }
  return (
    <View style={styles.centre}>
      <Text accessibilityRole="alert" style={[type.body(ARCADE_BODY_MIN), { color: vars.hp }]}>
        {said.loadFailed}
      </Text>
      <ArcadeButton label={said.retry} onPress={retry} />
    </View>
  );
}

function BagContent({ bag, onChat }: { readonly bag: Inventory; readonly onChat: () => void }) {
  const { view } = bag;
  if (view.status !== 'ready')
    return <Unread failed={view.status === 'failed'} retry={bag.retry} />;
  if (view.items.length === 0) return <Empty onChat={onChat} />;
  return (
    <>
      <Grid items={view.items} selected={bag.selected?.id ?? null} onPick={bag.onPick} />
      {bag.canLoadMore ? (
        <View style={styles.more}>
          <ArcadeButton label={said.more} hint={said.moreHint} onPress={bag.loadMore.load} />
        </View>
      ) : null}
    </>
  );
}

function InfoWindow({ item }: { readonly item: InventoryItem | null }) {
  const { vars, type } = useArcadePaint();
  const router = useRouter();
  return (
    <ArcadeWindow contentStyle={styles.window}>
      <View style={styles.info}>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[type.label, { color: vars.ac }]}
        >
          {ARCADE_DRESS_COPY.cursor}
        </Text>
        <Text style={[type.body(BAG.title), styles.shrink, { color: vars.tx }]}>
          {infoLine(item)}
        </Text>
      </View>
      <View style={styles.actions}>
        {item ? (
          <ArcadeButton
            kind="primary"
            label={said.open}
            hint={said.openHint}
            onPress={() => router.push(itemRoute(item))}
          />
        ) : null}
        <ArcadeButton
          label={said.all}
          hint={said.allHint}
          onPress={() => router.push(INVENTORY_ALL_ROUTE)}
        />
      </View>
    </ArcadeWindow>
  );
}

export type InventoryViewProps = {
  /** Shows the chat again (an empty bag's GO TO CHAT). */
  readonly onChat: () => void;
};

export function InventoryView({ onChat }: InventoryViewProps) {
  const { vars, type } = useArcadePaint();
  const { height } = useWindowDimensions();
  const bag = useInventory();
  const { view } = bag;
  return (
    <View style={styles.view}>
      <View style={styles.head}>
        <Tabs tab={bag.tab} onTab={bag.onTab} />
        {view.status === 'ready' ? (
          <Text style={[type.body(ARCADE_BODY_MIN), { color: vars.tx2 }]}>{view.count}</Text>
        ) : null}
      </View>
      <ArcadeWindow fill style={[styles.bagWindow, { minHeight: height * BAG.share }]}>
        <ScrollView
          accessibilityLabel={said.bag}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.bag}
        >
          <BagContent bag={bag} onChat={onChat} />
        </ScrollView>
      </ArcadeWindow>
      {view.status === 'ready' ? <InfoWindow item={bag.selected} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  view: { flex: 1, gap: BAG.gap },
  head: { gap: BAG.gap },
  tabs: { gap: BAG.tabGap },
  tab: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    paddingHorizontal: BAG.pad,
    borderWidth: BAG.ring,
  },
  bagWindow: { flex: 1 },
  bag: { padding: BAG.pad, gap: BAG.gap },
  row: { flexDirection: 'row', gap: BAG.gap },
  cell: { flex: 1 },
  slot: {
    flex: 1,
    minHeight: BAG.slot,
    padding: BAG.pad,
    gap: BAG.slotGap,
    borderWidth: BAG.ring,
  },
  slotHead: { flexDirection: 'row', justifyContent: 'space-between', gap: BAG.slotGap },
  shrink: { flexShrink: 1 },
  icon: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: BAG.iconPad,
  },
  more: { alignItems: 'center' },
  centre: { alignItems: 'center', gap: BAG.gap, paddingVertical: BAG.pad },
  centred: { textAlign: 'center' },
  window: { padding: BAG.pad, gap: BAG.gap },
  info: { flexDirection: 'row', alignItems: 'baseline', gap: BAG.gap },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: BAG.gap },
});
