// Small value helpers the crash-report scrubber shares (R01, KR7): pure, no imports beyond the
// redactor. Every helper returns a new object and never writes to its input, so a frozen event or
// breadcrumb scrubs as well as a live one.

import { redactText } from './redact';

export type Fields = Readonly<Record<string, unknown>>;

/** A plain object (not an array, not null). */
export function isRecord(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A field kept as it is: a string, a finite number or a boolean; anything else is dropped. */
function isPrimitive(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

/** The named fields that hold a primitive, copied as they are (an allowlist, not a filter). */
export function pickPrimitives(source: object, keys: readonly string[]): Record<string, unknown> {
  const fields = source as Fields;
  return Object.fromEntries(
    keys.filter((key) => isPrimitive(fields[key])).map((key) => [key, fields[key]]),
  );
}

/**
 * Every primitive field but the denied ones, each string through redactText(); nested objects and
 * arrays are dropped (a context's lists, such as app.view_names, name screens).
 */
export function redactPrimitives(
  source: Fields,
  denied: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key, value]) => !denied.has(key) && isPrimitive(value))
      .map(([key, value]) => [key, typeof value === 'string' ? redactText(value) : value]),
  );
}

/** The record without its empty result: undefined when nothing is left, so the key is left out. */
export function nonEmpty<T extends object>(record: T): T | undefined {
  return Object.keys(record).length > 0 ? record : undefined;
}

/** The key: value pair when the value is defined, else nothing (for a conditional spread). */
export function present<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}
