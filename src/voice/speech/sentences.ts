// Auto's reply sentence by sentence as it streams (KV6, US-019d), so the voice starts before the
// turn ends. Pure: no React, React Native or Expo. Fed the speakable text so far (toSpeakable), not
// deltas.
//   A sentence ends at . ! ? or … (a run of them, then any closing quote or bracket) followed by
//   whitespace. push() never ends one at the end of the text so far: the next token may make 3. into
//   3.5 or e. into e.g.; flush() (the turn finished) hands over the rest.
//   With endsAtTextEnd (voice latency E-11) a terminator at the end of the text so far ends one too.
//   Only for text that arrives in whole units (a spokenMode turn from a server that lists
//   'spoken_unit_ends'), where the server has already committed to that end. Off by default.
//   With firstUnitMinChars (voice latency E-5) the reply's first unit may be a lead: the start of a
//   first sentence known to be longer than firstUnitWholeMaxChars, cut at its first clause mark
//   (, ; : followed by whitespace) from firstUnitMinChars in, leaving more than
//   firstUnitMinRestChars. Only the first unit, never at a bare space, and only for Auto's server
//   voice (reply-feed.ts), where a short first request is heard sooner. Off by default.
//   A single '.' after an abbreviation (Mr., Dr., e.g., i.e., a.m.) or an initial (J. R. R.) is not an
//   end; decimals (3.5), versions (2.0.8) and ticket numbers (#0419) carry no '.' before whitespace.
//   Nothing is emitted twice. When the text shrinks or changes before what was already handed over
//   (A2 retracting narration), the chunker keeps the sentences that still stand in the common prefix
//   and carries on from there.

export type SentenceChunker = {
  /** The complete sentences new since the last push. */
  readonly push: (textSoFar: string) => readonly string[];
  /** The rest, once the turn has finished: at most one sentence. */
  readonly flush: () => readonly string[];
};

/** How a chunker cuts. Every default is today's behaviour: sentences that whitespace has confirmed. */
export type ChunkerOptions = {
  /** A terminator at the end of the text so far ends a sentence. Default false. */
  readonly endsAtTextEnd?: boolean;
  /** E-5. The first unit may end at a clause mark at least this many characters in. Default 0: sentences only. */
  readonly firstUnitMinChars?: number;
  /** E-5. A first sentence up to this long is never cut. */
  readonly firstUnitWholeMaxChars?: number;
  /** E-5. What is left of the sentence after a lead is at least this long. */
  readonly firstUnitMinRestChars?: number;
};

const TERMINATOR = /[.!?…]+["'”’)\]]*(?=\s)/g;
/** The same, or the terminator is the last thing in the text so far. */
const TERMINATOR_OR_END = /[.!?…]+["'”’)\]]*(?=\s|$)/g;
/** A clause mark with whitespace after it, so `3,` can still become `3,500`. Never a bare space. */
const CLAUSE = /[,;:]["'”’)\]]*(?=\s)/g;
const RUN = /^[.!?…]+/;
const WORD_BEFORE = /[^\s(“"'‘[]+$/;
/** A dotted abbreviation: e.g, i.e, a.m, U.S (the last '.' is the terminator's). */
const DOTTED = /^(?:\p{L}\.)+\p{L}$/u;
/** One letter: an initial. */
const INITIAL = /^\p{L}$/u;
/** Something a voice can say: a letter or a digit. */
const SAYABLE = /[\p{L}\p{N}]/u;

const ABBREVIATIONS: ReadonlySet<string> = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'vs',
  'cf',
  'approx',
  'e.g',
  'i.e',
]);

/** A lone '.' after an abbreviation or an initial does not end the sentence. */
function endsSentence(text: string, index: number, terminator: string): boolean {
  if (RUN.exec(terminator)?.[0] !== '.') return true;
  const word = (WORD_BEFORE.exec(text.slice(0, index))?.[0] ?? '').toLowerCase();
  return !(ABBREVIATIONS.has(word) || DOTTED.test(word) || INITIAL.test(word));
}

/**
 * Where each sentence of the text ends: right after its terminator, not the whitespace after it,
 * which the next update may take back (a stray '-' that becomes a list item). atTextEnd: a terminator
 * that ends the text counts too; an abbreviation or an initial there is still not an end.
 */
function sentenceEnds(text: string, atTextEnd = false): readonly number[] {
  return [...text.matchAll(atTextEnd ? TERMINATOR_OR_END : TERMINATOR)]
    .filter((match) => endsSentence(text, match.index, match[0]))
    .map((match) => match.index + match[0].length);
}

/** The first unit's limits (voice latency E-5); min 0: the first unit is a sentence, as ever. */
type FirstUnit = { readonly min: number; readonly wholeMax: number; readonly minRest: number };

function firstUnitOf(options: ChunkerOptions): FirstUnit {
  return {
    min: options.firstUnitMinChars ?? 0,
    wholeMax: options.firstUnitWholeMaxChars ?? 0,
    minRest: options.firstUnitMinRestChars ?? 0,
  };
}

/**
 * Where the first unit may end at a clause mark, as an offset in `body` (the text since the last
 * recorded end); null: no lead (yet). Lengths are counted from body's first non-whitespace
 * character. A cut is made only in a sentence known to be longer than wholeMax (its end is past
 * wholeMax, or no end has come and the text already is), and never past wholeMax - minRest, so the
 * rest is always longer than minRest whether the sentence arrived whole or word by word. The
 * sentence's end is a candidate: a terminator at the end of the text counts here whatever
 * endsAtTextEnd is, and one that turns out not to be an end (3. into 3.5) only delays the cut by a
 * push.
 */
function leadEnd(body: string, { min, wholeMax, minRest }: FirstUnit): number | null {
  if (min <= 0) return null;
  const lead = body.length - body.trimStart().length;
  const firstEnd = sentenceEnds(body, true)[0];
  const known = firstEnd === undefined ? body.trimEnd().length : firstEnd;
  if (known - lead <= wholeMax) return null;
  const cut = [...body.matchAll(CLAUSE)]
    .map((match) => match.index + match[0].length)
    .find((end) => end - lead >= min && end - lead <= wholeMax - minRest);
  return cut ?? null;
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) index += 1;
  return index;
}

function sayable(sentence: string): boolean {
  return SAYABLE.test(sentence);
}

export function sentenceChunker(options: ChunkerOptions = {}): SentenceChunker {
  const atTextEnd = options.endsAtTextEnd === true;
  const firstUnit = firstUnitOf(options);
  let seen = '';
  /** Where each sentence already handed over ends in `seen`. */
  let ends: readonly number[] = [];

  const consumed = (): number => ends[ends.length - 1] ?? 0;

  /** The ends new in `body`: its sentence ends, led by a lead's end while nothing is handed over. */
  function newEnds(body: string): readonly number[] {
    const found = sentenceEnds(body, atTextEnd);
    const lead = ends.length === 0 ? leadEnd(body, firstUnit) : null;
    return lead === null ? found : [lead, ...found.filter((end) => end > lead)];
  }

  function push(textSoFar: string): readonly string[] {
    const handedOver = consumed();
    if (textSoFar.slice(0, handedOver) !== seen.slice(0, handedOver)) {
      const common = commonPrefixLength(seen, textSoFar);
      ends = ends.filter((end) => end <= common);
    }
    seen = textSoFar;
    const start = consumed();
    const found = newEnds(textSoFar.slice(start)).map((end) => start + end);
    const sentences = found
      .map((end, index) => textSoFar.slice(found[index - 1] ?? start, end).trim())
      .filter(sayable);
    ends = [...ends, ...found];
    return sentences;
  }

  function flush(): readonly string[] {
    const rest = seen.slice(consumed()).trim();
    ends = [...ends, seen.length];
    return sayable(rest) ? [rest] : [];
  }

  return Object.freeze({ push, flush });
}
