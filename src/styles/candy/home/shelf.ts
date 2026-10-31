// P3 Shelf in Candy (PRD-001 §4.6.2 D-CAN-6, US-023i; CANDY-LAYOUT §4 P3 and the 390 mock; the
// design kit's deliverables/shelf.ts at 3920359d5), pure: the type chips, each tile and the grid
// they make, the empty shelf's words and where its links go. The items are A3's Deliverables read
// (src/cc/deliverables useGallery: the gallery's pages under one type filter, newest first,
// Studio's feed without heartbeats), as Arcade's Inventory reads them; no new endpoint. The
// components only draw.
//
//   The chips are All, Reports, Documents, Images, Spreadsheets and Slides, each the gallery's type
//   filter (null, report, document, image, spreadsheet, slide); the gallery filters by type alone.
//   P3's search circle is left out: the gallery's query has no search (repoContradictions).
//   A tile wears its kind's card gradient (kinds.ts deliverableSetOf: report and slides the first
//   set, document and spreadsheet the second, image and blog post the third), with a white circle
//   holding the type's initial in the set's b stop; under it the title and '{type} · {day}' (A3's
//   typeWord, when.ts dayWords on the phone's calendar). VoiceOver hears 'Q3 brand report, Report,
//   Today'; a tile opens the Deliverable's own screen.
//   No Deliverable at all is Candy's empty shelf (Auto asleep, its words, the way to the chat); a
//   type with none is A3's words for that type, with the way back to every type.
// Pure: no React, React Native, Expo or Skia.

import {
  emptyCopy,
  mergePages,
  type DeliverablePage,
  type GalleryFilter,
} from '../../../cc/deliverables/gallery';
import type { DeliverableRow } from '../../../cc/deliverables/schemas';
import { typeWord } from '../../../cc/deliverables/types';
import { DELIVERABLES_COPY } from '../../../cc/strings';
import { routes } from '../../../navigation/routes';
import type { CandyVarName } from '../../tokens/candy';
import { deliverableSetOf } from '../kinds';
import { initialOf, type CardSet } from '../sets';
import { CANDY_SHELF_COPY } from '../strings';
import { dayWords } from '../when';

/**
 * The P3 mock's measures, in points: the band, the column under the top inset and its gaps, the
 * tile (168 tall, 7 inside, 8 between the block and its words) and its colour block (radius 16, 10
 * inside, the 34 pt badge with its 15 pt initial), the words' inset, and Auto asleep on an empty
 * shelf (the kit's 120).
 */
export const SHELF = Object.freeze({
  band: 300,
  top: 8,
  gap: 16,
  headerGap: 12,
  tile: 168,
  tileGap: 12,
  tilePad: 7,
  tileInnerGap: 8,
  block: 16,
  blockPad: 10,
  badge: 34,
  initial: 15,
  wordsPadH: 6,
  wordsPadBottom: 4,
  auto: 120,
});

// ── The type chips ───────────────────────────────────────────────────────────────────────────

export type ShelfChipId = keyof typeof CANDY_SHELF_COPY.chips;

export type ShelfChip = {
  readonly id: ShelfChipId;
  readonly label: string;
  /** The gallery's type filter: an artifact type, or null for All. */
  readonly filter: GalleryFilter;
};

function chip(id: ShelfChipId, filter: GalleryFilter): ShelfChip {
  return Object.freeze({ id, label: CANDY_SHELF_COPY.chips[id], filter });
}

/** The design's chips, in its order. */
export const SHELF_CHIPS: readonly ShelfChip[] = Object.freeze([
  chip('all', null),
  chip('reports', 'report'),
  chip('documents', 'document'),
  chip('images', 'image'),
  chip('spreadsheets', 'spreadsheet'),
  chip('slides', 'slide'),
]);

/** The chip's type filter for useGallery's choose. */
export function chipFilter(id: ShelfChipId): GalleryFilter {
  return SHELF_CHIPS.find((each) => each.id === id)?.filter ?? null;
}

// ── One tile ─────────────────────────────────────────────────────────────────────────────────

/** The badge's initial wears its set's b stop: dark enough on white (white on b holds 4.5:1). */
const INITIAL_INK: Readonly<Record<CardSet, CandyVarName>> = Object.freeze({
  1: 'g1b',
  2: 'g2b',
  3: 'g3b',
});

export type ShelfTile = {
  readonly id: string;
  /** routes.cc.deliverable(id): the Deliverable's own screen. */
  readonly href: string;
  /** Its kind's card gradient. */
  readonly set: CardSet;
  /** The type's initial ('R' for a Report). */
  readonly initial: string;
  readonly initialInk: CandyVarName;
  readonly title: string;
  /** 'Report · Today'. */
  readonly line: string;
  /** What VoiceOver hears: 'Q3 brand report, Report, Today'. */
  readonly label: string;
};

/** A row as a tile; `now` is the phone's clock in milliseconds. */
export function shelfTile(row: DeliverableRow, now: number): ShelfTile {
  const type = typeWord(row.artifact_type) ?? DELIVERABLES_COPY.file;
  const title = row.title.trim() || DELIVERABLES_COPY.untitled;
  const day = dayWords(row.created_at, now);
  const set = deliverableSetOf(row.artifact_type);
  return Object.freeze({
    id: row.id,
    href: routes.cc.deliverable(row.id),
    set,
    initial: initialOf(type),
    initialInk: INITIAL_INK[set],
    title,
    line: CANDY_SHELF_COPY.line(type, day),
    label: CANDY_SHELF_COPY.tileLabel(title, type, day),
  });
}

/** The chosen chip's pages as tiles, newest first, each once; none before the first page. */
export function shelfTiles(
  pages: readonly DeliverablePage[] | null,
  now: number,
): readonly ShelfTile[] {
  if (pages === null) return Object.freeze([]);
  return Object.freeze(mergePages(pages).map((row) => shelfTile(row, now)));
}

/** The grid: two tiles to a row, the last row may hold one. */
export const SHELF_COLUMNS = 2;

export function shelfRows(tiles: readonly ShelfTile[]): readonly (readonly ShelfTile[])[] {
  return Array.from({ length: Math.ceil(tiles.length / SHELF_COLUMNS) }, (_, row) =>
    tiles.slice(row * SHELF_COLUMNS, row * SHELF_COLUMNS + SHELF_COLUMNS),
  );
}

// ── An empty shelf, and the links ────────────────────────────────────────────────────────────

export type ShelfEmpty = {
  readonly title: string;
  readonly message: string;
  /**
   * 'chat': no Deliverable at all (Auto asleep, the way to the chat); 'all': a type with none (the
   * way back to every type).
   */
  readonly action: 'chat' | 'all';
};

/** What an answered, empty filter says: Candy's words for All, A3's for a type. */
export function shelfEmpty(filter: GalleryFilter): ShelfEmpty {
  if (filter === null) return Object.freeze({ ...CANDY_SHELF_COPY.empty, action: 'chat' });
  return Object.freeze({ ...emptyCopy(filter), action: 'all' });
}

/** Where 'All Deliverables' goes: the Command Centre's Deliverables. */
export const SHELF_ALL_ROUTE: string = routes.cc.deliverables;
