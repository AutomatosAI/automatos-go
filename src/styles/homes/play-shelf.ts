// Play's Shelf and a Deliverable's page (Ember 04-05, US-017g), pure: A3's gallery (src/cc/
// deliverables/gallery.ts: its pages, type pills and cards) as Ember's gallery wall. The newest piece
// is lit (the first card of the chosen filter, as the web's play-shelf.tsx spotlights index 0) with
// its 'Newest' badge; the rest hang in two columns. Each card's eyebrow is its type in A3's word and
// the day it was made ('Report · Today', 'Document · Mon'; the web's lib/play/shelf.ts shelfDate on
// the phone's calendar), the count line the server's total for the filter ('15 Deliverables'; none
// when an older server sends no total: a part count would mislead, as A3's pills say). A
// Deliverable's page adds who made it ('Report · Today · Scout'). In Play the Shelf and a
// Deliverable draw their own header and way back, so the Command Centre's shell steps aside on
// their paths. D25: no review state and no made-up id; a Deliverable is opened, never decided.

import {
  madeBy,
  mergePages,
  type DeliverableCardView,
  type DeliverablePage,
  type EmptyCopy,
  type GalleryView,
  type TypePillView,
} from '../../cc/deliverables/gallery';
import type { DeliverableRow } from '../../cc/deliverables/schemas';
import { TYPE_STYLE_KEYS, type TypeStyleKey } from '../../core/frozen/lib/looks/catalogue';
import { routes } from '../../navigation/routes';
import { joinLabel } from '../../ui/paint';
import { countPhrase } from '../../ui/variants';
import { relativeTime, sectionOf, type Clock } from '../play/companion/conversations';
import { PLAY_SHELF_COPY } from '../strings';
import type { TypeStyle } from '../type';
import { playDisplayAt } from '../typeface/play-type';

/** Ember 04's and 05's phone numbers, in points (the 10 pt labels raised to 11, D-A11Y). */
export const SHELF = Object.freeze({
  header: Object.freeze({ paddingX: 18, paddingTop: 4, titleGap: 6, paddingBottom: 12, count: 11 }),
  /** Auto beside the count, idle ('like he's proud of it'). */
  mascot: 84,
  pills: Object.freeze({ paddingY: 12 }),
  list: Object.freeze({ paddingX: 16, paddingTop: 4, gap: 18 }),
  hero: Object.freeze({
    height: 200,
    radius: 14,
    /** CSS's 160°, the accent's 28 % gone to 4 % by 70 % of the way. */
    angle: 160,
    fadeAt: 0.7,
    captionGap: 10,
  }),
  badge: Object.freeze({ inset: 12, paddingX: 7, paddingY: 4, radius: 5, size: 11 }),
  heroPaper: Object.freeze({ width: 124, height: 164, radius: 5, pad: 12, gap: 6, title: 16 }),
  heroChart: Object.freeze({ height: 44, gap: 4, bars: Object.freeze([0.6, 0.45, 1]) }),
  grid: Object.freeze({ columns: 2, gap: 14 }),
  tile: Object.freeze({ height: 130, radius: 12, gap: 8, titleLines: 2 }),
  tilePaper: Object.freeze({ width: 80, height: 108, radius: 4, pad: 9, gap: 5, title: 11 }),
  /** A tile's paper: a rule, a short accent rule (Ember's 40 %), a rule. */
  tileRules: Object.freeze([1, 0.4, 1]),
  rule: 2,
  /** Ember 05: '← Shelf' in a 52 pt bar, the cream sheet, the two actions under it. */
  page: Object.freeze({
    barHeight: 52,
    barPaddingX: 8,
    backPaddingX: 12,
    backSize: 15,
    sheetMarginX: 10,
    sheetRadius: 6,
    sheetPadY: 28,
    sheetPadX: 22,
    sheetGap: 14,
    textSize: 16,
    /** Ember's 16/1.55 on the sheet. */
    textLeading: 1.55,
    monoSize: 13,
    noteSize: 13,
    actionsGap: 10,
    actionsPadY: 12,
    actionsPadX: 16,
    actionHeight: 48,
    /** Ember's Download is 1, its primary 1.4 of the row. */
    outlineGrow: 1,
    primaryGrow: 1.4,
  }),
});

export type PaperSize = 'hero' | 'tile';

const PAPERS = Object.freeze({ hero: SHELF.heroPaper, tile: SHELF.tilePaper });

/** Each look's paper titles, built once: the small card slot at the sheet's size. */
const PAPER_TITLES = Object.freeze(
  Object.fromEntries(
    TYPE_STYLE_KEYS.map((font) => [
      font,
      Object.freeze({
        hero: playDisplayAt(font, 'cardSm', PAPERS.hero.title),
        tile: playDisplayAt(font, 'cardSm', PAPERS.tile.title),
      }),
    ]),
  ),
) as Readonly<Record<TypeStyleKey, Readonly<Record<PaperSize, TypeStyle>>>>;

/**
 * A printed sheet's title (16 on the newest, 11 on a tile): the look's display face only at 19 and
 * above, as the type's own rule says, so Instrument Serif falls to Geist 600 on both sheets.
 */
export function paperTitle(font: TypeStyleKey, paper: PaperSize): TypeStyle {
  return PAPER_TITLES[font][paper];
}

/** A paper's box: the newest's sheet or a tile's. */
export function paperSheet(paper: PaperSize) {
  return PAPERS[paper];
}

export type ShelfCard = DeliverableCardView & {
  /** 'Report · Today', in the label style's capitals. */
  readonly eyebrow: string;
};

export type ShelfView = {
  /** A3's pills: All, then each type the gallery has shown. */
  readonly pills: readonly TypePillView[];
  /** The first card of the chosen filter, lit; null with none. */
  readonly newest: ShelfCard | null;
  /** The rest, in the server's order (newest first), two to a row. */
  readonly grid: readonly ShelfCard[];
  /** '15 Deliverables' from the server's total; null without one. */
  readonly count: string | null;
  readonly empty: EmptyCopy | null;
  readonly canLoadMore: boolean;
};

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 'Today', 'Yesterday', 'Mon', '9 Oct'; '' when the date is missing or unreadable. */
export function shelfDate(createdAt: string | null | undefined, clock: Clock): string {
  const date = parseDate(createdAt);
  if (!date) return '';
  return sectionOf(date, clock) === 'today' ? PLAY_SHELF_COPY.today : relativeTime(date, clock);
}

/** 'Report · Today'; the type alone when the day is unknown; who made it after, on the page. */
export function shelfEyebrow(...parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(PLAY_SHELF_COPY.joiner);
}

/** '1 Deliverable', '15 Deliverables'; null without a total. */
export function shelfCountLine(total: number | null | undefined): string | null {
  if (total === null || total === undefined || !Number.isFinite(total) || total < 0) return null;
  return countPhrase(Math.floor(total), PLAY_SHELF_COPY.count);
}

/** The newest piece's spoken label: 'Newest' before A3's sentence for the card. */
export function newestLabel(card: Pick<DeliverableCardView, 'accessibilityLabel'>): string {
  return joinLabel(PLAY_SHELF_COPY.newest, card.accessibilityLabel);
}

export type ShelfInput = {
  /** A3's gallery for the chosen filter (gallery.ts galleryView). */
  readonly gallery: GalleryView;
  /** The chosen filter's pages: each card's day and the server's total. */
  readonly pages: readonly DeliverablePage[] | null;
  readonly clock: Clock;
};

/** A3's gallery for the chosen filter as Ember's wall: the newest lit, the rest in the grid. */
export function shelfView({ gallery, pages, clock }: ShelfInput): ShelfView {
  const made = new Map(mergePages(pages ?? []).map((row) => [row.id, row.created_at] as const));
  const cards = gallery.cards.map((card) => ({
    ...card,
    eyebrow: shelfEyebrow(card.typeWord, shelfDate(made.get(card.id), clock)),
  }));
  const [newest = null, ...grid] = cards;
  return {
    pills: gallery.pills,
    newest,
    grid,
    count: shelfCountLine(pages?.at(-1)?.total),
    empty: gallery.empty,
    canLoadMore: gallery.canLoadMore,
  };
}

/** The grid as rows of two (the last may hold one), keyed by their first card. */
export function shelfRows(cards: readonly ShelfCard[]): readonly (readonly ShelfCard[])[] {
  const { columns } = SHELF.grid;
  return Array.from({ length: Math.ceil(cards.length / columns) }, (_, row) =>
    cards.slice(row * columns, row * columns + columns),
  );
}

type PageFacts = Pick<DeliverableRow, 'created_at' | 'agent_name' | 'source_type'> & {
  readonly typeWord: string;
  /** A3's 'Run failed' on a failed run's report: said on the sheet in words. */
  readonly failed?: string | null;
};

/** A Deliverable's page eyebrow (Ember 05): 'Report · Today · Scout', then 'Run failed'. */
export function deliverableEyebrow(facts: PageFacts, clock: Clock): string {
  const made = shelfDate(facts.created_at, clock);
  return shelfEyebrow(facts.typeWord, made, madeBy(facts), facts.failed);
}

function bare(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0].trim();
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** The Shelf and a Deliverable draw their own header in Play: the shell steps aside on them. */
export function shelfOwnsScreen(pathname: string): boolean {
  const path = bare(pathname);
  const shelf = routes.cc.deliverables;
  return path === shelf || (path.startsWith(`${shelf}/`) && path.length > shelf.length + 1);
}

/** expo-linear-gradient's start and end for a CSS angle (0° up, 90° right) across a box. */
export function gradientPoints(degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  const dx = Math.sin(radians) / 2;
  const dy = -Math.cos(radians) / 2;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    start: { x: round(0.5 - dx), y: round(0.5 - dy) },
    end: { x: round(0.5 + dx), y: round(0.5 + dy) },
  };
}
