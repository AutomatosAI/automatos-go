// The bag in React (US-022n): A3's Deliverables read (useGallery: the gallery's pages under the
// chosen type, its Load more and its failure toast; no new endpoint, no fetch outside src/api), the
// tab chosen (its filter handed to the gallery's choose), the phone's clock and calendar for each
// slot's day, and the slot the ▶ cursor is on, which a new tab puts back on the newest. Nothing
// polls (D-LIVE): the gallery's own cache and refetches keep it.

import { useCallback, useMemo, useState } from 'react';

import { useGallery, type LoadMore } from '../../../cc/deliverables/use-gallery';
import { useMinuteClock, usePhoneTimeZone } from '../../../cc/shell/use-shell';
import {
  bagView,
  selectedItem,
  tabFilter,
  type BagView,
  type InventoryItem,
  type InventoryTabId,
} from './inventory';

export type Inventory = {
  readonly tab: InventoryTabId;
  readonly onTab: (id: InventoryTabId) => void;
  readonly view: BagView;
  readonly selected: InventoryItem | null;
  readonly onPick: (id: string) => void;
  /** MORE: another page is there to load. */
  readonly canLoadMore: boolean;
  readonly loadMore: LoadMore;
  readonly retry: () => void;
};

export function useInventory(): Inventory {
  const gallery = useGallery();
  const { query, loadMore, choose } = gallery;
  const [tab, setTab] = useState<InventoryTabId>('all');
  const [picked, setPicked] = useState<string | null>(null);
  const now = useMinuteClock();
  const timeZone = usePhoneTimeZone();
  const pages = query.data?.pages ?? null;
  const failed = query.isError;
  const { refetch } = query;
  const view = useMemo(
    () => bagView({ pages, failed, clock: { now, timeZone } }),
    [pages, failed, now, timeZone],
  );
  const items = view.status === 'ready' ? view.items : null;
  const selected = useMemo(() => selectedItem(items ?? [], picked), [items, picked]);
  const onTab = useCallback(
    (id: InventoryTabId) => {
      setTab(id);
      setPicked(null);
      choose(tabFilter(id));
    },
    [choose],
  );
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);
  return {
    tab,
    onTab,
    view,
    selected,
    onPick: setPicked,
    canLoadMore: gallery.view.canLoadMore,
    loadMore,
    retry,
  };
}
