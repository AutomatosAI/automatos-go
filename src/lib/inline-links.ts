// Markdown's links taken out of text in one pass, their words kept (pure): [words](address),
// ![words](address), [words][label] and <https://address>. Each answers exactly as the pattern it
// replaced (/\[([^\]]+)\]\([^)]*\)/g and its kin), match for match. Those patterns read on from
// every '[' with no ']' or ')' after it to the end of the text, so a text of nothing but openers took
// the square of its length; a Deliverable's text is up to a megabyte the server chooses. Here the
// next ']', ')' or '>' is looked up in places found once, not read for again.

import { firstPlaceFrom, placesWhere } from './text-runs';

export type LinkRule = Readonly<{
  /** What opens the words: '[' or '!['. */
  open: string;
  /** Whether the words may be empty ([^\]]* rather than [^\]]+). */
  wordless: boolean;
  /** What follows the words' ']': '(' for an address, '[' for a label. */
  second: string;
  /** What closes the address or the label. */
  closer: string;
}>;

/** [words](address): /\[([^\]]+)\]\([^)]*\)/g → '$1'. */
export const LINK: LinkRule = Object.freeze({
  open: '[',
  wordless: false,
  second: '(',
  closer: ')',
});
/** ![words](address): /!\[([^\]]*)\]\([^)]*\)/g → '$1'. */
export const IMAGE: LinkRule = Object.freeze({
  open: '![',
  wordless: true,
  second: '(',
  closer: ')',
});
/** [words][label]: /\[([^\]]+)\]\[[^\]]*\]/g → '$1'. */
export const LABELLED: LinkRule = Object.freeze({
  open: '[',
  wordless: false,
  second: '[',
  closer: ']',
});

const SPACE = /\s/;
const WORDS_END = ']';

/** The text with every link the rule matches replaced by its words. */
export function replaceLinks(text: string, rule: LinkRule): string {
  if (!text.includes(rule.open)) return text;
  const wordsEnds = placesWhere(text, (char) => char === WORDS_END);
  const closers = placesWhere(text, (char) => char === rule.closer);
  const pieces: string[] = [];
  let copied = 0;
  for (let at = text.indexOf(rule.open); at !== -1;) {
    const words = at + rule.open.length;
    const wordsEnd = firstPlaceFrom(wordsEnds, words);
    const fits =
      wordsEnd !== undefined &&
      (rule.wordless || wordsEnd > words) &&
      text.startsWith(rule.second, wordsEnd + 1);
    const close = fits ? firstPlaceFrom(closers, wordsEnd + 1 + rule.second.length) : undefined;
    if (close === undefined || wordsEnd === undefined) {
      at = text.indexOf(rule.open, at + 1);
    } else {
      pieces.push(text.slice(copied, at), text.slice(words, wordsEnd));
      copied = close + 1;
      at = text.indexOf(rule.open, copied);
    }
  }
  pieces.push(text.slice(copied));
  return pieces.join('');
}

/** The schemes an address in <…> may have, in the order the pattern tried them. */
const ANGLE_SCHEMES = ['https://', 'http://', 'mailto:'];

/** Whether `prefix` (ASCII) starts at `at`, letters in either case, as a pattern's /i reads them. */
function startsWithAscii(text: string, prefix: string, at: number): boolean {
  for (let index = 0; index < prefix.length; index += 1) {
    const char = text.charAt(at + index);
    if (char === '' || char.charCodeAt(0) > 0x7f) return false;
    if (char.toLowerCase() !== prefix.charAt(index)) return false;
  }
  return true;
}

/**
 * Every <https://…>, <http://…> or <mailto:…> replaced by `word`: what
 * /<(?:https?:\/\/|mailto:)[^>\s]+>/gi gave.
 */
export function replaceAngleLinks(text: string, word: string): string {
  if (!text.includes('<')) return text;
  const ends = placesWhere(text, (char) => char === '>' || SPACE.test(char));
  const pieces: string[] = [];
  let copied = 0;
  for (let at = text.indexOf('<'); at !== -1;) {
    const scheme = ANGLE_SCHEMES.find((each) => startsWithAscii(text, each, at + 1));
    const address = scheme === undefined ? -1 : at + 1 + scheme.length;
    const end = address < 0 ? undefined : firstPlaceFrom(ends, address);
    if (end === undefined || end === address || text.charAt(end) !== '>') {
      at = text.indexOf('<', at + 1);
    } else {
      pieces.push(text.slice(copied, at), word);
      copied = end + 1;
      at = text.indexOf('<', copied);
    }
  }
  pieces.push(text.slice(copied));
  return pieces.join('');
}
