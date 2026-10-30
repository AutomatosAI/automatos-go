// arcade-story.ts (US-022g): A2's rows as Arcade's story window says them — YOU and AUTO lines,
// ★ and ✕ for what a turn did, ITEM RECEIVED for a Deliverable, A2's own cards under their headings
// — with the reply the dialogue window says left out of the story's words. Part of arcade-home's
// pure view logic.

import { describe, expect, it } from 'vitest';

import { AT, saved } from '../../../chat/__tests__/thread-fixtures';
import {
  WEB,
  apply,
  opened,
  receipt,
  streaming,
} from '../../../chat/__tests__/view-model-fixtures';
import type { CardRow } from '../../../chat/cards/view';
import { LIVE_AUTO_KEY, threadRows, type ChatRow } from '../../../chat/view-model';
import { ARCADE_HOME_COPY } from '../../strings';
import {
  eventLines,
  sayingRowKey,
  storyCards,
  storyEntries,
  storyItem,
  type StoryEntry,
} from '../arcade-story';
import { EMPTY_SHELF, fileReports, placeReports } from '../shelf';
import { SEARCH_END, SEARCH_START, TOOL_APPROVAL, madeDocument } from './fixtures';

const said = ARCADE_HOME_COPY;
const NO_PLACES = new Map();

const entriesOf = (rows: readonly ChatRow[]) =>
  storyEntries(rows, NO_PLACES, sayingRowKey(rows));

function autoEntries(entries: readonly StoryEntry[]) {
  return entries.filter(
    (entry): entry is Extract<StoryEntry, { kind: 'auto' }> => entry.kind === 'auto',
  );
}

describe('the story’s lines', () => {
  const chat = opened([
    saved('u1', 'user', 'Find me a laptop'),
    saved('a1', 'assistant', 'Three **picks**.'),
    saved('u2', 'user', 'Cheaper?'),
    saved('a2', 'assistant', 'The Vivobook.'),
  ]);

  it('YOU for the user’s words; AUTO keeps every reply’s words but the one the dialogue says', () => {
    const rows = threadRows(chat);
    expect(sayingRowKey(rows)).toBe('a2');
    const entries = entriesOf(rows);
    expect(entries.map((entry) => entry.kind)).toEqual(['you', 'auto', 'you', 'auto']);
    expect(entries[0]).toMatchObject({ kind: 'you', text: 'Find me a laptop' });
    expect(autoEntries(entries).map((entry) => entry.words)).toEqual(['Three **picks**.', '']);
  });

  it('no row is the dialogue’s once the user’s message is the newest', () => {
    const asked = threadRows(opened([saved('u1', 'user', 'Hello')]));
    expect(sayingRowKey(asked)).toBeNull();
    expect(sayingRowKey([])).toBeNull();
  });

  it("'Auto is thinking' is not a line: the dialogue's '…' says it", () => {
    const state = apply(opened(), { type: 'send', draft: { text: 'Status?', files: [], sentAt: AT } });
    const rows = threadRows(state);
    expect(rows.some((row) => row.type === 'working')).toBe(true);
    expect(entriesOf(rows).map((entry) => entry.kind)).toEqual(['you']);
  });
});

describe('★ and ✕: what a turn did', () => {
  it('a tool call is ★ in A2’s words; one that failed is ✕', () => {
    const rows = threadRows(streaming(SEARCH_START, SEARCH_END));
    const [auto] = autoEntries(entriesOf(rows));
    expect(auto.events).toHaveLength(1);
    expect(auto.events[0]).toMatchObject({ tone: 'event', mark: said.event, link: null });
    const failed = eventLines({
      toolLines: [{ key: 't', mark: '✕', tone: 'failed', text: 'Search failed', accessibilityLabel: 'Failed' }],
      receipts: null,
    });
    expect(failed[0]).toMatchObject({ tone: 'failed', mark: said.failed, text: 'Search failed' });
  });

  it('a done receipt is ★ with its link, a refused one ✕ without; skipped and waiting show none', () => {
    const state = streaming({
      kind: 'receipts',
      receipts: [
        receipt({ link: '/missions/m-1' }),
        receipt({ status: 'refused', reason: 'No access', link: '/missions/m-1' }),
        receipt({ status: 'skipped' }),
        receipt({ status: 'waiting' }),
      ],
    });
    const [row] = threadRows(state, { webUrl: WEB }).filter((each) => each.type === 'auto');
    if (row?.type !== 'auto') throw new Error('expected Auto’s row');
    const events = eventLines(row);
    expect(events.map((event) => event.tone)).toEqual(['event', 'failed']);
    expect(events[0].link).not.toBeNull();
    expect(events[1].link).toBeNull();
  });
});

describe('ITEM RECEIVED', () => {
  it('is placed in the reply that made the Deliverable, with OPEN for an id the route takes', () => {
    const state = streaming({ kind: 'text', text: 'Here it is.' }, madeDocument('d-41', 'Laptop picks'));
    const rows = threadRows(state);
    const shelf = fileReports(EMPTY_SHELF, state);
    const places = placeReports(shelf, state, LIVE_AUTO_KEY, new Set(rows.map((row) => row.key)));
    const [auto] = autoEntries(storyEntries(rows, places, sayingRowKey(rows)));
    expect(auto.items).toEqual([
      {
        key: 'd-41',
        id: 'd-41',
        title: 'Laptop picks',
        meta: said.itemMeta('Document'),
        label: said.itemLabel('Laptop picks', 'Document'),
        openable: true,
      },
    ]);
  });

  it('has no OPEN for an id the Deliverables route would refuse', () => {
    expect(storyItem({ id: 'not an id/', title: 'Odd', kind: 'image' }).openable).toBe(false);
  });

  it('a Deliverable whose reply was never drawn sits at the story’s end', () => {
    const places = new Map([['loose-reports', [{ id: 'd-9', title: 'Late', kind: 'video' as const }]]]);
    const entries = storyEntries([], places, null);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'loose', items: [{ id: 'd-9' }] });
  });
});

describe("A2's own cards under the story's headings", () => {
  const raised = streaming(TOOL_APPROVAL);
  const cardsIn = (rows: readonly ChatRow[]): readonly CardRow[] =>
    rows.flatMap((row) => (row.type === 'auto' ? row.cards : []));

  it("an approval waits under '! A choice awaits', and reads 'A choice was made' once answered", () => {
    const [card] = cardsIn(threadRows(raised));
    expect(card?.kind).toBe('tool');
    const waiting = storyCards([card], said.choiceAwaits);
    expect(waiting.choices).toEqual([
      { key: card.key, heading: said.choiceAwaits, waiting: true, cards: [card] },
    ]);
    expect(waiting.others).toEqual([]);
    const denied = apply(raised, { type: 'card', key: card.key, outcome: { state: 'denied' } });
    const [answered] = cardsIn(threadRows(denied));
    expect(storyCards([answered], said.choiceAwaits).choices[0]).toMatchObject({
      heading: said.choiceMade,
      waiting: false,
    });
  });

  it('the auto entry carries its cards; cards whose reply never came are still open at the end', () => {
    const [auto] = autoEntries(entriesOf(threadRows(raised)));
    expect(auto.cards.choices).toHaveLength(1);
    const [card] = cardsIn(threadRows(raised));
    const loose: ChatRow = { type: 'cards', key: 'loose-cards', cards: [card] };
    expect(entriesOf([loose])).toEqual([
      {
        kind: 'loose',
        key: 'loose-cards',
        cards: { choices: [expect.objectContaining({ heading: said.looseChoices })], others: [] },
        items: [],
      },
    ]);
  });
});
