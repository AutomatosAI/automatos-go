// When a thread row draws again, pure. threadRows builds every row anew on each streamed delta, so
// MessageList memoises each row on this: the same when its row and its place are equal in value
// and its handlers are the same ones. Only the row that changed (the reply being written) draws
// again; a saved message's row, its markdown and its cards are left alone.

import type { ChatRow } from '../view-model';
import type { RowPlace } from './thread-look';

type Plain = Readonly<Record<string, unknown>>;

const owns = (value: Plain, key: string) => Object.prototype.hasOwnProperty.call(value, key);

/** An array or an object literal: compared by its parts. Anything else is compared by identity. */
function isPlain(value: unknown): value is Plain | readonly unknown[] {
  if (Array.isArray(value)) return true;
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sameList(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
}

function sameRecord(a: Plain, b: Plain): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => owns(b, key) && sameValue(a[key], b[key]));
}

/**
 * Equal in value: primitives by Object.is, arrays and object literals by their parts, anything else
 * (a function, a Date, a class's instance) only when it is the same one.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!isPlain(a) || !isPlain(b)) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && sameList(a, b);
  }
  return sameRecord(a as Plain, b as Plain);
}

/** What a thread row draws from: its row, its place and the thread's handlers. */
export type ThreadRowInputs = {
  readonly row: ChatRow;
  readonly place: RowPlace;
  readonly onLink: unknown;
  readonly onRetry?: unknown;
  readonly onCard: unknown;
  readonly report: unknown;
};

/** The row draws the same: its handlers are the same ones, its place and row equal in value. */
export function sameThreadRow(prev: ThreadRowInputs, next: ThreadRowInputs): boolean {
  return (
    prev.onLink === next.onLink &&
    prev.onRetry === next.onRetry &&
    prev.onCard === next.onCard &&
    prev.report === next.report &&
    sameValue(prev.place, next.place) &&
    sameValue(prev.row, next.row)
  );
}
