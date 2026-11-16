// A question's words as the server puts them in a push (the signed `question`), made here from the
// question's markdown the same way, so a notification Reply's server check compares like with like
// (confirm-sender.ts). In order: the first QUESTION_SCAN_MAX_CHARS characters are read, CRLF becomes
// LF; a code fence's own line goes (its code stays); a picture becomes its alt text and a link its
// label (a target may hold one level of brackets); inline code loses its backticks; a heading's
// hashes, a quote's mark and a list item's bullet go from the start of a line; an emphasis pair (one
// star or underscore, never inside a word, never around spaces), a bold pair of stars and a struck
// pair of tildes lose their marks; each line's runs of spaces and tabs become one space and the line
// is trimmed; three or more line breaks become two, and the whole is trimmed. A text longer than
// QUESTION_MAX_CHARS, or a markdown longer than was read, is cut and ends with an ellipsis. Nothing
// else is touched: a character inside a word, a ">" or a "-" in a line, stays. Trimming is by the
// server's whitespace (Python's str.isspace), not JavaScript's. A word character is a letter, a
// number or "_". No lookbehind (not used anywhere on the phone): the character before an emphasis
// pair is matched and put back. Pure.

import { PUSH_ELLIPSIS, PUSH_QUESTION_MAX_CHARS, PUSH_QUESTION_SCAN_MAX_CHARS } from '../config';

/** Python's whitespace (str.isspace): JavaScript's \s without U+FEFF, with U+001C to U+001F and U+0085. */
const SPACE =
  '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const EDGE_SPACE = new RegExp(`^[${SPACE}]+|[${SPACE}]+$`, 'g');
const TRAILING_SPACE = new RegExp(`[${SPACE}]+$`);

const TARGET = String.raw`\((?:[^()\n]|\([^()\n]*\))*\)`;

/** The marks the server takes out, in its order: [pattern, what is kept]. */
const RULES: readonly (readonly [RegExp, string])[] = Object.freeze([
  [/^[ \t]*(?:```|~~~)[^\n]*$/gm, ''],
  [new RegExp(String.raw`!\[([^\[\]\n]*)\]` + TARGET, 'g'), '$1'],
  [new RegExp(String.raw`\[([^\[\]\n]*)\]` + TARGET, 'g'), '$1'],
  [/`+([^`\n]*)`+/g, '$1'],
  [/^[ \t]*(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+)/gm, ''],
  [/(^|[^\p{L}\p{N}_*])([*_])(?=[^\s*_])([^*_\n]*?[^\s*_])\2(?![\p{L}\p{N}_*])/gu, '$1$3'],
  [/\*\*(?=\S)([^*\n]*?\S)\*\*/g, '$1'],
  [/~~(?=\S)([^~\n]*?\S)~~/g, '$1'],
]);

function strip(text: string): string {
  return text.replace(EDGE_SPACE, '');
}

/** The first `count` characters (code points, as the server counts them). */
function first(text: string, count: number): string {
  return Array.from(text).slice(0, count).join('');
}

function plainText(markdown: string): string {
  let text = first(markdown, PUSH_QUESTION_SCAN_MAX_CHARS).replace(/\r\n/g, '\n');
  for (const [pattern, kept] of RULES) text = text.replace(pattern, kept);
  const lines = text.split('\n').map((line) => strip(line.replace(/[ \t]+/g, ' ')));
  return strip(lines.join('\n').replace(/\n{3,}/g, '\n\n'));
}

/** The words the server would sign for this markdown; null when nothing is left. */
export function questionWords(markdown: string): string | null {
  const text = plainText(markdown);
  const unread = strip(Array.from(markdown).slice(PUSH_QUESTION_SCAN_MAX_CHARS).join(''));
  if (Array.from(text).length <= PUSH_QUESTION_MAX_CHARS && !unread) return text || null;
  const kept = first(text, PUSH_QUESTION_MAX_CHARS - Array.from(PUSH_ELLIPSIS).length);
  return kept.replace(TRAILING_SPACE, '') + PUSH_ELLIPSIS;
}
