// Play's Shelf, a Deliverable's page and Conversations (US-017g) over A3's gallery and A2's history,
// each driven through their own pure modules: the newest lit and the rest two to a row, A3's pills
// from the types the pages showed, the badge, eyebrow and count words, where the Command Centre's
// shell steps aside, the landing's numbers, and A2's rows in Play's sections.

import { describe, expect, it } from 'vitest';

import {
  galleryView,
  withTypes,
  type DeliverablePage,
  type GalleryFilter,
} from '../../../cc/deliverables/gallery';
import type { DeliverableRow } from '../../../cc/deliverables/schemas';
import { DELIVERABLES_COPY } from '../../../cc/strings';
import { TYPE_STYLE_KEYS } from '../../../core/web/lib/looks/catalogue';
import { PRESETS } from '../../../core/web/lib/looks/presets';
import { historyState, mergePages as mergeHistory } from '../../../chat/history/history';
import { HistoryRowSchema, type HistoryRow } from '../../../chat/schemas';
import { routes } from '../../../navigation/routes';
import { COMPANION, conversationSections } from '../../play/companion/model';
import { PLAY_SHELF_COPY } from '../../strings';
import { MIN_TEXT_SIZE } from '../../type';
import { PLAY_DISPLAY_MIN, playDisplayAt } from '../../typeface/play-type';
import { styleType } from '../../typeface/scale';
import { chatsPlaceholder, playConversationOf, playConversationsOf } from '../play-chats';
import {
  SHELF,
  deliverableEyebrow,
  gradientPoints,
  newestLabel,
  paperSheet,
  paperTitle,
  shelfCountLine,
  shelfDate,
  shelfEyebrow,
  shelfOwnsScreen,
  shelfRows,
  shelfView,
} from '../play-shelf';

/** 08:00 in London on Fri 23 Oct 2026 (BST, UTC+1). */
const NOW = new Date('2026-10-23T07:00:00Z');
const CLOCK = { now: NOW, timeZone: 'Europe/London' };
const uuid = (n: number) => `0b6f1c2e-3333-4a1b-8c1d-${String(n).padStart(12, '0')}`;

function row(n: number, overrides: Partial<DeliverableRow> = {}): DeliverableRow {
  return {
    id: uuid(n),
    artifact_type: 'report',
    source_type: 'task',
    agent_name: 'Scout',
    title: `Piece ${n}`,
    summary: null,
    preview_url: null,
    created_at: '2026-10-23T06:06:00+00:00',
    status: 'ready',
    ...overrides,
  };
}

const page = (rows: readonly DeliverableRow[], total: number | null, offset = 0) =>
  ({ offset, deliverables: rows, total }) satisfies DeliverablePage;

function shelfOf(pages: readonly DeliverablePage[] | null, chosen: GalleryFilter = null) {
  const rows = (pages ?? []).flatMap((each) => each.deliverables);
  const known = withTypes([], rows);
  const gallery = galleryView({ pages, chosen, known, clock: CLOCK });
  return shelfView({ gallery, pages, clock: CLOCK });
}

const WALL = [
  row(1, { title: 'Laptop shortlist' }),
  row(2, {
    artifact_type: 'document',
    title: 'Chemistry plan',
    created_at: '2026-10-19T09:00:00Z',
  }),
  row(3, { artifact_type: 'image', title: 'Bake sale poster', created_at: '2026-10-19T08:00:00Z' }),
  row(4, { artifact_type: 'slide', title: 'Climate slides', created_at: '2026-10-04T10:00:00Z' }),
];

describe('the wall: the newest lit, the rest two to a row', () => {
  it('lights the first card of the filter and hangs the rest in the server’s order', () => {
    const view = shelfOf([page(WALL, 15)]);
    expect(view.newest?.title).toBe('Laptop shortlist');
    expect(view.grid.map((card) => card.title)).toEqual([
      'Chemistry plan',
      'Bake sale poster',
      'Climate slides',
    ]);
    expect(shelfRows(view.grid).map((pair) => pair.map((card) => card.title))).toEqual([
      ['Chemistry plan', 'Bake sale poster'],
      ['Climate slides'],
    ]);
  });

  it('keeps A3’s card: its route, sentence and the run’s failure in words', () => {
    const failed = row(5, { status: 'failed', title: 'Pricing run' });
    const { newest } = shelfOf([page([failed], 1)]);
    expect(newest?.href).toBe(routes.cc.deliverable(uuid(5)));
    expect(newest?.failed).toBe(DELIVERABLES_COPY.failedRun);
    expect(newestLabel(newest!)).toBe(`${PLAY_SHELF_COPY.newest}, ${newest!.accessibilityLabel}`);
  });

  it('shows one row once across pages, and nothing lit before the first page', () => {
    const view = shelfOf([page(WALL.slice(0, 2), 4), page(WALL.slice(1), 4, 2)]);
    expect([view.newest, ...view.grid].map((card) => card?.id)).toEqual(WALL.map((r) => r.id));
    const waiting = shelfOf(null);
    expect([waiting.newest, waiting.grid, waiting.empty, waiting.count]).toEqual([
      null,
      [],
      null,
      null,
    ]);
  });

  it('says A3’s empty words for an empty filter, and offers more only while there is more', () => {
    const empty = shelfOf([page([], 0)], 'image');
    expect(empty.newest).toBeNull();
    expect(empty.empty?.title).toBe(DELIVERABLES_COPY.emptyType('Images'));
    expect(shelfOf([page(WALL, 15)]).canLoadMore).toBe(true);
    expect(shelfOf([page(WALL, 4)]).canLoadMore).toBe(false);
  });
});

describe('the pills are A3’s, from the types the pages showed', () => {
  it('All, then each type in the web’s order, the chosen one selected', () => {
    const all = shelfOf([page(WALL, 4)]);
    expect(all.pills.map((pill) => [pill.label, pill.selected])).toEqual([
      [DELIVERABLES_COPY.all, true],
      ['Reports', false],
      ['Images', false],
      ['Documents', false],
      ['Slides', false],
    ]);
    const images = shelfOf([page([WALL[2]], 1)], 'image');
    expect(images.pills.filter((pill) => pill.selected).map((pill) => pill.filter)).toEqual([
      'image',
    ]);
  });
});

describe('the words: badge, eyebrow, count', () => {
  it('names the newest and each card’s type and day on the phone’s calendar', () => {
    const view = shelfOf([page(WALL, 15)]);
    expect(PLAY_SHELF_COPY.newest).toBe('Newest');
    expect([view.newest, ...view.grid].map((card) => card?.eyebrow)).toEqual([
      'Report · Today',
      'Document · Mon',
      'Image · Mon',
      'Slides · 4 Oct',
    ]);
  });

  it('reads Today and Yesterday by the zone’s midnight, and drops an unknown day', () => {
    expect(shelfDate('2026-10-22T23:30:00Z', CLOCK)).toBe('Today'); // 00:30 BST on the 23rd
    expect(shelfDate('2026-10-22T22:30:00Z', CLOCK)).toBe('Yesterday');
    expect(shelfDate('2025-12-01T10:00:00Z', CLOCK)).toBe('1 Dec 2025');
    expect(shelfDate('not a date', CLOCK)).toBe('');
    expect(shelfEyebrow('Report', '')).toBe('Report');
  });

  it('counts the server’s total, and says nothing without one', () => {
    expect(shelfOf([page(WALL, 15)]).count).toBe('15 Deliverables');
    expect(shelfCountLine(1)).toBe('1 Deliverable');
    expect(shelfCountLine(0)).toBe('0 Deliverables');
    expect(shelfOf([page(WALL, null)]).count).toBeNull();
  });

  it('a Deliverable’s page adds who made it, and a failed run in words', () => {
    const facts = { ...row(1), typeWord: 'Report' };
    expect(deliverableEyebrow(facts, CLOCK)).toBe('Report · Today · Scout');
    const unnamed = { ...facts, agent_name: null, failed: DELIVERABLES_COPY.failedRun };
    expect(deliverableEyebrow(unnamed, CLOCK)).toBe(
      `Report · Today · ${DELIVERABLES_COPY.madeBy.task ?? DELIVERABLES_COPY.unknownAgent} · Run failed`,
    );
  });
});

describe('where Play draws its own screen', () => {
  it('the Shelf and a Deliverable, never another Command Centre tab', () => {
    expect(shelfOwnsScreen(routes.cc.deliverables)).toBe(true);
    expect(shelfOwnsScreen(`${routes.cc.deliverables}/?x=1`)).toBe(true);
    expect(shelfOwnsScreen(routes.cc.deliverable(uuid(1)))).toBe(true);
    expect(shelfOwnsScreen(routes.cc.board)).toBe(false);
    expect(shelfOwnsScreen(routes.cc.calendar)).toBe(false);
    expect(shelfOwnsScreen(`${routes.cc.deliverables}-archive`)).toBe(false);
    expect(shelfOwnsScreen(routes.chats)).toBe(false);
  });

  it('turns a CSS angle into the gradient’s line', () => {
    expect(gradientPoints(180)).toEqual({ start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } });
    expect(gradientPoints(90)).toEqual({ start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } });
    expect(gradientPoints(160)).toEqual({
      start: { x: 0.329, y: 0.03 },
      end: { x: 0.671, y: 0.97 },
    });
  });

  it('a landing Deliverable drops 16 pt and overshoots to 1.04 over 420 ms', () => {
    expect(COMPANION.drop).toMatchObject({ distance: 16, overshoot: 1.04, durationMs: 420 });
  });
});

describe('the papers’ titles: Play’s type, never Instrument Serif under 19 pt', () => {
  const SERIF = 'InstrumentSerif-Italic';
  const PAPERS = [
    ['hero', 16],
    ['tile', 11],
  ] as const;
  const lookFace = (font: (typeof TYPE_STYLE_KEYS)[number]) =>
    styleType({ layout: 'play', font }).display('hero').fontFamily;

  it('sets the newest’s at 16 and a tile’s at 11, leading 1, the sheets unchanged', () => {
    expect(SHELF.heroPaper.title).toBe(16);
    expect(SHELF.tilePaper.title).toBe(11);
    for (const font of TYPE_STYLE_KEYS) {
      for (const [paper, size] of PAPERS) {
        expect(paperSheet(paper).title).toBe(size);
        expect(paperTitle(font, paper)).toMatchObject({ fontSize: size, lineHeight: size });
        expect(paperTitle(font, paper).fontSize).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
      }
    }
  });

  it('never draws either in Instrument Serif, at any preset or type look', () => {
    const fonts = new Set([...TYPE_STYLE_KEYS, ...PRESETS.map((look) => look.font)]);
    for (const font of fonts) {
      for (const [paper] of PAPERS) {
        expect({ font, paper, face: paperTitle(font, paper).fontFamily }).not.toMatchObject({
          face: SERIF,
        });
      }
    }
  });

  it('falls the Editorial look (Ember, Daylight) to Geist 600; the others keep their face', () => {
    expect(PRESETS.filter((look) => look.font === 'serif').map((look) => look.id)).toEqual([
      'ember',
      'daylight',
    ]);
    for (const [paper] of PAPERS) {
      expect(paperTitle('serif', paper).fontFamily).toBe('Geist-SemiBold');
      for (const font of TYPE_STYLE_KEYS.filter((key) => key !== 'serif')) {
        expect(paperTitle(font, paper).fontFamily).toBe(lookFace(font));
      }
    }
  });

  it('keeps the look’s display face at 19 and above, by the same rule as the type', () => {
    expect(PLAY_DISPLAY_MIN).toBe(19);
    expect(playDisplayAt('serif', 'cardSm', 18).fontFamily).toBe('Geist-SemiBold');
    for (const font of TYPE_STYLE_KEYS) {
      const type = styleType({ layout: 'play', font });
      for (const size of [PLAY_DISPLAY_MIN, 24, 44]) {
        expect(playDisplayAt(font, 'cardSm', size).fontFamily).toBe(lookFace(font));
      }
      expect(playDisplayAt(font, 'cardSm', type.display('cardSm').fontSize)).toEqual(
        type.display('cardSm'),
      );
    }
    expect(lookFace('serif')).toBe(SERIF);
  });

  it('holds a size asked under 11 at the floor', () => {
    expect(playDisplayAt('serif', 'cardSm', 8).fontSize).toBe(MIN_TEXT_SIZE);
    expect(playDisplayAt('serif', 'cardSm', 8).fontFamily).not.toBe(SERIF);
  });
});

const history = (fields: Record<string, unknown>): HistoryRow =>
  HistoryRowSchema.parse({
    id: 'chat-1',
    title: 'Laptop for uni',
    createdAt: '2026-10-20T09:00:00Z',
    updatedAt: '2026-10-23T06:58:00Z',
    lastMessagePreview: 'Three laptops make the cut',
    kind: 'user',
    ...fields,
  });

describe('Conversations over A2’s history', () => {
  const rows = [
    history({ id: 'chat-1' }),
    history({ id: 'chat-2', title: 'Revision plan', updatedAt: '2026-10-19T10:00:00Z' }),
    history({ id: 'chat-3', title: null, updatedAt: '2026-10-09T10:00:00Z' }),
    history({ id: 'chat-4', title: 'No date', updatedAt: null, createdAt: null }),
  ];

  it('A2’s rows fall into Today, This week and Earlier in A2’s order', () => {
    const sections = conversationSections(playConversationsOf(rows), CLOCK);
    expect(sections.map((section) => [section.title, section.data.map((r) => r.id)])).toEqual([
      ['Today', ['chat-1']],
      ['This week', ['chat-2']],
      ['Earlier', ['chat-3', 'chat-4']],
    ]);
    const [today, week, earlier] = sections;
    expect(today.data[0]).toMatchObject({ time: '2 min', preview: 'Three laptops make the cut' });
    expect(week.data[0].time).toBe('Mon');
    expect(earlier.data.map((r) => [r.title, r.time])).toEqual([
      ['New chat', '9 Oct'],
      ['No date', ''],
    ]);
  });

  it('A2’s preview carries no speaker and the history no report count', () => {
    expect(playConversationOf(history({}))).toMatchObject({
      preview: { text: 'Three laptops make the cut', from: null },
      reports: 0,
    });
    expect(playConversationOf(history({ lastMessagePreview: '  ' })).preview).toBeNull();
  });

  it('A2’s merged pages (each id once) are the list; its states stand in for the rows', () => {
    const merged = mergeHistory([rows.slice(0, 2), rows.slice(1)], 2);
    expect(playConversationsOf(merged.rows).map((c) => c.id)).toEqual([
      'chat-1',
      'chat-2',
      'chat-3',
      'chat-4',
    ]);
    const loaded = historyState({ list: merged, isError: false, isFetching: false });
    expect(chatsPlaceholder(loaded)).toBeNull();
    const none = historyState({ list: mergeHistory([[]], 2), isError: false, isFetching: false });
    expect(chatsPlaceholder(none)).toBe('empty');
    expect(chatsPlaceholder(historyState({ list: null, isError: true, isFetching: false }))).toBe(
      'failed',
    );
    expect(chatsPlaceholder(historyState({ list: null, isError: false, isFetching: true }))).toBe(
      'loading',
    );
  });
});
