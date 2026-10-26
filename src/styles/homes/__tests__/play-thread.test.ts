import { describe, expect, it } from 'vitest';

import { saved } from '../../../chat/__tests__/thread-fixtures';
import { autoRows, opened, receipt } from '../../../chat/__tests__/view-model-fixtures';
import { createThread, threadReducer, type ThreadAction } from '../../../chat/controller/thread';
import { CHAT_COPY } from '../../../chat/strings';
import {
  LIVE_AUTO_KEY,
  LIVE_USER_KEY,
  receiptsView,
  threadRows,
  toolLineRows,
} from '../../../chat/view-model';
import { PLAY_CHAT_COPY, PLAY_HOME_COPY } from '../../strings';
import {
  caretOn,
  playReceiptRows,
  playTitle,
  reportEyebrowOf,
  risesIn,
  toolChipsOf,
  userWords,
} from '../play-thread';
import { EMPTY_SHELF, LOOSE_REPORTS, fileReports, placeReports, shelfCount } from '../shelf';
import { FINISH, FINISHED, SEARCH_START, SEND, frame, madeDocument } from './fixtures';

const SHORTLIST = madeDocument('shortlist-1', 'Laptop shortlist');
const apply = (start: ReturnType<typeof opened>, ...actions: ThreadAction[]) =>
  actions.reduce(threadReducer, start);

describe('A2’s rows in Play’s pieces', () => {
  it('a tool line is a chip in the same words, tone and spoken label', () => {
    const state = apply(opened(), SEND, frame(SEARCH_START));
    const [auto] = autoRows(threadRows(state));
    const [chip] = toolChipsOf(auto.toolLines);
    const [line] = toolLineRows(state.live?.turn.toolCalls ?? [], true);
    expect(chip).toEqual({
      key: line.key,
      kind: 'running',
      mark: null,
      text: line.text,
      label: line.accessibilityLabel,
    });
  });

  it('"What Auto did": badges toned as the web’s, a done write in the text colour, links kept', () => {
    const view = receiptsView([
      receipt({}),
      receipt({ status: 'refused', kind: 'write', action: 'delete_task' }),
      receipt({ status: 'skipped', kind: 'read', action: 'list_tasks' }),
      receipt({
        status: 'done',
        kind: 'read',
        action: 'web_search',
        link: '/command-center?tab=board&task_id=42',
      }),
    ]);
    const rows = playReceiptRows(view);
    expect(rows.map((row) => [row.badge, row.badgeTone, row.emphasis])).toEqual([
      [PLAY_CHAT_COPY.receipts.done, 'accent', true],
      [PLAY_CHAT_COPY.receipts.notDone, 'error', false],
      [PLAY_CHAT_COPY.receipts.skipped, 'faded', false],
      [null, null, false],
    ]);
    expect(rows.map((row) => row.linked)).toEqual([false, false, false, true]);
    expect(rows[0].label).toBe(view?.lines[0].accessibilityLabel);
    expect(playReceiptRows(null)).toEqual([]);
  });

  it('only the live rows rise, and the caret follows the reply this phone reads', () => {
    expect(risesIn(LIVE_USER_KEY)).toBe(true);
    expect(risesIn(LIVE_AUTO_KEY)).toBe(true);
    expect(risesIn('m1')).toBe(false);
    expect(caretOn(LIVE_AUTO_KEY, { status: 'streaming' })).toBe(true);
    expect(caretOn(LIVE_AUTO_KEY, { status: 'working' })).toBe(false);
    expect(caretOn('m1', { status: 'streaming' })).toBe(false);
  });

  it('the title is the chat’s own, else New chat for a draft', () => {
    const chat = { id: 'c1', title: ' Laptop for uni ', createdAt: null, updatedAt: null };
    const checked = { ...chat, kind: 'user', turnInFlight: false } as const;
    expect(playTitle({ chatId: 'c1' }, checked)).toBe('Laptop for uni');
    expect(playTitle({ chatId: null }, checked)).toBe(PLAY_HOME_COPY.newChat);
    expect(playTitle({ chatId: 'c2' }, checked)).toBe(PLAY_HOME_COPY.untitled);
    expect(playTitle({ chatId: 'c1' }, { ...checked, title: null })).toBe(PLAY_HOME_COPY.untitled);
  });

  it('the user’s words name the files that went with them', () => {
    expect(userWords({ text: 'Here', files: ['notes.pdf'] })).toBe(
      `Here\n${CHAT_COPY.attached}: notes.pdf`,
    );
    expect(userWords({ text: '', files: ['a.png', 'b.png'] })).toBe(
      `${CHAT_COPY.attached}: a.png, b.png`,
    );
    expect(userWords({ text: 'Hi', files: [] })).toBe('Hi');
  });

  it('a report card says its kind: Report for a document, as Ember does', () => {
    expect(reportEyebrowOf({ kind: 'document' })).toBe('Report · just now');
    expect(reportEyebrowOf({ kind: 'image' })).toBe('Image · just now');
  });
});

describe('the Shelf: the Deliverables this conversation made', () => {
  it('files each once with its turn, and draws it in the live reply', () => {
    const words = frame({ kind: 'text', text: 'Here is your shortlist.' });
    const state = apply(
      opened([saved('m1', 'user', 'Hi')]),
      SEND,
      words,
      frame(SHORTLIST),
      frame(SHORTLIST),
    );
    const memory = fileReports(EMPTY_SHELF, state);
    expect(shelfCount(memory)).toBe(1);
    expect(fileReports(memory, state)).toBe(memory);
    const drawn = new Set(threadRows(state).map((row) => row.key));
    const places = placeReports(memory, state, LIVE_AUTO_KEY, drawn);
    expect(places.get(LIVE_AUTO_KEY)?.map((ref) => ref.title)).toEqual(['Laptop shortlist']);
  });

  it('stays in the saved reply that retires the turn', () => {
    const question = saved('m1', 'user', 'Make me a shortlist');
    const reply = saved('m2', 'assistant', 'Here it is.');
    const streamed = apply(opened(), SEND, frame(SHORTLIST), frame(FINISH), FINISHED);
    const memory = fileReports(EMPTY_SHELF, streamed);
    const retired = threadReducer(streamed, { type: 'settled', messages: [question, reply] });
    expect(retired.live).toBeNull();
    const drawn = new Set(threadRows(retired).map((row) => row.key));
    const places = placeReports(fileReports(memory, retired), retired, LIVE_AUTO_KEY, drawn);
    expect(places.get('m2')?.map((ref) => ref.id)).toEqual(['shortlist-1']);
  });

  it('sits after the thread while the reply has nothing to draw yet', () => {
    const state = apply(opened(), SEND, frame(SHORTLIST));
    const memory = fileReports(EMPTY_SHELF, state);
    const drawn = new Set(threadRows(state).map((row) => row.key));
    expect(drawn.has(LIVE_AUTO_KEY)).toBe(false);
    const places = placeReports(memory, state, LIVE_AUTO_KEY, drawn);
    expect(places.get(LOOSE_REPORTS)).toHaveLength(1);
  });

  it('a draft keeps its Deliverables when named; another chat starts again', () => {
    const draft = apply(createThread(null), SEND, frame(SHORTLIST));
    const memory = fileReports(EMPTY_SHELF, draft);
    const named = apply(draft, frame({ kind: 'chat-id', chatId: 'c-new', aiGenerated: true }));
    expect(shelfCount(fileReports(memory, named))).toBe(1);
    expect(shelfCount(fileReports(fileReports(memory, named), opened()))).toBe(0);
  });
});
