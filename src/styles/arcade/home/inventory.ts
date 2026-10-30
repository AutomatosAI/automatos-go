// The Inventory on the handheld (PRD-001 §4.6.1 D-ARC-6, US-022n; README 'Pages' /deliverables and
// the design kit's deliverables/inventory.ts and bag.tsx at 034fa629c), pure: the bag is A3's
// Deliverables read (src/cc/deliverables useGallery: the gallery's pages under one type filter,
// newest first, Studio's feed without heartbeats), so its tabs are that read's type filters: ALL,
// REPORTS, DOCUMENTS and IMAGES. The kit's POSTS tab (source_type social_post, shown only where the
// workspace is offered Socials) is left out: the phone's gallery filters by type alone and the app
// is offered no Socials. Each slot is its kind in A3's word ('Report', 'Blog post'; 'Post' for a
// social post, as the kit says), the kit's pixel icon for its kind (itemKind), its title and the day
// it was made on the phone's calendar ('Today', 'Yesterday', '26 Oct'); the info window names the
// selected one ('Laptop shortlist · Report · Today'). OPEN is the Deliverable's own screen, ALL
// DELIVERABLES the Command Centre's page. Pure: no React, React Native, Expo or Skia.

import {
  mergePages,
  type DeliverablePage,
  type GalleryFilter,
} from '../../../cc/deliverables/gallery';
import type { DeliverableRow } from '../../../cc/deliverables/schemas';
import { typeWord } from '../../../cc/deliverables/types';
import { wallClock, type WallClock } from '../../../cc/shell/dateline';
import { DELIVERABLES_COPY, SHELL_COPY } from '../../../cc/strings';
import { routes } from '../../../navigation/routes';
import { ARCADE_INVENTORY_COPY } from '../../strings';
import type { ItemKind } from '../sprite/agents-icons';

// ── The tabs ─────────────────────────────────────────────────────────────────────────────────

export type InventoryTabId = 'all' | 'reports' | 'documents' | 'images';

export type InventoryTab = {
  readonly id: InventoryTabId;
  readonly label: string;
  /** The gallery's type filter: an artifact type, or null for All. */
  readonly filter: GalleryFilter;
};

function tab(id: InventoryTabId, filter: GalleryFilter): InventoryTab {
  return Object.freeze({ id, label: ARCADE_INVENTORY_COPY.tabs[id], filter });
}

/** The kit's TABS but POSTS, in its order. */
export const INVENTORY_TABS: readonly InventoryTab[] = Object.freeze([
  tab('all', null),
  tab('reports', 'report'),
  tab('documents', 'document'),
  tab('images', 'image'),
]);

/** The tab's type filter for useGallery's choose. */
export function tabFilter(id: InventoryTabId): GalleryFilter {
  return INVENTORY_TABS.find((each) => each.id === id)?.filter ?? null;
}

// ── One item ─────────────────────────────────────────────────────────────────────────────────

/** The kit's SOCIAL_POST: a Deliverable a social post made. */
export const SOCIAL_POST = 'social_post';
const REPORT_TYPES: ReadonlySet<string> = new Set(['report', 'blog_post']);
const PICTURE_TYPES: ReadonlySet<string> = new Set(['image', 'video']);

type KindFacts = Pick<DeliverableRow, 'artifact_type' | 'source_type'>;

function isPost(row: KindFacts): boolean {
  return row.source_type?.trim().toLowerCase() === SOCIAL_POST;
}

/** Which icon: a post, a report (or blog post), an image (or video), else a document. */
export function itemKind(row: KindFacts): ItemKind {
  if (isPost(row)) return 'post';
  const type = row.artifact_type?.trim().toLowerCase() ?? '';
  if (REPORT_TYPES.has(type)) return 'report';
  return PICTURE_TYPES.has(type) ? 'image' : 'document';
}

/** The slot's kind word: 'Post' for a social post, else A3's word for its type ('File' for none). */
export function kindWord(row: KindFacts): string {
  if (isPost(row)) return ARCADE_INVENTORY_COPY.post;
  return typeWord(row.artifact_type) ?? DELIVERABLES_COPY.file;
}

export type ItemClock = { readonly now: Date; readonly timeZone: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;
/** Today and Yesterday are only asked of a time this close to now (WallClock has no year). */
const NEAR_DAYS = 2;

function sameDay(a: WallClock, b: WallClock): boolean {
  return a.day === b.day && a.month === b.month;
}

/** 'Today', 'Yesterday', '26 Oct' on the phone's calendar; '' for no time or one that won't parse. */
export function itemDay(createdAt: string | null | undefined, clock: ItemClock): string {
  const moment = createdAt ? new Date(createdAt) : null;
  if (!moment || Number.isNaN(moment.getTime())) return '';
  const then = wallClock(moment, clock.timeZone);
  const elapsed = clock.now.getTime() - moment.getTime();
  if (Math.abs(elapsed) < NEAR_DAYS * DAY_MS) {
    if (sameDay(then, wallClock(clock.now, clock.timeZone))) return ARCADE_INVENTORY_COPY.today;
    const before = wallClock(new Date(clock.now.getTime() - DAY_MS), clock.timeZone);
    if (sameDay(then, before)) return ARCADE_INVENTORY_COPY.yesterday;
  }
  return `${then.day} ${SHELL_COPY.months[then.month]}`;
}

export type InventoryItem = {
  readonly id: string;
  readonly kind: ItemKind;
  /** 'Report'; the slot sets it in capitals. */
  readonly word: string;
  readonly title: string;
  /** 'Today'; '' when the server sent no readable time. */
  readonly day: string;
  /** What VoiceOver hears for the slot: 'Laptop shortlist, Report, Today'. */
  readonly label: string;
};

function present(...parts: readonly string[]): readonly string[] {
  return parts.filter((part) => part.length > 0);
}

export function inventoryItem(row: DeliverableRow, clock: ItemClock): InventoryItem {
  const title = row.title.trim() || DELIVERABLES_COPY.untitled;
  const word = kindWord(row);
  const day = itemDay(row.created_at, clock);
  return Object.freeze({
    id: row.id,
    kind: itemKind(row),
    word,
    title,
    day,
    label: present(title, word, day).join(', '),
  });
}

/** The info window's line: 'Laptop shortlist · Report · Today'; the day left out when unknown. */
export function infoLine(item: InventoryItem | null): string {
  if (item === null) return ARCADE_INVENTORY_COPY.emptyInfo;
  return present(item.title, item.word, item.day).join(' · ');
}

// ── The bag ──────────────────────────────────────────────────────────────────────────────────

export type BagView =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
      readonly status: 'ready';
      readonly items: readonly InventoryItem[];
      /** '9 items · newest first' from the server's total (the items loaded without one). */
      readonly count: string;
    };

export type BagSources = {
  /** The chosen tab's pages; null before its first page has answered. */
  readonly pages: readonly DeliverablePage[] | null;
  /** The read failed (with nothing loaded, the bag says so). */
  readonly failed: boolean;
  readonly clock: ItemClock;
};

/** The bag from the gallery's read: loading, failed with nothing loaded, or the items. */
export function bagView({ pages, failed, clock }: BagSources): BagView {
  if (pages === null || pages.length === 0) {
    return Object.freeze({ status: failed ? 'failed' : 'loading' });
  }
  const items = mergePages(pages).map((row) => inventoryItem(row, clock));
  const total = pages[pages.length - 1].total ?? items.length;
  return Object.freeze({
    status: 'ready',
    items: Object.freeze(items),
    count: ARCADE_INVENTORY_COPY.count(total),
  });
}

/** The item the ▶ cursor is on: the one picked while it is still in the bag, else the newest. */
export function selectedItem(
  items: readonly InventoryItem[],
  picked: string | null,
): InventoryItem | null {
  return items.find((item) => item.id === picked) ?? items[0] ?? null;
}

/** The phone's grid: two slots to a row (the kit's handheld), the last row may hold one. */
export const BAG_COLUMNS = 2;

export function bagRows(items: readonly InventoryItem[]): readonly (readonly InventoryItem[])[] {
  return Array.from({ length: Math.ceil(items.length / BAG_COLUMNS) }, (_, row) =>
    items.slice(row * BAG_COLUMNS, row * BAG_COLUMNS + BAG_COLUMNS),
  );
}

/** Where OPEN goes: the Deliverable's own screen. */
export function itemRoute(item: Pick<InventoryItem, 'id'>): string {
  return routes.cc.deliverable(item.id);
}

/** Where ALL DELIVERABLES goes: the Command Centre's Deliverables. */
export const INVENTORY_ALL_ROUTE: string = routes.cc.deliverables;
