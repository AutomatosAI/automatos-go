// The out-of-date line's two lists (rule 6.4), for named-states.test.ts: the screens that draw the
// line and the screens still owed it, held against the product's sources by one pure checker, so
// the test can prove on made-up lists that each check fails when it should. Test-only (it lives
// under __tests__/ and never reaches the bundle).

import type { Owed } from '../settings/named-states';

/** A screen keeps what it read after a failed refresh: it reads its query's refetch error. */
export const HOLDS_OLDER_DATA = /\.isRefetchError\b/;

/** What a screen writes where it draws the line. */
export const DRAWS_THE_LINE = '<OutOfDateNote';

/** A screen or sheet draws, so it is a .tsx file: a hook that passes the flag on is a .ts file. */
const SCREEN = /\.tsx$/;

export type OutOfDateLists = Readonly<{
  /** The screens listed as drawing the line (OUT_OF_DATE_LINES). */
  lines: readonly Readonly<{ file: string }>[];
  /** The screens listed as still owed it (OWED). */
  owed: readonly Owed[];
}>;

/** Every product source by its repository path. */
export type Sources = ReadonlyMap<string, string>;

/** The screens and sheets that can hold older data, in the order the sources give them. */
export function screensHoldingOlderData(sources: Sources): string[] {
  return [...sources]
    .filter(([file, source]) => SCREEN.test(file) && HOLDS_OLDER_DATA.test(source))
    .map(([file]) => file);
}

/** Each owed entry names a product file and gives a reason. */
function namedAndReasoned(owed: readonly Owed[], sources: Sources): string[] {
  return owed.flatMap(({ file, reason }) => [
    ...(sources.has(file) ? [] : [`${file} is owed the line but is no product file`]),
    ...(reason.trim() === '' ? [`${file} is owed the line and gives no reason`] : []),
  ]);
}

/** No screen is both owed the line and shown as having it: listed with it, or drawing it. */
function neitherOwedNorDrawn(lists: OutOfDateLists, sources: Sources): string[] {
  const drawn = new Set(lists.lines.map((each) => each.file));
  return lists.owed.flatMap(({ file }) => [
    ...(drawn.has(file) ? [`${file} is owed the line and listed as drawing it`] : []),
    ...((sources.get(file) ?? '').includes(DRAWS_THE_LINE)
      ? [`${file} is owed the line but draws it: move it to OUT_OF_DATE_LINES`]
      : []),
  ]);
}

/** Every screen that can hold older data is in one list or the other. */
function everyHolderListed(lists: OutOfDateLists, sources: Sources): string[] {
  const listed = new Set([...lists.lines, ...lists.owed].map((each) => each.file));
  return screensHoldingOlderData(sources)
    .filter((file) => !listed.has(file))
    .map((file) => `${file} can hold older data and is neither drawing the line nor owed it`);
}

/** What is wrong with the two lists, one sentence each; empty when they hold. */
export function outOfDateFaults(lists: OutOfDateLists, sources: Sources): string[] {
  return [
    ...namedAndReasoned(lists.owed, sources),
    ...neitherOwedNorDrawn(lists, sources),
    ...everyHolderListed(lists, sources),
  ];
}
