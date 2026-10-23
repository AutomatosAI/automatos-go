// Older chats (D28; PRD-001 open question 3: newest 50, paged), pure. GET /api/chat/history answers
// newest activity first; each next page asks for the chats after the last id loaded
// (starting_after), which the server reads only once PRD-266 §4.9 lands: until then it answers the
// newest page again. So pages merge by id (a chat that moved up between pages stays where it was
// first seen, once) and the list ends on a short page or on a page that adds no id, so an ignored
// cursor ends the list instead of repeating it. A row the schema cannot read is left out of its page
// (schemas.ts), so such a page reads as short and ends the list.

import type { HistoryRow } from '../schemas';

export type HistoryList = {
  /** Every chat loaded so far, each id once, in the order first seen. */
  readonly rows: readonly HistoryRow[];
  /** No page after these: the last was short, or added nothing new. */
  readonly done: boolean;
};

export const EMPTY_HISTORY: HistoryList = Object.freeze({ rows: [], done: false });

/** The page's rows whose ids are not in `rows` yet, each id once. */
function unseen(rows: readonly HistoryRow[], page: readonly HistoryRow[]): HistoryRow[] {
  const seen = new Set(rows.map((row) => row.id));
  return page.filter(
    (row, index) => !seen.has(row.id) && page.findIndex((other) => other.id === row.id) === index,
  );
}

/** One more page on the list: new ids appended, and whether the list has ended. */
export function mergePage(
  list: HistoryList,
  page: readonly HistoryRow[],
  pageSize: number,
): HistoryList {
  const added = unseen(list.rows, page);
  const done = list.done || page.length < pageSize || added.length === 0;
  return { rows: [...list.rows, ...added], done };
}

/** Every page loaded, oldest request first, as one list. */
export function mergePages(
  pages: readonly (readonly HistoryRow[])[],
  pageSize: number,
): HistoryList {
  return pages.reduce<HistoryList>((list, page) => mergePage(list, page, pageSize), EMPTY_HISTORY);
}

/** starting_after for the next page: the last id loaded; null when the list has ended. */
export function nextCursor(list: HistoryList): string | null {
  if (list.done) return null;
  return list.rows.at(-1)?.id ?? null;
}

export type HistoryState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'loaded'; readonly list: HistoryList };

export type HistoryQuery = {
  readonly list: HistoryList | null;
  readonly isError: boolean;
  readonly isFetching: boolean;
};

/**
 * A list once loaded stays on screen, even when asking again fails; Try again shows loading until
 * the answer, not the old failure (the web's useConversationList).
 */
export function historyState({ list, isError, isFetching }: HistoryQuery): HistoryState {
  if (list) return { status: 'loaded', list };
  if (isError && !isFetching) return { status: 'failed' };
  return { status: 'loading' };
}

/** Under the rows: Load more, its spinner, its failure with Try again, or nothing at the end. */
export type HistoryFooter = 'more' | 'loading' | 'failed' | 'end';

export type FooterQuery = {
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly isFetchNextPageError: boolean;
};

export function historyFooter({
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
}: FooterQuery): HistoryFooter {
  if (isFetchingNextPage) return 'loading';
  if (!hasNextPage) return 'end';
  return isFetchNextPageError ? 'failed' : 'more';
}
