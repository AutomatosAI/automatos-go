// The shelf in React (US-023i), as Arcade's use-inventory.ts reads the bag: A3's Deliverables read
// (useGallery: the gallery's pages under the chosen type, its Load more, its pull and its failure
// toast; no new endpoint, no fetch outside src/api), the chip chosen (its filter handed to the
// gallery's choose), and the phone's clock for each tile's day, re-read at the turn of each minute.
// Nothing polls (D-LIVE): the gallery's own cache and refetches keep it.

import { useCallback, useMemo, useState } from 'react';

import { useGallery, type Gallery } from '../../../cc/deliverables/use-gallery';
import { useMinuteClock } from '../../../cc/shell/use-shell';
import {
  chipFilter,
  shelfEmpty,
  shelfTiles,
  type ShelfChipId,
  type ShelfEmpty,
  type ShelfTile,
} from './shelf';

export type Shelf = {
  readonly gallery: Gallery;
  readonly chip: ShelfChipId;
  readonly onChip: (id: ShelfChipId) => void;
  readonly tiles: readonly ShelfTile[];
  /** The chosen filter has answered with nothing: what the shelf says; else null. */
  readonly empty: ShelfEmpty | null;
};

export function useShelf(): Shelf {
  const gallery = useGallery();
  const { query, view, choose } = gallery;
  const [chip, setChip] = useState<ShelfChipId>('all');
  const now = useMinuteClock();
  const pages = query.data?.pages ?? null;
  const tiles = useMemo(() => shelfTiles(pages, now.getTime()), [pages, now]);
  const answeredEmpty = view.empty !== null;
  const empty = useMemo(
    () => (answeredEmpty ? shelfEmpty(chipFilter(chip)) : null),
    [answeredEmpty, chip],
  );
  const onChip = useCallback(
    (id: ShelfChipId) => {
      setChip(id);
      choose(chipFilter(id));
    },
    [choose],
  );
  return { gallery, chip, onChip, tiles, empty };
}
