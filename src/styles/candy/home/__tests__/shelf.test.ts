// P3 Shelf (US-023i; shelf.ts), pure: the type chips as the gallery's type filters (no search),
// each tile from A3's row (its kind's gradient, the type's initial in the set's b stop, the title,
// '{type} · {day}' and what VoiceOver hears, the Deliverable's own screen), the tiles from the
// gallery's pages (newest first, each once), two to a row, what an empty filter says, and All
// Deliverables the Command Centre's page.

import { describe, expect, it } from 'vitest';

import type { DeliverablePage } from '../../../../cc/deliverables/gallery';
import { DeliverableListSchema, type DeliverableRow } from '../../../../cc/deliverables/schemas';
import { DELIVERABLES_COPY } from '../../../../cc/strings';
import { AA_TEXT, contrastRatio } from '../../../../core/web/lib/look-kit/contrast';
import { routes } from '../../../../navigation/routes';
import { CANDY_CARDS, candyVars } from '../../../tokens/candy';
import { PALETTE_IDS } from '../../../tokens/candy-catalogue';
import { CANDY_SHELF_COPY } from '../../strings';
import {
  SHELF,
  SHELF_ALL_ROUTE,
  SHELF_CHIPS,
  SHELF_COLUMNS,
  chipFilter,
  shelfEmpty,
  shelfRows,
  shelfTile,
  shelfTiles,
  type ShelfTile,
} from '../shelf';

// A Saturday morning, local time: the phone's calendar names the days.
const NOW = new Date(2026, 9, 31, 10, 30).getTime();
const daysAgo = (days: number) => new Date(2026, 9, 31 - days, 9, 0).toISOString();

type Fixture = {
  readonly n: number;
  readonly title?: string;
  readonly type?: string | null;
  readonly at?: string | null;
};

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Rows as the Deliverables list parses them.
function rows(...fixtures: readonly Fixture[]): DeliverableRow[] {
  const deliverables = fixtures.map((each) => ({
    id: uuid(each.n),
    title: each.title ?? `Deliverable ${each.n}`,
    artifact_type: each.type === undefined ? 'report' : each.type,
    source_type: 'chat',
    agent_name: 'Iris',
    created_at: each.at === undefined ? daysAgo(0) : each.at,
    status: 'ready',
  }));
  return DeliverableListSchema.parse({ deliverables, total: null }).deliverables;
}

const row = (fixture: Fixture) => rows(fixture)[0];

function page(offset: number, total: number | null, ...fixtures: readonly Fixture[]): DeliverablePage {
  return { offset, deliverables: rows(...fixtures), total };
}

describe('the type chips (the gallery’s type filters)', () => {
  it('are All, Reports, Documents, Images, Spreadsheets and Slides, in the design’s order', () => {
    expect(SHELF_CHIPS.map((chip) => chip.label)).toEqual([
      'All',
      'Reports',
      'Documents',
      'Images',
      'Spreadsheets',
      'Slides',
    ]);
  });

  it('each filter the gallery by its type, All by none', () => {
    expect(SHELF_CHIPS.map((chip) => chip.filter)).toEqual([
      null,
      'report',
      'document',
      'image',
      'spreadsheet',
      'slide',
    ]);
    expect(chipFilter('all')).toBeNull();
    expect(chipFilter('slides')).toBe('slide');
    expect(chipFilter('spreadsheets')).toBe('spreadsheet');
  });

  it('offer no search (the gallery’s query has none)', () => {
    expect(Object.keys(CANDY_SHELF_COPY)).not.toContain('search');
  });
});

describe('a tile', () => {
  it('is the design’s Q3 brand report: its gradient, initial, line and label', () => {
    const tile = shelfTile(row({ n: 1, title: 'Q3 brand report', type: 'report' }), NOW);
    expect(tile).toMatchObject({
      id: uuid(1),
      href: routes.cc.deliverable(uuid(1)),
      set: 1,
      initial: 'R',
      initialInk: 'g1b',
      title: 'Q3 brand report',
      line: 'Report · Today',
      label: 'Q3 brand report, Report, Today',
    });
    expect(Object.isFrozen(tile)).toBe(true);
  });

  it.each([
    ['report', 1, 'R', 'Report'],
    ['slide', 1, 'S', 'Slides'],
    ['document', 2, 'D', 'Document'],
    ['spreadsheet', 2, 'S', 'Spreadsheet'],
    ['image', 3, 'I', 'Image'],
    ['blog_post', 3, 'B', 'Blog post'],
    ['video', 1, 'V', 'Video'],
  ] as const)('a %s wears set %i with %s, in A3’s word %s', (type, set, initial, word) => {
    const tile = shelfTile(row({ n: 2, type }), NOW);
    expect(tile.set).toBe(set);
    expect(tile.initial).toBe(initial);
    expect(tile.initialInk).toBe(`g${set}b`);
    expect(tile.line).toBe(`${word} · Today`);
  });

  it('names the day on the phone’s calendar (when.ts dayWords)', () => {
    expect(shelfTile(row({ n: 3, at: daysAgo(1) }), NOW).line).toBe('Report · Yesterday');
    expect(shelfTile(row({ n: 3, at: daysAgo(5) }), NOW).line).toBe('Report · Mon');
    expect(shelfTile(row({ n: 3, at: daysAgo(7) }), NOW).line).toBe('Report · Oct 24');
  });

  it('leaves the day out when the server sent no readable time', () => {
    const none = shelfTile(row({ n: 4, title: 'Notes', at: null }), NOW);
    expect(none.line).toBe('Report');
    expect(none.label).toBe('Notes, Report');
    expect(shelfTile(row({ n: 4, at: 'not a time' }), NOW).line).toBe('Report');
  });

  it('is a File under A3’s words for a blank type, and Untitled for a blank title', () => {
    const blank = shelfTile(row({ n: 5, title: '  ', type: null }), NOW);
    expect(blank.title).toBe(DELIVERABLES_COPY.untitled);
    expect(blank.line).toBe(`${DELIVERABLES_COPY.file} · Today`);
    expect(blank.initial).toBe('F');
    expect(blank.set).toBe(1);
  });

  it('keeps an unknown type in its own words (A3’s typeWord)', () => {
    const tile = shelfTile(row({ n: 6, type: 'case_study' }), NOW);
    expect(tile.line).toBe('Case study · Today');
    expect(tile.initial).toBe('C');
  });

  it('sets its initial in a b stop that holds 4.5:1 on the white circle, on every palette', () => {
    const inks = new Set<string>();
    PALETTE_IDS.forEach((palette) => {
      CANDY_CARDS.forEach((cards) => {
        const vars = candyVars({ palette, cards });
        ([1, 2, 3] as const).forEach((set) => {
          const ink = vars[`g${set}b`];
          inks.add(ink);
          expect(contrastRatio(ink, vars.cardInk)).toBeGreaterThanOrEqual(AA_TEXT);
        });
      });
    });
    expect(inks.size).toBeGreaterThan(0);
  });
});

describe('the tiles from the gallery’s pages', () => {
  it('are none before the first page answers', () => {
    expect(shelfTiles(null, NOW)).toEqual([]);
    expect(shelfTiles([], NOW)).toEqual([]);
  });

  it('are newest first, as the server lists them, a row a later page repeats shown once', () => {
    const pages = [page(0, 4, { n: 1 }, { n: 2 }), page(2, 4, { n: 2 }, { n: 3 })];
    expect(shelfTiles(pages, NOW).map((tile) => tile.id)).toEqual([uuid(1), uuid(2), uuid(3)]);
  });
});

describe('the grid', () => {
  const tiles = (count: number): ShelfTile[] =>
    Array.from({ length: count }, (_, index) => shelfTile(row({ n: index + 1 }), NOW));

  it('is two tiles to a row, the last row holding one when the count is odd', () => {
    expect(SHELF_COLUMNS).toBe(2);
    const grid = shelfRows(tiles(5));
    expect(grid.map((each) => each.length)).toEqual([2, 2, 1]);
    expect(grid[2][0].id).toBe(uuid(5));
    expect(shelfRows([])).toEqual([]);
  });

  it('has the design’s measures: tiles 168 tall, 12 apart, 7 inside, a 34 pt badge, the band 300', () => {
    expect(SHELF).toMatchObject({ band: 300, tile: 168, tileGap: 12, tilePad: 7, badge: 34 });
  });
});

describe('an empty filter, and the links', () => {
  it('is Candy’s empty shelf for All: the words and the way to the chat', () => {
    expect(shelfEmpty(null)).toEqual({
      title: 'Your shelf is empty.',
      message: 'Ask Auto for something and it lands here.',
      action: 'chat',
    });
  });

  it('is A3’s words for a type with none, with the way back to every type', () => {
    expect(shelfEmpty('spreadsheet')).toEqual({
      title: DELIVERABLES_COPY.emptyType('Spreadsheets'),
      message: DELIVERABLES_COPY.emptyTypeMessage,
      action: 'all',
    });
  });

  it('sends All Deliverables to the Command Centre’s page', () => {
    expect(SHELF_ALL_ROUTE).toBe(routes.cc.deliverables);
  });
});
