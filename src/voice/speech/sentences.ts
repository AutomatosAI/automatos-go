// Auto's reply sentence by sentence as it streams (KV6, US-019d), so the voice starts before the
// turn ends. Pure: no React, React Native or Expo. Fed the speakable text so far (toSpeakable), not
// deltas.
//   A sentence ends at . ! ? or … (a run of them, then any closing quote or bracket) followed by
//   whitespace. push() never ends one at the end of the text so far: the next token may make 3. into
//   3.5 or e. into e.g.; flush() (the turn finished) hands over the rest.
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

const TERMINATOR = /[.!?…]+["'”’)\]]*(?=\s)/g;
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
 * which the next update may take back (a stray '-' that becomes a list item).
 */
function sentenceEnds(text: string): readonly number[] {
  return [...text.matchAll(TERMINATOR)]
    .filter((match) => endsSentence(text, match.index, match[0]))
    .map((match) => match.index + match[0].length);
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

export function sentenceChunker(): SentenceChunker {
  let seen = '';
  /** Where each sentence already handed over ends in `seen`. */
  let ends: readonly number[] = [];

  const consumed = (): number => ends[ends.length - 1] ?? 0;

  function push(textSoFar: string): readonly string[] {
    const handedOver = consumed();
    if (textSoFar.slice(0, handedOver) !== seen.slice(0, handedOver)) {
      const common = commonPrefixLength(seen, textSoFar);
      ends = ends.filter((end) => end <= common);
    }
    seen = textSoFar;
    const start = consumed();
    const found = sentenceEnds(textSoFar.slice(start)).map((end) => start + end);
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
