// Quests on the handheld (PRD-001 §4.6.1 D-ARC-6, US-022m; the design kit's quests/quests.ts at
// 034fa629c), pure: the quests are the Board's tickets as the Command Centre reads them (the query
// its shell already makes; the top-level cards, as the Board lists them), each in a region of the
// overworld by where it stands: Storm Peaks when it needs you (a needs-you row of any kind, review,
// question, approval, stuck or failed, names the ticket; it sits in Review, Blocked or Failed; or
// PRD-268's display_state says needs_you or failed), Hearth Village when it is done (Done, or
// Cancelled and Closed under the kit's — Cancelled), Greenwood otherwise (In progress, and the
// Inbox and Assigned work not yet started, as the kit's pending Missions are). Each state is a
// glyph and a word (the Board's own word for its column), never the colour alone. The quests that
// need you come first and the first is selected first; the map holds MAP_QUEST_LIMIT, the kit's
// own cap, so the finished ones are the ones left to the Board. Pure: no React, React Native,
// Expo or Skia.

import type { NeedsYouRows } from '../../../api/needs-you';
import {
  boardColumn,
  sortTickets,
  statusWord,
  ticketTitle,
  topLevelTickets,
} from '../../../cc/board/board';
import type { BoardTicket } from '../../../cc/board/schemas';
import { routes } from '../../../navigation/routes';
import { ARCADE_QUESTS_COPY } from '../../strings';
import { placeMarkers, type MapSpot, type Region } from '../map/world-map';

/** The most quests the map holds: the kit's MISSION_FILTERS limit (quests-page.tsx). */
export const MAP_QUEST_LIMIT = 50;

export const QUEST_REGIONS: readonly Region[] = Object.freeze(['active', 'needs', 'done']);

export type QuestTone = 'active' | 'needs' | 'failed' | 'done';

/**
 * Each tone's colour, by the palette's variable names (the kit's .marker[data-tone]), active out of
 * the accent into working's §6.12.2 role (D-ARC-7): active mana blue as running, needs you quest
 * yellow as warning, failed HP red as destructive, the finished region (Done and Cancelled) in the
 * secondary text.
 */
export const QUEST_TONES: Readonly<Record<QuestTone, 'mp' | 'qs' | 'hp' | 'tx2'>> = Object.freeze({
  active: 'mp',
  needs: 'qs',
  failed: 'hp',
  done: 'tx2',
});

export type QuestStatus = {
  readonly region: Region;
  readonly glyph: string;
  readonly word: string;
  readonly tone: QuestTone;
};

export type Quest = {
  /** The ticket's board row id. */
  readonly id: number;
  readonly title: string;
  readonly status: QuestStatus;
  /** What VoiceOver hears for its marker: 'Compare three laptops, in progress'. */
  readonly label: string;
};

/** The tickets needs-you names: `failed` from its failed rows, `needs` from the other four kinds. */
export type NeedyTickets = {
  readonly needs: ReadonlySet<number>;
  readonly failed: ReadonlySet<number>;
};

export function needyTickets(rows: NeedsYouRows): NeedyTickets {
  const { review, question, approval, stuck, failed } = rows;
  const asks = [...question, ...approval].flatMap((row) =>
    row.ticket_id === null ? [] : [row.ticket_id],
  );
  const needs = [...review, ...stuck].map((row) => row.ticket_id);
  return Object.freeze({
    needs: new Set([...needs, ...asks]),
    failed: new Set(failed.map((row) => row.ticket_id)),
  });
}

const NEEDS_COLUMNS: ReadonlySet<string> = new Set(['review', 'blocked']);
const DONE_COLUMNS: ReadonlySet<string> = new Set(['done', 'cancelled']);

function status(region: Region, glyph: string, word: string, tone: QuestTone): QuestStatus {
  return Object.freeze({ region, glyph, word, tone });
}

/** Failed or needs you, or null for a ticket that asks nothing of you. */
function askOf(ticket: BoardTicket, column: string, needy: NeedyTickets): QuestTone | null {
  const failed = column === 'failed' || ticket.display_state === 'failed';
  if (failed || needy.failed.has(ticket.id)) return 'failed';
  const needs = NEEDS_COLUMNS.has(column) || ticket.display_state === 'needs_you';
  return needs || needy.needs.has(ticket.id) ? 'needs' : null;
}

/** Where a ticket stands on the map: its region, glyph, word and tone. */
export function questStatus(ticket: BoardTicket, needy: NeedyTickets): QuestStatus {
  const said = ARCADE_QUESTS_COPY;
  const column = boardColumn(ticket.status);
  const ask = askOf(ticket, column, needy);
  if (ask === 'failed') return status('needs', said.glyphs.failed, said.failed, 'failed');
  if (ask === 'needs') return status('needs', said.glyphs.needs, said.needsYou, 'needs');
  if (!DONE_COLUMNS.has(column))
    return status('active', said.glyphs.active, statusWord(column), 'active');
  const glyph = column === 'done' ? said.glyphs.done : said.glyphs.closed;
  return status('done', glyph, statusWord(column), 'done');
}

const REGION_RANK: Readonly<Record<Region, number>> = Object.freeze({
  needs: 0,
  active: 1,
  done: 2,
});

export type QuestSources = {
  /** The Board's rows once its query has answered. */
  readonly board: readonly BoardTicket[];
  /** useNeedsYou's rows (empty before it answers). */
  readonly needsYou: NeedsYouRows;
};

export type QuestLog = {
  /** On the map: those that need you, then the work under way, then the finished; at most MAP_QUEST_LIMIT. */
  readonly quests: readonly Quest[];
  /** Every quest the Board has, on the map or not. */
  readonly total: number;
};

function questOf(ticket: BoardTicket, needy: NeedyTickets): Quest {
  const title = ticketTitle(ticket);
  const shown = questStatus(ticket, needy);
  const label = ARCADE_QUESTS_COPY.markerLabel(title, shown.word);
  return Object.freeze({ id: ticket.id, title, status: shown, label });
}

/** The Board's top-level tickets as quests, in the Board's order within each region. */
export function questLog({ board, needsYou }: QuestSources): QuestLog {
  const needy = needyTickets(needsYou);
  const all = sortTickets(topLevelTickets(board))
    .map((ticket) => questOf(ticket, needy))
    .sort((a, b) => REGION_RANK[a.status.region] - REGION_RANK[b.status.region]);
  return Object.freeze({ quests: Object.freeze(all.slice(0, MAP_QUEST_LIMIT)), total: all.length });
}

/** The quest to show first: the first that needs you, else the first on the list. */
export function firstQuest(quests: readonly Quest[]): Quest | null {
  return quests.find((quest) => quest.status.region === 'needs') ?? quests[0] ?? null;
}

/** The quest the window shows: the one picked while it is still on the map, else the first. */
export function selectedQuest(quests: readonly Quest[], picked: number | null): Quest | null {
  return quests.find((quest) => quest.id === picked) ?? firstQuest(quests);
}

/** Each quest's tile, by its id, in the list's order (world-map.ts placeMarkers). */
export function questSpots(quests: readonly Quest[]): ReadonlyMap<string, MapSpot> {
  return placeMarkers(
    quests.map((quest) => ({ id: String(quest.id), region: quest.status.region })),
  );
}

/** The map window's count: '1 quest', '6 quests', or '50 of 230 quests' when some are left off. */
export function questCountLine(log: QuestLog): string {
  return ARCADE_QUESTS_COPY.count(log.quests.length, log.total);
}

/** A region's name and its state, as its label on the map shows them. */
export function regionOf(region: Region) {
  const copy = ARCADE_QUESTS_COPY.regions[region];
  const tone: QuestTone = region;
  return Object.freeze({
    ...copy,
    tone,
    label: ARCADE_QUESTS_COPY.regionLabel(copy.name, copy.word),
  });
}

/** The quest window's state line: 'IN PROGRESS · Greenwood' on screen, 'In Progress, Greenwood' heard. */
export function questLine(quest: Quest): { readonly text: string; readonly label: string } {
  const region = ARCADE_QUESTS_COPY.regions[quest.status.region].name;
  return Object.freeze({
    text: `${quest.status.glyph} ${quest.status.word.toUpperCase()} · ${region}`,
    label: ARCADE_QUESTS_COPY.statusLabel(quest.status.word, region),
  });
}

/** Where OPEN goes: the quest's ticket sheet. */
export function questRoute(quest: Pick<Quest, 'id'>): string {
  return routes.cc.ticket(quest.id);
}

/** Where BOARD goes: the whole Board. */
export const QUEST_BOARD_ROUTE: string = routes.cc.board;
