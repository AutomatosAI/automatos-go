// The Inventory (inventory.ts; the kit's deliverables/inventory.ts and bag.tsx; D-ARC-6): the
// tabs as the gallery's type filters (ALL, REPORTS, DOCUMENTS, IMAGES; no POSTS, the app is offered
// no Socials), each slot's kind word and icon from the Deliverable's kind, its day on the phone's
// calendar, the info line, the bag from A3's pages (loading, failed, the items once each, the
// count), the slot the ▶ cursor is on, two to a row, OPEN the Deliverable and ALL DELIVERABLES the
// Command Centre's page.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { DeliverablePage } from '../../../../cc/deliverables/gallery';
import { DeliverableListSchema, type DeliverableRow } from '../../../../cc/deliverables/schemas';
import { AA_TEXT, contrastRatio } from '../../../../core/web/lib/look-kit/contrast';
import { routes } from '../../../../navigation/routes';
import { ARCADE_INVENTORY_COPY } from '../../../strings';
import { PALETTES } from '../../../tokens/arcade-catalogue';
import {
  BAG_COLUMNS,
  INVENTORY_ALL_ROUTE,
  INVENTORY_TABS,
  bagRows,
  bagView,
  infoLine,
  inventoryItem,
  itemDay,
  itemKind,
  itemRoute,
  kindWord,
  selectedItem,
  tabFilter,
  type InventoryItem,
} from '../inventory';

const LONDON = 'Europe/London';
const NOW = new Date('2026-10-30T12:00:00Z');
const CLOCK = { now: NOW, timeZone: LONDON };

type Fixture = {
  readonly n: number;
  readonly title?: string;
  readonly type?: string | null;
  readonly source?: string | null;
  readonly at?: string | null;
};

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Rows as the Deliverables list parses them.
function rows(...fixtures: readonly Fixture[]): DeliverableRow[] {
  const deliverables = fixtures.map((each) => ({
    id: uuid(each.n),
    title: each.title ?? `Deliverable ${each.n}`,
    artifact_type: each.type === undefined ? 'report' : each.type,
    source_type: each.source ?? 'chat',
    agent_name: 'Scout',
    created_at: each.at === undefined ? '2026-10-30T08:06:00Z' : each.at,
    status: 'ready',
  }));
  return DeliverableListSchema.parse({ deliverables, total: null }).deliverables;
}

function page(
  offset: number,
  total: number | null,
  ...fixtures: readonly Fixture[]
): DeliverablePage {
  return { offset, deliverables: rows(...fixtures), total };
}

const row = (fixture: Fixture) => rows(fixture)[0];

describe('the tabs (the gallery’s type filters)', () => {
  it('are ALL, REPORTS, DOCUMENTS and IMAGES, in the kit’s order, with no POSTS', () => {
    expect(INVENTORY_TABS.map((tab) => tab.id)).toEqual(['all', 'reports', 'documents', 'images']);
    expect(INVENTORY_TABS.map((tab) => tab.label)).toEqual([
      'All',
      'Reports',
      'Documents',
      'Images',
    ]);
  });

  it('hand the gallery its type filter: none for All, the artifact type for the rest', () => {
    expect(INVENTORY_TABS.map((tab) => tab.filter)).toEqual([null, 'report', 'document', 'image']);
    expect(tabFilter('all')).toBeNull();
    expect(tabFilter('reports')).toBe('report');
    expect(tabFilter('documents')).toBe('document');
    expect(tabFilter('images')).toBe('image');
  });
});

describe('a slot’s kind', () => {
  it('draws a report for a report or a blog post, an image for a picture or a video', () => {
    expect(itemKind(row({ n: 1, type: 'report' }))).toBe('report');
    expect(itemKind(row({ n: 1, type: 'blog_post' }))).toBe('report');
    expect(itemKind(row({ n: 1, type: 'image' }))).toBe('image');
    expect(itemKind(row({ n: 1, type: ' Video ' }))).toBe('image');
  });

  it('draws a document for every other type, or none', () => {
    ['document', 'spreadsheet', 'code', 'slide_deck', null].forEach((type) =>
      expect(itemKind(row({ n: 1, type }))).toBe('document'),
    );
  });

  it('draws a post for what a social post made, whatever its type', () => {
    expect(itemKind(row({ n: 1, type: 'report', source: 'social_post' }))).toBe('post');
  });

  it('says it in A3’s word, Post for a social post and File for no type', () => {
    expect(kindWord(row({ n: 1, type: 'report' }))).toBe('Report');
    expect(kindWord(row({ n: 1, type: 'blog_post' }))).toBe('Blog post');
    expect(kindWord(row({ n: 1, type: 'spreadsheet' }))).toBe('Spreadsheet');
    expect(kindWord(row({ n: 1, type: 'slide_deck' }))).toBe('Slide deck');
    expect(kindWord(row({ n: 1, type: null }))).toBe('File');
    expect(kindWord(row({ n: 1, type: 'image', source: 'social_post' }))).toBe('Post');
  });
});

describe('a slot’s day, on the phone’s calendar', () => {
  it('is Today, Yesterday, else the day and month', () => {
    expect(itemDay('2026-10-30T00:30:00Z', CLOCK)).toBe('Today');
    expect(itemDay('2026-10-29T20:00:00Z', CLOCK)).toBe('Yesterday');
    expect(itemDay('2026-10-26T10:00:00Z', CLOCK)).toBe('26 Oct');
  });

  it('never calls a day a year ago Today', () => {
    expect(itemDay('2025-10-30T10:00:00Z', CLOCK)).toBe('30 Oct');
  });

  it('reads the day in the phone’s timezone', () => {
    const late = new Date('2026-10-30T23:30:00Z'); // 31 Oct 08:30 in Tokyo
    expect(itemDay('2026-10-30T14:00:00Z', { now: late, timeZone: LONDON })).toBe('Today');
    expect(itemDay('2026-10-30T14:00:00Z', { now: late, timeZone: 'Asia/Tokyo' })).toBe(
      'Yesterday',
    );
  });

  it('says nothing for no time or one that does not parse', () => {
    expect(itemDay(null, CLOCK)).toBe('');
    expect(itemDay(undefined, CLOCK)).toBe('');
    expect(itemDay('not a date', CLOCK)).toBe('');
  });
});

describe('an item and the info line', () => {
  it('names the slot for VoiceOver by its title, kind and day', () => {
    const item = inventoryItem(row({ n: 7, title: ' Laptop shortlist ' }), CLOCK);
    expect(item).toEqual({
      id: uuid(7),
      kind: 'report',
      word: 'Report',
      title: 'Laptop shortlist',
      day: 'Today',
      label: 'Laptop shortlist, Report, Today',
    });
  });

  it('gives a blank title A3’s word and leaves an unknown day out', () => {
    const item = inventoryItem(row({ n: 1, title: '  ', type: 'document', at: null }), CLOCK);
    expect(item.title).toBe('Untitled');
    expect(item.label).toBe('Untitled, Document');
    expect(infoLine(item)).toBe('Untitled · Document');
  });

  it('names the selected item in the info window, and an empty bag in its words', () => {
    const item = inventoryItem(row({ n: 1, title: 'Laptop shortlist' }), CLOCK);
    expect(infoLine(item)).toBe('Laptop shortlist · Report · Today');
    expect(infoLine(null)).toBe('Nothing in the bag yet.');
  });
});

describe('the bag (A3’s Deliverables read)', () => {
  it('is loading until the first page answers, and failed when it cannot', () => {
    expect(bagView({ pages: null, failed: false, clock: CLOCK })).toEqual({ status: 'loading' });
    expect(bagView({ pages: [], failed: false, clock: CLOCK })).toEqual({ status: 'loading' });
    expect(bagView({ pages: null, failed: true, clock: CLOCK })).toEqual({ status: 'failed' });
  });

  it('keeps what it has when a later page fails', () => {
    const view = bagView({ pages: [page(0, 30, { n: 1 })], failed: true, clock: CLOCK });
    expect(view.status).toBe('ready');
  });

  it('lists the pages newest first as the server does, each item once, with the server’s count', () => {
    const pages = [page(0, 4, { n: 3 }, { n: 2 }), page(2, 4, { n: 2 }, { n: 1 })];
    const view = bagView({ pages, failed: false, clock: CLOCK });
    if (view.status !== 'ready') throw new Error('the bag should be ready');
    expect(view.items.map((item) => item.id)).toEqual([uuid(3), uuid(2), uuid(1)]);
    expect(view.count).toBe('4 items · newest first');
  });

  it('counts what it loaded when an older server sends no total, and says 1 item', () => {
    const view = bagView({ pages: [page(0, null, { n: 1 })], failed: false, clock: CLOCK });
    if (view.status !== 'ready') throw new Error('the bag should be ready');
    expect(view.count).toBe('1 item · newest first');
  });

  it('is an empty bag once a tab answers with nothing', () => {
    const view = bagView({ pages: [page(0, 0)], failed: false, clock: CLOCK });
    expect(view).toEqual({ status: 'ready', items: [], count: '0 items · newest first' });
  });
});

describe('the ▶ cursor and the grid', () => {
  const items: readonly InventoryItem[] = rows(
    { n: 1 },
    { n: 2 },
    { n: 3 },
    { n: 4 },
    { n: 5 },
  ).map((each) => inventoryItem(each, CLOCK));

  it('is on the item picked while it is in the bag, else on the newest', () => {
    expect(selectedItem(items, uuid(3))?.id).toBe(uuid(3));
    expect(selectedItem(items, uuid(9))?.id).toBe(uuid(1));
    expect(selectedItem(items, null)?.id).toBe(uuid(1));
    expect(selectedItem([], null)).toBeNull();
  });

  it('lays the slots two to a row, the last row holding what is left', () => {
    expect(BAG_COLUMNS).toBe(2);
    expect(bagRows(items).map((each) => each.map((item) => item.id))).toEqual([
      [uuid(1), uuid(2)],
      [uuid(3), uuid(4)],
      [uuid(5)],
    ]);
    expect(bagRows([])).toEqual([]);
  });
});

describe('where the bag goes', () => {
  it('OPEN is the Deliverable’s own screen, ALL DELIVERABLES the Command Centre’s page', () => {
    expect(itemRoute({ id: uuid(7) })).toBe(routes.cc.deliverable(uuid(7)));
    expect(INVENTORY_ALL_ROUTE).toBe(routes.cc.deliverables);
  });
});

describe('the bag’s words and paint', () => {
  it('says the kit’s words for an empty, loading and failed bag', () => {
    expect(ARCADE_INVENTORY_COPY.emptyTitle).toBe('Your bag is empty.');
    expect(ARCADE_INVENTORY_COPY.emptyLine).toBe('Ask Auto for something and it lands here.');
    expect(ARCADE_INVENTORY_COPY.loading).toBe('Opening your bag…');
    expect(ARCADE_INVENTORY_COPY.loadFailed).toBe("Couldn't open your bag.");
    expect(ARCADE_INVENTORY_COPY.goToChat).toBe('Go to chat');
  });

  it.each(PALETTES.map((palette) => [palette.id, palette] as const))(
    'reads at AA on %s: a slot on the page, the selected one in the highlight',
    (_id, palette) => {
      const colours = palette.colours;
      [colours.tx, colours.tx2].forEach((ink) =>
        expect(contrastRatio(ink, colours.page)).toBeGreaterThanOrEqual(AA_TEXT),
      );
      [colours.tx, colours.ac].forEach((ink) =>
        expect(contrastRatio(ink, colours.win)).toBeGreaterThanOrEqual(AA_TEXT),
      );
      expect(contrastRatio(colours.hlt, colours.hl)).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it('inventory.ts imports no React, React Native, Expo or Skia (D-SHAPE)', () => {
    const source = readFileSync(path.resolve(__dirname, '..', 'inventory.ts'), 'utf8');
    expect(source).not.toMatch(/from '(react|react-native[^']*|expo[^']*|@shopify\/[^']*)'/);
  });
});
