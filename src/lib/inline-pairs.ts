// Markdown's paired marks (**strong**, __strong__, ~~struck~~, *emphasis*, _emphasis_) taken out of
// text in one pass, the words between them kept (pure). A marker opens; the nearest marker after it
// that may close it closes; a marker nothing closes stays as written. Each rule answers exactly as the
// lazy pattern it replaced (/\*\*(?=\S)(.*?\S)\*\*/g and its kin), match for match. Those patterns
// read on from every unclosed marker to the end of the line or the text, so a text of nothing but
// openers took the square of its length; a Deliverable's text is up to a megabyte the server
// chooses. Here every place a marker could close is found once, and each opener looks its closer up.

import { firstPlaceFrom, placesWhere, type Takes } from './text-runs';

export type PairRule = Readonly<{
  /** The markers, tried in this order where one starts; each is closed by the same marker. */
  markers: readonly string[];
  /** The one character before the opener that a match also takes and keeps, as (^|\W) does. */
  before?: Takes;
  /** The first character between the markers. */
  first: Takes;
  /** Every character between the markers but the last. */
  holds: Takes;
  /** The last character between the markers. */
  last: Takes;
  /** The character after the closer, '' at the end of the text. */
  after?: Takes;
}>;

type Found = Readonly<{ kept: string; end: number }>;

type Context = Readonly<{
  text: string;
  rule: PairRule;
  /** For each marker, every place it starts with a `last` character before it and `after` after it. */
  closers: ReadonlyMap<string, readonly number[]>;
  /** Every place holding a character the words between the markers cannot. */
  stops: readonly number[];
}>;

function closersOf(text: string, marker: string, rule: PairRule): readonly number[] {
  const found: number[] = [];
  for (let at = text.indexOf(marker, 1); at !== -1; at = text.indexOf(marker, at + 1)) {
    const after = rule.after?.(text.charAt(at + marker.length)) ?? true;
    if (after && rule.last(text.charAt(at - 1))) found.push(at);
  }
  return found;
}

/** The pair that the marker at `opener` opens, kept as its words (after `prefix`), or null. */
function closeFrom(context: Context, opener: number, marker: string, prefix: string): Found | null {
  const { text, rule } = context;
  const start = opener + marker.length;
  if (start >= text.length || !rule.first(text.charAt(start))) return null;
  const close = firstPlaceFrom(context.closers.get(marker) ?? [], start + 1);
  if (close === undefined) return null;
  const stop = firstPlaceFrom(context.stops, start) ?? text.length;
  if (close - 1 > stop) return null;
  return Object.freeze({
    kept: `${prefix}${text.slice(start, close)}`,
    end: close + marker.length,
  });
}

function openAt(context: Context, opener: number, prefix: string): Found | null {
  for (const marker of context.rule.markers) {
    if (!context.text.startsWith(marker, opener)) continue;
    const found = closeFrom(context, opener, marker, prefix);
    if (found !== null) return found;
  }
  return null;
}

/** A pair that a match starting at `at` takes, the character before the opener included. */
function matchAt(context: Context, at: number): Found | null {
  const { text, rule } = context;
  if (rule.before === undefined) return openAt(context, at, '');
  const fromStart = at === 0 ? openAt(context, 0, '') : null;
  if (fromStart !== null) return fromStart;
  const char = text.charAt(at);
  return rule.before(char) ? openAt(context, at + 1, char) : null;
}

/** The text with every pair the rule matches replaced by its words. */
export function replacePairs(text: string, rule: PairRule): string {
  if (!rule.markers.some((marker) => text.includes(marker))) return text;
  const context: Context = {
    text,
    rule,
    closers: new Map(rule.markers.map((marker) => [marker, closersOf(text, marker, rule)])),
    stops: placesWhere(text, (char) => !rule.holds(char)),
  };
  const pieces: string[] = [];
  let copied = 0;
  let at = 0;
  while (at < text.length) {
    const found = matchAt(context, at);
    if (found === null) {
      at += 1;
    } else {
      pieces.push(text.slice(copied, at), found.kept);
      copied = found.end;
      at = found.end;
    }
  }
  pieces.push(text.slice(copied));
  return pieces.join('');
}

/** One whitespace character, as \s reads it. */
const SPACE = /\s/;
/** One word character, as \w reads it. */
const WORD = /\w/;
/** What `.` will not take: a line's end. */
const LINE_END = /[\n\r\u2028\u2029]/;

/** \S: a character, and not whitespace. */
export const notSpace: Takes = (char) => char !== '' && !SPACE.test(char);
/** \w. */
export const isWordCharacter: Takes = (char) => WORD.test(char);
/** `.`: anything on the line. */
export const onTheLine: Takes = (char) => !LINE_END.test(char);
/** [\s\S]: anything at all. */
export const anything: Takes = () => true;
