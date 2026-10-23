import { describe, expect, it } from 'vitest';

import { routes } from '../../navigation/routes';
import {
  deliverableCard,
  emptyCopy,
  EXCERPT_MAX_CHARS,
  excerptOf,
  GALLERY_PAGE_SIZE,
  galleryView,
  madeBy,
  mergePages,
  nextOffset,
  typePills,
  withTypes,
  type DeliverablePage,
} from '../deliverables/gallery';
import type { DeliverableRow } from '../deliverables/schemas';
import { kindOf, sortTypes, typePlural, typeWord } from '../deliverables/types';
import { DELIVERABLES_COPY } from '../strings';

// US-013a: the gallery, pure (gallery.ts, types.ts): paging, the merge, the filters, the card.
const ID_1 = '0b6f1c2e-1111-4a1b-8c1d-000000000001';
const ID_2 = '0b6f1c2e-2222-4a1b-8c1d-000000000002';
const ID_3 = '0b6f1c2e-3333-4a1b-8c1d-000000000003';
/** 08:00 in London on Fri 23 Oct 2026 (BST, UTC+1). */
const NOW = new Date('2026-10-23T07:00:00Z');
const CLOCK = { now: NOW, timeZone: 'Europe/London' };
const SUMMARY = 'Four of six competitors **raised** entry-tier prices.\n\nTwo added usage caps.';

function row(overrides: Partial<DeliverableRow> = {}): DeliverableRow {
  return {
    id: ID_1,
    artifact_type: 'report',
    source_type: 'task',
    agent_name: 'Scout',
    title: 'Competitor pricing',
    summary: 'Four of six raised prices.',
    preview_url: null,
    created_at: '2026-10-23T06:06:00+00:00',
    status: 'ready',
    ...overrides,
  };
}

function page(
  offset: number,
  rows: readonly DeliverableRow[],
  total: number | null,
): DeliverablePage {
  return { offset, deliverables: rows, total };
}

describe('paging and the merge', () => {
  it('stops at the total, after a short page without one, and on an empty page', () => {
    expect(nextOffset(page(0, [row(), row({ id: ID_2 })], 5))).toBe(2);
    expect(nextOffset(page(3, [row(), row({ id: ID_2 })], 5))).toBeNull();
    const fullPage = Array.from({ length: GALLERY_PAGE_SIZE }, (_, i) => row({ id: `${i}` }));
    expect(nextOffset(page(0, fullPage, null))).toBe(GALLERY_PAGE_SIZE);
    expect(nextOffset(page(0, [row()], null))).toBeNull();
    expect(nextOffset(page(24, [], 90))).toBeNull();
  });

  it('merges the pages newest first and shows a row the list moved onto the next page once', () => {
    const first = page(0, [row({ id: ID_1 }), row({ id: ID_2 })], 3);
    // a new Deliverable landed: the next offset repeats ID_2
    const second = page(2, [row({ id: ID_2, title: 'again' }), row({ id: ID_3 })], 4);
    const merged = mergePages([first, second]);
    expect(merged.map((each) => each.id)).toEqual([ID_1, ID_2, ID_3]);
    expect(merged[1].title).toBe('Competitor pricing');
  });
});

describe('the type filters', () => {
  it('words a type for its card and its filter, and keeps an unknown type’s own words', () => {
    expect(typeWord('report')).toBe('Report');
    expect(typeWord('blog_post')).toBe('Blog post');
    expect(typeWord('slide_deck')).toBe('Slide deck');
    expect(typeWord(' ')).toBeNull();
    expect(typeWord(null)).toBeNull();
    expect(typePlural('spreadsheet')).toBe('Spreadsheets');
    expect(typePlural('slide_deck')).toBe('Slide deck');
    expect(kindOf('video')).toBe('video');
    expect(kindOf('slide_deck')).toBe('file');
    expect(kindOf(null)).toBe('file');
  });

  it('lines the types up in the web’s order, then the rest A to Z, each once', () => {
    expect(sortTypes(['zine', 'video', 'report', 'audio', 'image', 'report', '', 'memo'])).toEqual([
      'report',
      'image',
      'video',
      'audio',
      'memo',
      'zine',
    ]);
  });

  it('remembers the types the pages have shown, and is the same list when they add none', () => {
    const known = withTypes(
      [],
      [row({ artifact_type: 'image' }), row({ artifact_type: 'report' })],
    );
    expect(known).toEqual(['report', 'image']);
    expect(withTypes(known, [row({ artifact_type: 'image' }), row({ artifact_type: null })])).toBe(
      known,
    );
    expect(withTypes(known, [row({ artifact_type: 'code' })])).toEqual(['report', 'image', 'code']);
  });

  it('offers All, then each known type; the chosen one stays offered', () => {
    expect(typePills(['image', 'report'], null)).toEqual([
      { key: 'all', filter: null, label: DELIVERABLES_COPY.all, selected: true },
      { key: 'type:report', filter: 'report', label: 'Reports', selected: false },
      { key: 'type:image', filter: 'image', label: 'Images', selected: false },
    ]);
    const pills = typePills(['report'], 'slide_deck');
    expect(pills.map((pill) => [pill.label, pill.selected])).toEqual([
      ['All', false],
      ['Reports', false],
      ['Slide deck', true],
    ]);
  });
});

describe('the card', () => {
  it('shows the type, the title, the excerpt and who made it when, and opens the Deliverable', () => {
    const card = deliverableCard(row(), CLOCK);
    expect(card).toEqual({
      id: ID_1,
      href: routes.cc.deliverable(ID_1),
      kind: 'report',
      typeWord: 'Report',
      title: 'Competitor pricing',
      excerpt: 'Four of six raised prices.',
      meta: 'Scout · 07:06',
      failed: null,
      accessibilityLabel: 'Report, Competitor pricing, Four of six raised prices., Scout, 07:06',
    });
  });

  it('carries no review state, no made-up id and no verdict', () => {
    const card = deliverableCard(row({ status: 'ready' }), CLOCK);
    expect(Object.keys(card).sort()).toEqual([
      'accessibilityLabel',
      'excerpt',
      'failed',
      'href',
      'id',
      'kind',
      'meta',
      'title',
      'typeWord',
    ]);
    expect(JSON.stringify(card)).not.toMatch(/DLV-|Approve|Request changes|Review/);
  });

  it('marks a failed run’s report with a word, and keeps any other status quiet', () => {
    expect(deliverableCard(row({ status: 'failed' }), CLOCK).failed).toBe(
      DELIVERABLES_COPY.failedRun,
    );
    expect(deliverableCard(row({ status: 'archived' }), CLOCK).failed).toBeNull();
    expect(deliverableCard(row({ status: 'failed' }), CLOCK).accessibilityLabel).toContain(
      DELIVERABLES_COPY.failedRun,
    );
  });

  it('falls back: no title, no type, no summary, no agent, no time', () => {
    const card = deliverableCard(
      row({
        title: '  ',
        artifact_type: null,
        summary: null,
        agent_name: null,
        source_type: 'upload',
        created_at: null,
      }),
      CLOCK,
    );
    expect(card).toMatchObject({
      title: DELIVERABLES_COPY.untitled,
      typeWord: DELIVERABLES_COPY.file,
      kind: 'file',
      excerpt: null,
      meta: 'Uploaded',
    });
  });

  it('says who made it: the agent, else where it came from, else the web’s words', () => {
    expect(madeBy({ agent_name: ' Quill ', source_type: 'task' })).toBe('Quill');
    expect(madeBy({ agent_name: null, source_type: 'social_post' })).toBe('Socials');
    expect(madeBy({ agent_name: '', source_type: 'heartbeat' })).toBe('Routine');
    expect(madeBy({ agent_name: null, source_type: 'robot' })).toBe(DELIVERABLES_COPY.unknownAgent);
    expect(madeBy({ agent_name: null, source_type: null })).toBe(DELIVERABLES_COPY.unknownAgent);
  });

  it('dates an older one the way the ticket sheet does', () => {
    expect(deliverableCard(row({ created_at: '2026-10-22T09:00:00Z' }), CLOCK).meta).toBe(
      'Scout · Yesterday',
    );
    expect(deliverableCard(row({ created_at: '2026-10-01T09:00:00Z' }), CLOCK).meta).toBe(
      'Scout · 1 Oct',
    );
  });

  it('takes the marks out of the summary and cuts a long one at a word', () => {
    expect(excerptOf(SUMMARY)).toBe(
      'Four of six competitors raised entry-tier prices. Two added usage caps.',
    );
    const long = `${'word '.repeat(60)}end`;
    const cut = excerptOf(long) ?? '';
    expect(cut.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS + 1);
    expect(cut.endsWith('word…')).toBe(true);
    expect(excerptOf('   ')).toBeNull();
  });
});

describe('the gallery view', () => {
  it('shows nothing and no empty copy before the filter has answered', () => {
    const view = galleryView({ pages: null, chosen: null, known: [], clock: CLOCK });
    expect(view.cards).toEqual([]);
    expect(view.empty).toBeNull();
    expect(view.canLoadMore).toBe(false);
    expect(view.pills.map((pill) => pill.label)).toEqual(['All']);
  });

  it('says a filter is empty in its own words', () => {
    const view = galleryView({ pages: [page(0, [], 0)], chosen: 'image', known: [], clock: CLOCK });
    expect(view.empty).toEqual(emptyCopy('image'));
    expect(view.empty?.title).toBe('No images yet');
    expect(emptyCopy(null)).toEqual(DELIVERABLES_COPY.empty);
  });

  it('offers Load more while the last page is not the end', () => {
    const first = page(0, [row({ id: ID_1 }), row({ id: ID_2 })], 3);
    const open = galleryView({ pages: [first], chosen: null, known: ['report'], clock: CLOCK });
    expect(open.cards.map((card) => card.id)).toEqual([ID_1, ID_2]);
    expect(open.canLoadMore).toBe(true);
    const done = galleryView({
      pages: [first, page(2, [row({ id: ID_3 })], 3)],
      chosen: null,
      known: ['report'],
      clock: CLOCK,
    });
    expect(done.cards).toHaveLength(3);
    expect(done.canLoadMore).toBe(false);
  });
});
