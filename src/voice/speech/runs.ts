// The cuts in Auto's reply that read it once (pure): where a sentence's terminator is, the word
// before it, a heading's closing hashes and a table's separator row. Each answers exactly as the
// pattern it replaced did; those patterns started again at every character of a long run (a reply
// of a thousand dots, or a line of spaces) and grew with the square of it. The reply is text the
// server chooses, and sentences.ts and speakable.ts read it again at every streamed update.

import { runEnd, runStart } from '../../lib/text-runs';

/** A sentence's terminator as found: where it starts, and its marks with any closers after them. */
export type Terminator = Readonly<{ index: number; text: string }>;

const TERMINATORS: ReadonlySet<string> = new Set(['.', '!', '?', '…']);
const CLOSERS: ReadonlySet<string> = new Set(['"', "'", '”', '’', ')', ']']);
/** One whitespace character, as \s reads it. */
const SPACE = /\s/;
/** A character that is not part of the word before a terminator (whitespace, an opener). */
const BEFORE_A_WORD = /[\s(“"'‘[]/;
/** One cell of a separator row: three hyphens at least, a colon at either end for alignment. */
const SEPARATOR_CELL = /^:?-{3,}:?$/;
const PIPE = '|';
const HASH = '#';

const isSpace = (char: string) => SPACE.test(char);
const isTerminator = (char: string) => TERMINATORS.has(char);
const isCloser = (char: string) => CLOSERS.has(char);
const inAWord = (char: string) => !BEFORE_A_WORD.test(char);
const isHash = (char: string) => char === HASH;

/**
 * Every run of . ! ? … (then any closing quotes or brackets) that whitespace follows, or the end of
 * the text when atTextEnd is set: the matches /[.!?…]+["'”’)\]]*(?=\s)/g (or (?=\s|$)) found.
 */
export function terminatorsIn(text: string, atTextEnd: boolean): readonly Terminator[] {
  const found: Terminator[] = [];
  let at = runEnd(text, 0, (char) => !isTerminator(char));
  while (at < text.length) {
    const end = runEnd(text, runEnd(text, at, isTerminator), isCloser);
    const ended = end === text.length ? atTextEnd : isSpace(text.charAt(end));
    if (ended) found.push(Object.freeze({ index: at, text: text.slice(at, end) }));
    at = runEnd(text, end, (char) => !isTerminator(char));
  }
  return found;
}

/** The word that ends at `index`, '' when none does: what /[^\s(“"'‘[]+$/ found before it. */
export function wordBefore(text: string, index: number): string {
  return text.slice(runStart(text, index, inAWord), index);
}

/** A heading's text without its closing hashes: text.replace(/\s+#+\s*$/, ''). */
export function withoutClosingHashes(text: string): string {
  const hashesEnd = runStart(text, text.length, isSpace);
  const hashesStart = runStart(text, hashesEnd, isHash);
  const spaceStart = runStart(text, hashesStart, isSpace);
  const closed = hashesStart < hashesEnd && spaceStart < hashesStart;
  return closed ? text.slice(0, spaceStart) : text;
}

const isMark = (char: string) => char === '*' || char === '_';
const notMark = (char: string) => !isMark(char);
/** What may follow a word's stray marks: whitespace or a mark of punctuation. */
const ENDS_A_WORD = /[\s.,!?;:…]/;

/**
 * A word's stray '*' and '_' at its end taken out ('word**.' says 'word.'): what
 * /(\S)[*_]+(?=[\s.,!?;:…]|$)/g → '$1' gave. A run of marks followed by whitespace, punctuation or the
 * end goes, kept only for the one character the pattern took before it: the character before the
 * run, or the run's own first mark when whitespace or the start of the text is before it. The
 * pattern tried the rest of a long run from each of its marks: the square of the run.
 */
export function withoutMarksEndingWords(text: string): string {
  const pieces: string[] = [];
  let copied = 0;
  for (let start = runEnd(text, 0, notMark); start < text.length;) {
    const end = runEnd(text, start, isMark);
    const next = text.charAt(end);
    const kept = start > 0 && !isSpace(text.charAt(start - 1)) ? start : start + 1;
    if ((next === '' || ENDS_A_WORD.test(next)) && end > kept) {
      pieces.push(text.slice(copied, kept));
      copied = end;
    }
    start = runEnd(text, end, notMark);
  }
  pieces.push(text.slice(copied));
  return pieces.join('');
}

/**
 * A table's separator row, '| --- | :--: |': cells between pipes, each three hyphens or more with a
 * colon at either end, a pipe at either end of the row or not. What
 * /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/ took.
 */
export function isSeparatorRow(line: string): boolean {
  const row = line.trim();
  const cells = row.split(PIPE);
  const first = row.startsWith(PIPE) ? 1 : 0;
  const last = row.endsWith(PIPE) ? cells.length - 1 : cells.length;
  const inner = cells.slice(first, last);
  return inner.length > 0 && inner.every((cell) => SEPARATOR_CELL.test(cell.trim()));
}
