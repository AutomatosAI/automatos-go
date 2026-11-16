// A question's markdown shown as plain text with its paragraphs (US-012a): no markdown renderer on
// the phone, so the marks are taken out and the words kept. Paragraphs are split on blank lines;
// inside one, list items keep their line and a bullet, headings and quotes their words, links and
// images their text, emphasis and code their contents. Fenced code keeps its lines, unfenced.

import { IMAGE, LINK, replaceLinks } from '../../lib/inline-links';
import { anything, notSpace, replacePairs, type PairRule } from '../../lib/inline-pairs';

const BLANK_LINES = /\n[ \t]*\n+/;
const FENCE = /^\s*(```|~~~)/;
const HEADING = /^\s{0,3}#{1,6}\s+/;
const QUOTE = /^\s{0,3}>\s?/;
const BULLET = /^(\s*)[-*+]\s+/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
// Links, images, strong and struck words are taken out in one pass (src/lib/inline-links.ts and
// inline-pairs.ts): /!\[([^\]]*)\]\([^)]*\)/g, /\[([^\]]+)\]\([^)]*\)/g,
// /(\*\*|__)(?=\S)([\s\S]*?\S)\1/g and /~~(?=\S)([\s\S]*?\S)~~/g read on from every unclosed
// marker to the end, the square of a megabyte of openers. The two emphasis patterns stop at the next
// marker of their own and stay.
const STRONG: PairRule = Object.freeze({
  markers: ['**', '__'],
  first: notSpace,
  holds: anything,
  last: notSpace,
});
const STRIKE: PairRule = Object.freeze({
  markers: ['~~'],
  first: notSpace,
  holds: anything,
  last: notSpace,
});
/** The two pair rules, for their tests. */
export const PLAIN_PAIRS = Object.freeze({ strong: STRONG, struck: STRIKE });
const EMPHASIS_STAR = /\*(?=\S)([^*\n]*?\S)\*/g;
/** _word_ only when the underscores stand at word edges: snake_case stays as written. */
const EMPHASIS_UNDERSCORE = /(^|\W)_(?=\S)([^_\n]*?\S)_(?=\W|$)/g;
const CODE = /`([^`\n]+)`/g;
const BULLET_MARK = '• ';

/** A line's links, code, strong, emphasis and struck words taken out, their words kept. */
export function plainInline(line: string): string {
  const linked = replaceLinks(replaceLinks(line, IMAGE), LINK).replace(CODE, '$1');
  const emphasised = replacePairs(linked, STRONG)
    .replace(EMPHASIS_STAR, '$1')
    .replace(EMPHASIS_UNDERSCORE, '$1$2');
  return replacePairs(emphasised, STRIKE);
}

function plainLine(line: string): string | null {
  if (FENCE.test(line) || RULE.test(line)) return null;
  const unquoted = line.replace(QUOTE, '').replace(HEADING, '');
  return plainInline(unquoted.replace(BULLET, `$1${BULLET_MARK}`)).trimEnd();
}

/** One paragraph's lines without their marks, or null when nothing is left. */
function plainParagraph(block: string): string | null {
  const lines = block
    .split('\n')
    .map(plainLine)
    .filter((line): line is string => line !== null && line.trim() !== '');
  return lines.length ? lines.join('\n').trim() : null;
}

/** The question's paragraphs as plain text; blank markdown has none. */
export function plainParagraphs(markdown: string | null | undefined): string[] {
  const text = (markdown ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) return [];
  return text
    .split(BLANK_LINES)
    .map(plainParagraph)
    .filter((paragraph): paragraph is string => paragraph !== null);
}
