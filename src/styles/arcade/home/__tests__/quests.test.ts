// Quests (quests.ts; the kit's quests/quests.ts; D-ARC-6): the Board's top-level tickets as
// quests, each in a region by where it stands — Storm Peaks when it needs you (any needs-you row
// names it, or it sits in Review, Blocked or Failed), Hearth Village when done, Greenwood otherwise
// — with a glyph and a word; the ones that need you first and the first selected first; at most
// the kit's 50 on the map; each marker on a tile of its region; OPEN the ticket, BOARD the Board.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { NO_NEEDS_YOU, NeedsYouSchema, type NeedsYouRows } from '../../../../api/needs-you';
import { BoardSchema, type BoardTicket } from '../../../../cc/board/schemas';
import { AA_TEXT, contrastRatio } from '../../../../core/web/lib/look-kit/contrast';
import { routes } from '../../../../navigation/routes';
import { PALETTES } from '../../../tokens/arcade-catalogue';
import { regionAt, tileAt } from '../../map/world-map';
import {
  MAP_QUEST_LIMIT,
  QUEST_BOARD_ROUTE,
  QUEST_REGIONS,
  QUEST_TONES,
  firstQuest,
  needyTickets,
  questCountLine,
  questLine,
  questLog,
  questRoute,
  questSpots,
  questStatus,
  regionOf,
  selectedQuest,
  type Quest,
} from '../quests';

type Row = { id: number; status: string; title?: string; parent?: number; display_state?: string };

// Board rows as the Board's query parses them.
function board(...rows: readonly Row[]): readonly BoardTicket[] {
  const tasks = rows.map((row) => ({
    id: row.id,
    title: row.title ?? `Ticket ${row.id}`,
    status: row.status,
    tags: [],
    parent_task_id: row.parent ?? null,
    agent: null,
    display_state: row.display_state,
  }));
  return BoardSchema.parse({ tasks }).tasks;
}

const one = (row: Row) => board(row)[0];

type Kinds = Partial<Record<'review' | 'stuck' | 'failed', number[]>> & {
  question?: (number | null)[];
  approval?: (number | null)[];
};

// Needs-you's rows as the server sends them, naming tickets.
function needs(kinds: Kinds): NeedsYouRows {
  const ticketRow = (ticket_id: number) => ({ ticket_id });
  const askRow = (ticket_id: number | null, index: number) => ({
    source: 'grant',
    id: `g${index}`,
    ticket_id,
  });
  return NeedsYouSchema.parse({
    total: 0,
    rows: {
      review: (kinds.review ?? []).map(ticketRow),
      stuck: (kinds.stuck ?? []).map(ticketRow),
      failed: (kinds.failed ?? []).map(ticketRow),
      question: (kinds.question ?? []).map(askRow),
      approval: (kinds.approval ?? []).map(askRow),
    },
  }).rows;
}

const NOBODY = needyTickets(NO_NEEDS_YOU.rows);

describe('where a ticket stands on the map', () => {
  it.each([
    ['in_progress', 'active', '◆', 'In Progress', 'active'],
    ['running', 'active', '◆', 'In Progress', 'active'],
    ['inbox', 'active', '◆', 'Inbox', 'active'],
    ['assigned', 'active', '◆', 'Assigned', 'active'],
    ['review', 'needs', '!', 'Needs you', 'needs'],
    ['blocked', 'needs', '!', 'Needs you', 'needs'],
    ['failed', 'needs', '✕', 'Failed', 'failed'],
    ['done', 'done', '✓', 'Done', 'done'],
    ['completed', 'done', '✓', 'Done', 'done'],
    ['cancelled', 'done', '—', 'Cancelled', 'done'],
    ['closed', 'done', '—', 'Cancelled', 'done'],
    ['waiting_on_host', 'active', '◆', 'Waiting on host', 'active'],
  ])('%s → %s, %s %s', (status, region, glyph, word, tone) => {
    expect(questStatus(one({ id: 1, status }), NOBODY)).toEqual({ region, glyph, word, tone });
  });

  it('needs you when any needs-you row names it: review, question, approval, stuck or failed', () => {
    const needy = needyTickets(
      needs({ review: [1], question: [2, null], approval: [3], stuck: [4], failed: [5] }),
    );
    expect([...needy.needs].sort()).toEqual([1, 2, 3, 4]);
    expect([...needy.failed]).toEqual([5]);
    [1, 2, 3, 4].forEach((id) =>
      expect(questStatus(one({ id, status: 'assigned' }), needy).tone).toBe('needs'),
    );
    expect(questStatus(one({ id: 5, status: 'in_progress' }), needy)).toMatchObject({
      region: 'needs',
      tone: 'failed',
      word: 'Failed',
    });
  });

  it('reads PRD-268’s display_state when the server sends one', () => {
    expect(
      questStatus(one({ id: 1, status: 'assigned', display_state: 'needs_you' }), NOBODY).tone,
    ).toBe('needs');
    expect(
      questStatus(one({ id: 1, status: 'assigned', display_state: 'failed' }), NOBODY).tone,
    ).toBe('failed');
  });
});

describe('the quest log', () => {
  it('is the Board’s top-level tickets: needs you first, then under way, then finished', () => {
    const log = questLog({
      board: board(
        { id: 1, status: 'done' },
        { id: 2, status: 'in_progress', title: 'Compare three laptops' },
        { id: 3, status: 'review' },
        { id: 4, status: 'in_progress', parent: 2 },
        { id: 5, status: 'inbox' },
      ),
      needsYou: NO_NEEDS_YOU.rows,
    });
    expect(log.quests.map((quest) => [quest.id, quest.status.region])).toEqual([
      [3, 'needs'],
      [2, 'active'],
      [5, 'active'],
      [1, 'done'],
    ]);
    expect(log.total).toBe(4);
    expect(log.quests[1].label).toBe('Compare three laptops, in progress');
  });

  it('holds the kit’s 50 on the map, leaving the finished to the Board', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      status: i < 20 ? 'done' : 'assigned',
    }));
    const log = questLog({ board: board(...rows), needsYou: NO_NEEDS_YOU.rows });
    expect(MAP_QUEST_LIMIT).toBe(50);
    expect(log.quests).toHaveLength(50);
    expect(log.total).toBe(60);
    expect(log.quests.filter((quest) => quest.status.region === 'done')).toHaveLength(10);
    expect(questCountLine(log)).toBe('50 of 60 quests');
  });

  it('counts its quests in the header', () => {
    const log = (n: number) =>
      questLog({
        board: board(...Array.from({ length: n }, (_, i) => ({ id: i + 1, status: 'done' }))),
        needsYou: NO_NEEDS_YOU.rows,
      });
    expect([0, 1, 6].map((n) => questCountLine(log(n)))).toEqual([
      '0 quests',
      '1 quest',
      '6 quests',
    ]);
  });

  it('calls an untitled ticket by the Board’s word', () => {
    const [quest] = questLog({
      board: board({ id: 1, status: 'done', title: ' ' }),
      needsYou: NO_NEEDS_YOU.rows,
    }).quests;
    expect(quest.title).toBe('Untitled');
  });
});

describe('the quest shown first', () => {
  const log = questLog({
    board: board(
      { id: 1, status: 'in_progress' },
      { id: 2, status: 'done' },
      { id: 3, status: 'blocked' },
    ),
    needsYou: NO_NEEDS_YOU.rows,
  });

  it('is the first that needs you, else the first on the list, else none', () => {
    expect(firstQuest(log.quests)?.id).toBe(3);
    expect(firstQuest(log.quests.filter((quest) => quest.id !== 3))?.id).toBe(1);
    expect(firstQuest([])).toBeNull();
  });

  it('gives way to the marker picked while that quest is on the map', () => {
    expect(selectedQuest(log.quests, 2)?.id).toBe(2);
    expect(selectedQuest(log.quests, 99)?.id).toBe(3);
    expect(selectedQuest(log.quests, null)?.id).toBe(3);
  });
});

describe('the markers', () => {
  it('sit each on a grass tile of its quest’s region, the same tile every time', () => {
    const rows = ['in_progress', 'review', 'done'].flatMap((status, s) =>
      Array.from({ length: 8 }, (_, i) => ({ id: s * 100 + i + 1, status })),
    );
    const { quests } = questLog({ board: board(...rows), needsYou: NO_NEEDS_YOU.rows });
    const spots = questSpots(quests);
    expect(spots.size).toBe(quests.length);
    quests.forEach((quest: Quest) => {
      const spot = spots.get(String(quest.id));
      expect(spot && regionAt(spot.tx, spot.ty)).toBe(quest.status.region);
      expect(spot && tileAt(spot.tx, spot.ty)).toBe('grass');
    });
    expect(questSpots(quests)).toEqual(spots);
  });
});

describe('what the map and the quest window say', () => {
  it('names each region with its state, a glyph and a word', () => {
    expect(QUEST_REGIONS.map((region) => regionOf(region))).toEqual([
      { name: 'Greenwood', glyph: '◆', word: 'Active', tone: 'active', label: 'Greenwood: active' },
      {
        name: 'Storm Peaks',
        glyph: '!',
        word: 'Needs you',
        tone: 'needs',
        label: 'Storm Peaks: needs you',
      },
      {
        name: 'Hearth Village',
        glyph: '✓',
        word: 'Done',
        tone: 'done',
        label: 'Hearth Village: done',
      },
    ]);
  });

  it('gives the quest window its state line, OPEN the ticket sheet and BOARD the Board', () => {
    const [quest] = questLog({
      board: board({ id: 42, status: 'in_progress', title: 'Compare three laptops' }),
      needsYou: NO_NEEDS_YOU.rows,
    }).quests;
    expect(questLine(quest)).toEqual({
      text: '◆ IN PROGRESS · Greenwood',
      label: 'In Progress, Greenwood',
    });
    expect(questRoute(quest)).toBe(routes.cc.ticket(42));
    expect(QUEST_BOARD_ROUTE).toBe(routes.cc.board);
  });

  it.each(PALETTES.map((palette) => [palette.id, palette] as const))(
    'reads at AA on %s’s window, and the selected marker in the highlight',
    (_id, palette) => {
      const colours = palette.colours;
      Object.values(QUEST_TONES).forEach((tone) =>
        expect(contrastRatio(colours[tone], colours.win)).toBeGreaterThanOrEqual(AA_TEXT),
      );
      expect(contrastRatio(colours.hlt, colours.hl)).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it('quests.ts imports no React, React Native, Expo or Skia (D-SHAPE)', () => {
    const source = readFileSync(path.resolve(__dirname, '..', 'quests.ts'), 'utf8');
    expect(source).not.toMatch(/from '(react|react-native[^']*|expo[^']*|@shopify\/[^']*)'/);
  });
});
