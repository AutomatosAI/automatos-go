// Readiness@1 (PRD-268 §6.11.3, US-G07): what Auto depends on, and what couldn't be checked, as
// core answers GET /api/readiness and POST /api/readiness/check (orchestrator/services/readiness/
// contract.py). The server computes each item's state and writes its label, detail and fix in the
// person's language (Accept-Language, src/api/accept-language.ts); the app only draws them.
// Unknown fields are ignored. An item this version cannot draw (no id or label, a state it does not
// know) is dropped, never drawn as a placeholder; a fix whose href is not an app path ('/…', never
// '//…' or '/\…', which a browser reads as another host) is dropped and its item kept. Every value
// handed out is frozen.

import { z } from 'zod';

export const READINESS_VERSION = 1;

/** ✓ Ready · ○ Not checked (the probe didn't answer in time) · ◆ Needs setup (a person must act). */
export const READINESS_STATES = ['ready', 'not_checked', 'needs_setup'] as const;
export type ReadinessState = (typeof READINESS_STATES)[number];

/** What an item is needed by (§6.11.3). */
export const NEEDED_BY = ['brief', 'voice', 'push', 'check_in'] as const;
export type NeededBy = (typeof NEEDED_BY)[number];

const APP_PATH_ROOT = '/';
const OTHER_HOST_PREFIXES = ['//', '/\\'] as const;
/** Whitespace or a control character: not a path anyone built (web-links.ts's rule). */
const UNSAFE_CHARACTERS = /[\s\u0000-\u001f\u007f]/;

/**
 * An app path: '/settings?tab=…', never another host ('//host', '/\host'), a scheme, or a path
 * with whitespace or a control character in it ('/\n/host').
 */
export function isAppPath(href: string): boolean {
  return (
    href.startsWith(APP_PATH_ROOT) &&
    !OTHER_HOST_PREFIXES.some((prefix) => href.startsWith(prefix)) &&
    !UNSAFE_CHARACTERS.test(href)
  );
}

function isNeededBy(value: unknown): value is NeededBy {
  return NEEDED_BY.some((known) => known === value);
}

function knownNeeds(values: readonly unknown[]): readonly NeededBy[] {
  return Object.freeze([...new Set(values.filter(isNeededBy))]);
}

const text = z.string().trim().min(1);

const FixSchema = z.object({ label: text, href: z.string().trim().refine(isAppPath) });

export const ReadinessItemSchema = z.object({
  id: text,
  label: text,
  detail: z.string().trim().catch(''),
  state: z.enum(READINESS_STATES),
  /** An app path only; one that is not, or that does not parse, is dropped (the item stays). */
  fix: FixSchema.nullable().optional().catch(null),
  needed_by: z.array(z.unknown()).catch([]).transform(knownNeeds),
});

export type ReadinessFix = Readonly<z.output<typeof FixSchema>>;
/** An item as drawn: its fix null when it has none (or had one that was dropped). */
export type ReadinessItem = Readonly<
  Omit<z.output<typeof ReadinessItemSchema>, 'fix'> & { fix: ReadinessFix | null }
>;

/** Each item that parses, frozen; the rest dropped. */
function drawableItems(values: readonly unknown[]): readonly ReadinessItem[] {
  return Object.freeze(
    values.flatMap((value) => {
      const parsed = ReadinessItemSchema.safeParse(value);
      if (!parsed.success) return [];
      const { fix, ...item } = parsed.data;
      return [Object.freeze({ ...item, fix: fix ? Object.freeze(fix) : null })];
    }),
  );
}

export const ReadinessSchema = z
  .object({
    v: z.literal(READINESS_VERSION),
    checked_at: z.string(),
    items: z.array(z.unknown()).transform(drawableItems),
  })
  .transform((readiness) => Object.freeze(readiness));

export type Readiness = z.output<typeof ReadinessSchema>;
