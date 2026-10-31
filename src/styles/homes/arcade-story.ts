// Arcade's story window over A2's rows (PRD-001 §4.6.1, US-022g; the design kit's chat/story.tsx,
// entries.tsx, lines.ts and cards.tsx at 034fa629c), pure: A2's view-model rows (threadRows) as
// the story's entries, oldest first, under the AI label the window opens with.
//
//   YOU      the user's words, and the files that went with them (as Play's bubble says them)
//   ★ / ✕    what a turn did: A2's tool lines and its done receipts (with their links), in A2's
//            words and spoken labels; a failed call or a refused receipt is ✕. A skipped receipt,
//            and one waiting on its approval card, show none (the kit's lines.ts)
//   AUTO     Auto's answer, A2's markdown; the reply the dialogue window is saying keeps its words
//            there (the kit's sayingId), the story shows the rest of it
//   BRIEF    a reply carrying the day's brief (row.brief, where discovery lists `brief`; PRD-268
//            US-G06) that the dialogue is not saying: a window, '★ Today's brief' (or the brief's
//            date when it is another day's), its greeting and OPEN BRIEF, never its markdown
//   IDEA     a suggestion Auto posted (a 'suggestion' row, where discovery lists `suggestions`;
//            PRD-268 §6.5.1): its card in a window while the open list has it and the NEXT line
//            does not (ThreadSuggestion), else its AUTO line. It is one of Auto's replies to the
//            dialogue (autoRowOf): the newest says its words there, and the story keeps the card
//   ITEM RECEIVED  a window for each Deliverable the turn made (shelf.ts files them), with OPEN
//   choices A2's own approval cards (a plan, a tool), unchanged, each under '! A choice awaits'
//            while it is open and 'A choice was made' once answered; a choice whose reply never came
//            sits under 'Choices still open'. The other cards (a Mission suggestion, a withdraw
//            offer) follow without a heading, as do A2's ticket cards and notices
// 'Auto is thinking' is not a row: the dialogue window's '…' says it. Pure: no React, React
// Native, Expo or Skia.

import { briefDateLabel } from '../../brief/model';
import type { Brief } from '../../brief/schema';
import type { CardRow } from '../../chat/cards/view';
import type {
  AutoRow,
  ChatRow,
  Notice,
  ReceiptRow,
  ThreadSuggestionRow,
  ToolLineRow,
} from '../../chat/view-model';
import {
  KIND_WORDS,
  isDeliverableId,
  type DeliverableRef,
} from '../../core/web/lib/chat/deliverables';
import type { WebLinkTarget } from '../../navigation/web-links';
import { ARCADE_HOME_COPY } from '../strings';
import { userWords } from './play-thread';
import { LOOSE_REPORTS } from './shelf';

export type EventLine = {
  readonly key: string;
  readonly tone: 'event' | 'failed';
  /** ★ or ✕, hidden from VoiceOver: the label says it. */
  readonly mark: string;
  readonly text: string;
  readonly label: string;
  readonly link: WebLinkTarget | null;
};

export type Choice = {
  readonly key: string;
  readonly heading: string;
  /** Still open: the heading is in the quest colour. */
  readonly waiting: boolean;
  /** The one card, as A2's ThreadCards draws a list. */
  readonly cards: readonly CardRow[];
};

export type StoryCards = {
  readonly choices: readonly Choice[];
  readonly others: readonly CardRow[];
};

export type StoryItem = {
  readonly key: string;
  readonly id: string;
  readonly title: string;
  readonly meta: string;
  readonly label: string;
  /** OPEN shows: the id is one the Deliverables route takes. */
  readonly openable: boolean;
};

/** A brief in the story: its window's title (with the ★), the greeting, and the brief to open. */
export type StoryBrief = {
  /** '★ Today's brief', or '★ Brief · Tuesday, 28 October' for another day's. */
  readonly heading: string;
  readonly greeting: string;
  /** What VoiceOver hears of the window: the title and the greeting, without the ★. */
  readonly label: string;
  readonly brief: Brief;
};

/** One of Auto's replies: its ★ and ✕ lines, its words, its brief, items and cards. */
export type AutoStoryEntry = {
  readonly kind: 'auto';
  readonly key: string;
  readonly row: AutoRow;
  readonly events: readonly EventLine[];
  /** Auto's answer (markdown) shown here; '' when the dialogue window says it, or a brief. */
  readonly words: string;
  /** The day's brief as its window; null when the row carries none or the dialogue says it. */
  readonly brief: StoryBrief | null;
  readonly items: readonly StoryItem[];
  readonly cards: StoryCards;
};

/** A suggestion Auto posted: its card while it shows, else its post as Auto's reply (`text`). */
export type SuggestionStoryEntry = {
  readonly kind: 'suggestion';
  /** The post's message id, as its Auto row's key. */
  readonly key: string;
  /** The suggestion it delivered: ThreadSuggestion draws its card from the open list by this id. */
  readonly suggestionId: string;
  /** The post as an AUTO entry, drawn whenever the card is not; no words while the dialogue says it. */
  readonly text: AutoStoryEntry;
};

export type StoryEntry =
  | { readonly kind: 'you'; readonly key: string; readonly text: string; readonly label: string }
  | AutoStoryEntry
  | SuggestionStoryEntry
  | { readonly kind: 'notice'; readonly key: string; readonly notice: Notice }
  | {
      readonly kind: 'loose';
      readonly key: string;
      readonly cards: StoryCards;
      readonly items: readonly StoryItem[];
    };

const NO_ITEMS: readonly DeliverableRef[] = Object.freeze([]);

type ChoiceCard = Extract<CardRow, { kind: 'plan' | 'tool' }>;

/** An approval the person answers: a plan or a tool (the kit's ToolApproval and MissionApproval). */
function isChoice(card: CardRow): card is ChoiceCard {
  return card.kind === 'plan' || card.kind === 'tool';
}

function toolEvent(line: ToolLineRow): EventLine {
  const failed = line.tone === 'failed';
  const said = ARCADE_HOME_COPY;
  return Object.freeze({
    key: line.key,
    tone: failed ? 'failed' : 'event',
    mark: failed ? said.failed : said.event,
    text: line.text,
    label: line.accessibilityLabel,
    link: null,
  });
}

function receiptEvent(row: ReceiptRow): EventLine[] {
  if (row.status === 'waiting' || row.status === 'skipped') return [];
  const failed = row.status === 'refused';
  const said = ARCADE_HOME_COPY;
  return [
    Object.freeze({
      key: row.key,
      tone: failed ? 'failed' : 'event',
      mark: failed ? said.failed : said.event,
      text: row.text,
      label: row.accessibilityLabel,
      link: failed ? null : row.link,
    }),
  ];
}

/** What a reply did, as ★ and ✕ lines: its tool calls, then its receipts. */
export function eventLines(row: Pick<AutoRow, 'toolLines' | 'receipts'>): readonly EventLine[] {
  const receipts = row.receipts?.lines.flatMap(receiptEvent) ?? [];
  return Object.freeze([...row.toolLines.map(toolEvent), ...receipts]);
}

/** A2's cards: the choices each under its heading, then the rest. */
export function storyCards(cards: readonly CardRow[], openHeading: string): StoryCards {
  const said = ARCADE_HOME_COPY;
  const choices = cards.filter(isChoice).map((card) => {
    const waiting = card.outcome.state === 'open';
    const heading = waiting ? openHeading : said.choiceMade;
    return Object.freeze({ key: card.key, heading, waiting, cards: Object.freeze([card]) });
  });
  const others = cards.filter((card) => !isChoice(card));
  return Object.freeze({ choices: Object.freeze(choices), others: Object.freeze(others) });
}

/** A Deliverable the turn made, as its ITEM RECEIVED window says it. */
export function storyItem(ref: DeliverableRef): StoryItem {
  const kind = KIND_WORDS[ref.kind];
  const said = ARCADE_HOME_COPY;
  return Object.freeze({
    key: ref.id,
    id: ref.id,
    title: ref.title,
    meta: said.itemMeta(kind),
    label: said.itemLabel(ref.title, kind),
    openable: isDeliverableId(ref.id),
  });
}

/**
 * The row as one of Auto's replies: an Auto row, or a suggestion's post as its text (PRD-268
 * §6.5.1: the dialogue says it as it says any reply); null for any other row.
 */
export function autoRowOf(row: ChatRow): AutoRow | null {
  if (row.type === 'auto') return row;
  return row.type === 'suggestion' ? row.text : null;
}

/**
 * The row the dialogue window is saying: the newest of Auto's rows (a suggestion's post among them)
 * with no message of the user's after it (the newest reply, as hudTurn reads it); null when the
 * user's message is the newest.
 */
export function sayingRowKey(rows: readonly ChatRow[]): string | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row.type === 'user') return null;
    if (autoRowOf(row) !== null) return row.key;
  }
  return null;
}

/**
 * A brief's window in the story: '★ Today's brief' when its date is `today` (the phone's local
 * date), else the brief's own date, then its greeting.
 */
export function storyBrief(brief: Brief, today: string | null): StoryBrief {
  const said = ARCADE_HOME_COPY;
  const title =
    brief.date === today ? said.brief.today : said.brief.dated(briefDateLabel(brief.date));
  const greeting = brief.greeting.trim();
  return Object.freeze({
    heading: `${said.event} ${title}`,
    greeting,
    label: said.brief.label(title, greeting),
    brief,
  });
}

type Places = ReadonlyMap<string, readonly DeliverableRef[]>;

type EntryContext = {
  readonly places: Places;
  readonly sayingKey: string | null;
  readonly today: string | null;
};

function autoEntry(row: AutoRow, { places, sayingKey, today }: EntryContext): AutoStoryEntry {
  const said = row.key === sayingKey;
  return {
    kind: 'auto',
    key: row.key,
    row,
    events: eventLines(row),
    words: said || row.brief !== null ? '' : row.answer,
    brief: row.brief !== null && !said ? storyBrief(row.brief, today) : null,
    items: (places.get(row.key) ?? NO_ITEMS).map(storyItem),
    cards: storyCards(row.cards, ARCADE_HOME_COPY.choiceAwaits),
  };
}

/**
 * A suggestion's post: its card's window, its AUTO line the fallback. The post's key is its Auto
 * row's, so the dialogue saying it (sayingRowKey) leaves the fallback without words, as any reply.
 */
function suggestionEntry(row: ThreadSuggestionRow, context: EntryContext): SuggestionStoryEntry {
  return {
    kind: 'suggestion',
    key: row.key,
    suggestionId: row.suggestionId,
    text: autoEntry(row.text, context),
  };
}

function entryOf(row: ChatRow, context: EntryContext): StoryEntry | null {
  switch (row.type) {
    case 'user':
      return { kind: 'you', key: row.key, text: userWords(row), label: row.accessibilityLabel };
    case 'auto':
      return autoEntry(row, context);
    case 'notice':
      return { kind: 'notice', key: row.key, notice: row.notice };
    case 'cards':
      return {
        kind: 'loose',
        key: row.key,
        cards: storyCards(row.cards, ARCADE_HOME_COPY.looseChoices),
        items: [],
      };
    case 'working':
      return null; // the dialogue window's '…'
    case 'suggestion':
      return suggestionEntry(row, context);
  }
}

/**
 * The story's entries, oldest first: each of A2's rows, then the Deliverables no drawn reply holds
 * (shelf.ts's LOOSE_REPORTS) as one more entry. `places` is placeReports' map; `today` the phone's
 * local date, which names a brief's window (null: every brief says its date).
 */
export function storyEntries(
  rows: readonly ChatRow[],
  places: Places,
  sayingKey: string | null,
  today: string | null = null,
): readonly StoryEntry[] {
  const context: EntryContext = { places, sayingKey, today };
  const entries = rows.flatMap((row) => {
    const entry = entryOf(row, context);
    return entry ? [entry] : [];
  });
  const loose = places.get(LOOSE_REPORTS) ?? NO_ITEMS;
  if (loose.length === 0) return Object.freeze(entries);
  const items: StoryEntry = {
    kind: 'loose',
    key: LOOSE_REPORTS,
    cards: storyCards([], ARCADE_HOME_COPY.looseChoices),
    items: loose.map(storyItem),
  };
  return Object.freeze([...entries, items]);
}
