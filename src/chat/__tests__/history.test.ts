import { describe, expect, it } from 'vitest';

import { HISTORY_PAGE_SIZE } from '../api';
import {
  EMPTY_HISTORY,
  historyFooter,
  historyState,
  mergePage,
  mergePages,
  nextCursor,
  type HistoryList,
} from '../history/history';
import { HistorySchema, type HistoryRow } from '../schemas';

const PAGE = 3;

const rows = (...ids: string[]): HistoryRow[] =>
  HistorySchema.parse(
    ids.map((id) => ({
      id,
      title: `Chat ${id}`,
      createdAt: '2026-10-22T08:00:00Z',
      updatedAt: '2026-10-23T08:00:00Z',
      lastMessagePreview: 'Morning digest',
      kind: 'user',
    })),
  );

const ids = (list: HistoryList) => list.rows.map((row) => row.id);

describe('older chats: one page at a time (PRD-001 open question 3)', () => {
  it('asks for 50 a page', () => {
    expect(HISTORY_PAGE_SIZE).toBe(50);
  });

  it('keeps the first full page in the server order and expects another', () => {
    const list = mergePage(EMPTY_HISTORY, rows('c', 'b', 'a'), PAGE);
    expect(ids(list)).toEqual(['c', 'b', 'a']);
    expect(list.done).toBe(false);
    expect(nextCursor(list)).toBe('a');
  });

  it('appends the next page after the rows already loaded', () => {
    const list = mergePages([rows('f', 'e', 'd'), rows('c', 'b', 'a')], PAGE);
    expect(ids(list)).toEqual(['f', 'e', 'd', 'c', 'b', 'a']);
    expect(nextCursor(list)).toBe('a');
  });

  it('ends on a short page, and on an empty one', () => {
    const short = mergePages([rows('e', 'd', 'c'), rows('b', 'a')], PAGE);
    expect(ids(short)).toEqual(['e', 'd', 'c', 'b', 'a']);
    expect(short.done).toBe(true);
    expect(nextCursor(short)).toBeNull();

    const empty = mergePages([rows('c', 'b', 'a'), []], PAGE);
    expect(ids(empty)).toEqual(['c', 'b', 'a']);
    expect(nextCursor(empty)).toBeNull();
  });

  it('is an ended, empty list when there are no chats at all', () => {
    const none = mergePages([[]], PAGE);
    expect(none).toEqual({ rows: [], done: true });
    expect(nextCursor(none)).toBeNull();
    expect(nextCursor(EMPTY_HISTORY)).toBeNull();
  });

  it('does not change the list it was given', () => {
    const first = mergePage(EMPTY_HISTORY, rows('c', 'b', 'a'), PAGE);
    const before = ids(first);
    mergePage(first, rows('z', 'y', 'x'), PAGE);
    expect(ids(first)).toEqual(before);
    expect(EMPTY_HISTORY.rows).toEqual([]);
  });
});

describe('older chats: dedupe by id', () => {
  it('shows a chat that moved up between pages once, where it was first seen', () => {
    // 'd' had new activity after page one, so the server lists it again on page two
    const list = mergePages([rows('f', 'e', 'd'), rows('d', 'c', 'b')], PAGE);
    expect(ids(list)).toEqual(['f', 'e', 'd', 'c', 'b']);
    expect(list.done).toBe(false);
    expect(nextCursor(list)).toBe('b');
  });

  it('drops an id the same page lists twice', () => {
    const list = mergePage(EMPTY_HISTORY, rows('c', 'c', 'b'), PAGE);
    expect(ids(list)).toEqual(['c', 'b']);
  });
});

describe('older chats: the server ignored starting_after', () => {
  it('stops when the next page adds no new id (the newest page again)', () => {
    const list = mergePages([rows('c', 'b', 'a'), rows('c', 'b', 'a')], PAGE);
    expect(ids(list)).toEqual(['c', 'b', 'a']);
    expect(list.done).toBe(true);
    expect(nextCursor(list)).toBeNull();
  });

  it('stays ended once ended, whatever a later page holds', () => {
    const list = mergePages([rows('c', 'b', 'a'), rows('c', 'b', 'a'), rows('z', 'y', 'x')], PAGE);
    expect(list.done).toBe(true);
    expect(nextCursor(list)).toBeNull();
  });
});

describe("the list's state", () => {
  const list = mergePages([rows('c', 'b', 'a')], PAGE);

  it('is loading until the first answer, and while Try again asks', () => {
    expect(historyState({ list: null, isError: false, isFetching: true })).toEqual({
      status: 'loading',
    });
    expect(historyState({ list: null, isError: true, isFetching: true })).toEqual({
      status: 'loading',
    });
  });

  it('is failed when the first page failed and nothing is asking', () => {
    expect(historyState({ list: null, isError: true, isFetching: false })).toEqual({
      status: 'failed',
    });
  });

  it('keeps a loaded list on screen when asking again fails', () => {
    expect(historyState({ list, isError: true, isFetching: false })).toEqual({
      status: 'loaded',
      list,
    });
  });
});

describe("the list's footer", () => {
  const base = { hasNextPage: true, isFetchingNextPage: false, isFetchNextPageError: false };

  it("offers 'Load more' while another page may follow", () => {
    expect(historyFooter(base)).toBe('more');
  });

  it('shows the spinner while the next page loads', () => {
    expect(historyFooter({ ...base, isFetchingNextPage: true })).toBe('loading');
    expect(historyFooter({ ...base, isFetchingNextPage: true, isFetchNextPageError: true })).toBe(
      'loading',
    );
  });

  it('says the next page failed, with Try again', () => {
    expect(historyFooter({ ...base, isFetchNextPageError: true })).toBe('failed');
  });

  it('shows nothing once the list has ended', () => {
    expect(historyFooter({ ...base, hasNextPage: false })).toBe('end');
    expect(historyFooter({ ...base, hasNextPage: false, isFetchNextPageError: true })).toBe('end');
  });
});
