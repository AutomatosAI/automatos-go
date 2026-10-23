// The Deliverables gallery, pure (D-DELIVERABLES, D25; Studio's feed, use-deliverables-api.ts): the
// list's query and its offset paging, the pages merged into one list without a row twice, the type
// filters (All, then each type the gallery has shown), the card a row becomes and what an empty
// filter says. A card is what DeliverableCard draws: the type's icon and word, the serif title, the
// summary's first words and who made it when. It carries no review state and no made-up id: a
// Deliverable is opened, never decided.

import { routes } from '../../navigation/routes';
import { joinLabel } from '../../ui/paint';
import { plainParagraphs } from '../questions/plain';
import { DELIVERABLES_COPY } from '../strings';
import { updatedWord } from '../ticket/updated';
import type { DeliverableRow } from './schemas';
import { kindOf, sortTypes, typePlural, typeWord, type DeliverableKind } from './types';

/** The web's page (use-deliverables-api.ts PAGE_SIZE). */
export const GALLERY_PAGE_SIZE = 24;
/** Studio's feed leaves heartbeats out: an agent's notes on itself, not work (FEED_DEFAULT_FILTERS). */
export const GALLERY_EXCLUDED_SOURCES = 'heartbeat';
/** A card's excerpt is cut near here, at a word. */
export const EXCERPT_MAX_CHARS = 180;
const CUT = '…';
/** A failed run's report (shown_status). */
const FAILED = 'failed';

/** An artifact type, or null for All. */
export type GalleryFilter = string | null;

/** What the list's key and its call carry besides the offset. */
export function galleryFilters(filter: GalleryFilter) {
  return {
    artifact_type: filter,
    source_type_exclude: GALLERY_EXCLUDED_SOURCES,
    limit: GALLERY_PAGE_SIZE,
  } as const;
}

/** ?limit&offset&artifact_type&source_type_exclude: a null type is left off the query. */
export function galleryParams(filter: GalleryFilter, offset: number) {
  return { ...galleryFilters(filter), offset };
}

/** One page as the gallery keeps it: the offset it was asked at, its rows, the server's total. */
export type DeliverablePage = {
  readonly offset: number;
  readonly deliverables: readonly DeliverableRow[];
  readonly total: number | null;
};

/**
 * The offset of the page after this one, or null at the end: past the total, or (an older server
 * without one) after a short page. An empty page ends the list whatever the total says.
 */
export function nextOffset(page: DeliverablePage): number | null {
  const count = page.deliverables.length;
  if (count === 0) return null;
  const fetched = page.offset + count;
  if (page.total !== null) return fetched < page.total ? fetched : null;
  return count >= GALLERY_PAGE_SIZE ? fetched : null;
}

/** The pages as one list, newest first: a row a later page repeats (the list moved) shows once. */
export function mergePages(pages: readonly DeliverablePage[]): DeliverableRow[] {
  const seen = new Set<string>();
  return pages
    .flatMap((page) => page.deliverables)
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
}

/** The types known so far with these rows' added; the same list when they add none. */
export function withTypes(
  known: readonly string[],
  rows: readonly DeliverableRow[],
): readonly string[] {
  const types = sortTypes([...known, ...rows.flatMap((row) => row.artifact_type ?? [])]);
  return types.length === known.length ? known : types;
}

export type TypePillView = {
  readonly key: string;
  readonly filter: GalleryFilter;
  readonly label: string;
  readonly selected: boolean;
};

/** All, then each type the gallery has shown (the chosen one always), in the web's order. */
export function typePills(known: readonly string[], chosen: GalleryFilter): TypePillView[] {
  const types = sortTypes(chosen === null ? known : [...known, chosen]);
  const all = { key: 'all', filter: null, label: DELIVERABLES_COPY.all, selected: chosen === null };
  return [
    all,
    ...types.map((type) => ({
      key: `type:${type}`,
      filter: type,
      label: typePlural(type),
      selected: type === chosen,
    })),
  ];
}

export type CardClock = { readonly now: Date; readonly timeZone: string | null };

export type DeliverableCardView = {
  readonly id: string;
  /** routes.cc.deliverable(id). */
  readonly href: string;
  readonly kind: DeliverableKind;
  /** 'Report'; the label face sets it in capitals. */
  readonly typeWord: string;
  readonly title: string;
  /** The summary as plain text, cut at a word; null when there is none. */
  readonly excerpt: string | null;
  /** 'Scout · 08:06': who made it (an agent, else where it came from) and when. */
  readonly meta: string;
  /** 'Run failed' for a failed run's report, else null. */
  readonly failed: string | null;
  /** The whole card in one sentence: VoiceOver reads a pressable card as one button. */
  readonly accessibilityLabel: string;
};

/** The summary's paragraphs on one line, cut at the last word that fits. */
export function excerptOf(summary: string | null | undefined): string | null {
  const text = plainParagraphs(summary).join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= EXCERPT_MAX_CHARS) return text;
  const head = text.slice(0, EXCERPT_MAX_CHARS);
  const space = head.lastIndexOf(' ');
  return `${(space > 0 ? head.slice(0, space) : head).replace(/[\s.,;:!?-]+$/, '')}${CUT}`;
}

/** The agent that made it, else where it came from, else the web's 'Unknown agent'. */
export function madeBy(row: Pick<DeliverableRow, 'agent_name' | 'source_type'>): string {
  const agent = row.agent_name?.trim();
  if (agent) return agent;
  const source = row.source_type?.trim() ?? '';
  return DELIVERABLES_COPY.madeBy[source] ?? DELIVERABLES_COPY.unknownAgent;
}

export function deliverableCard(row: DeliverableRow, clock: CardClock): DeliverableCardView {
  const type = typeWord(row.artifact_type) ?? DELIVERABLES_COPY.file;
  const title = row.title.trim() || DELIVERABLES_COPY.untitled;
  const excerpt = excerptOf(row.summary);
  const who = madeBy(row);
  const when = updatedWord(row.created_at, clock.now, clock.timeZone);
  const failed = row.status === FAILED ? DELIVERABLES_COPY.failedRun : null;
  return {
    id: row.id,
    href: routes.cc.deliverable(row.id),
    kind: kindOf(row.artifact_type),
    typeWord: type,
    title,
    excerpt,
    meta: when ? `${who} ${DELIVERABLES_COPY.separator} ${when}` : who,
    failed,
    accessibilityLabel: joinLabel(type, failed, title, excerpt, who, when),
  };
}

export type EmptyCopy = { readonly title: string; readonly message: string };

/** What an empty filter says: All has its own words, a type its own title. */
export function emptyCopy(filter: GalleryFilter): EmptyCopy {
  if (filter === null) return DELIVERABLES_COPY.empty;
  return {
    title: DELIVERABLES_COPY.emptyType(typePlural(filter)),
    message: DELIVERABLES_COPY.emptyTypeMessage,
  };
}

export type GalleryInput = {
  /** The chosen filter's pages; null before its first page has answered. */
  readonly pages: readonly DeliverablePage[] | null;
  readonly chosen: GalleryFilter;
  readonly known: readonly string[];
  readonly clock: CardClock;
};

export type GalleryView = {
  readonly pills: readonly TypePillView[];
  readonly cards: readonly DeliverableCardView[];
  /** The empty copy once the filter has answered with nothing, else null. */
  readonly empty: EmptyCopy | null;
  /** Another page is there to load. */
  readonly canLoadMore: boolean;
};

export function galleryView({ pages, chosen, known, clock }: GalleryInput): GalleryView {
  const cards = pages ? mergePages(pages).map((row) => deliverableCard(row, clock)) : [];
  const last = pages?.[pages.length - 1];
  return {
    pills: typePills(known, chosen),
    cards,
    empty: pages && cards.length === 0 ? emptyCopy(chosen) : null,
    canLoadMore: last ? nextOffset(last) !== null : false,
  };
}
