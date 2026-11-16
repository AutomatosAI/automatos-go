// The shapes the audit settings share (test-only): a list of plain entries with the one reason
// they stand, and a deep freeze, so no audit can change a setting another audit reads.

/** A list of plain entries (a name, a path, a lock key) and the one reason all of them stand. */
export type Reasoned<T> = Readonly<{ reason: string; entries: readonly T[] }>;

function isPlain(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) return false;
  if (Array.isArray(value)) return true;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * The value, frozen all the way down through its arrays and plain objects. A RegExp, a function or
 * another class's object (a palette's tokens) is left as it is.
 */
export function frozen<T>(value: T): T {
  if (!isPlain(value)) return value;
  Object.values(value).forEach((child) => frozen(child));
  return Object.freeze(value);
}

/** A list of plain entries with its reason, frozen. */
export function reasoned<T>(reason: string, entries: readonly T[]): Reasoned<T> {
  return frozen({ reason, entries: [...entries] });
}
