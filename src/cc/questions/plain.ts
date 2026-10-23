// A question's markdown shown as plain text with its paragraphs (US-012a): no markdown renderer on
// the phone, so the marks are taken out and the words kept. Paragraphs are split on blank lines;
// inside one, list items keep their line and a bullet, headings and quotes their words, links and
// images their text, emphasis and code their contents. Fenced code keeps its lines, unfenced.

const BLANK_LINES = /\n[ \t]*\n+/;
const FENCE = /^\s*(```|~~~)/;
const HEADING = /^\s{0,3}#{1,6}\s+/;
const QUOTE = /^\s{0,3}>\s?/;
const BULLET = /^(\s*)[-*+]\s+/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
const LINK = /\[([^\]]+)\]\([^)]*\)/g;
const STRONG = /(\*\*|__)(?=\S)([\s\S]*?\S)\1/g;
const EMPHASIS_STAR = /\*(?=\S)([^*\n]*?\S)\*/g;
/** _word_ only when the underscores stand at word edges: snake_case stays as written. */
const EMPHASIS_UNDERSCORE = /(^|\W)_(?=\S)([^_\n]*?\S)_(?=\W|$)/g;
const STRIKE = /~~(?=\S)([\s\S]*?\S)~~/g;
const CODE = /`([^`\n]+)`/g;
const BULLET_MARK = '• ';

function inline(line: string): string {
  return line
    .replace(IMAGE, '$1')
    .replace(LINK, '$1')
    .replace(CODE, '$1')
    .replace(STRONG, '$2')
    .replace(EMPHASIS_STAR, '$1')
    .replace(EMPHASIS_UNDERSCORE, '$1$2')
    .replace(STRIKE, '$1');
}

function plainLine(line: string): string | null {
  if (FENCE.test(line) || RULE.test(line)) return null;
  const unquoted = line.replace(QUOTE, '').replace(HEADING, '');
  return inline(unquoted.replace(BULLET, `$1${BULLET_MARK}`)).trimEnd();
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
