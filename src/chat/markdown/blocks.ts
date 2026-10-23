// Auto's answer as blocks, pure (OT-C8, decided by Gerard 23 Oct: markdown through marked's lexer
// and the app's own renderer). marked (GFM on, a single newline kept as a line break, as the
// thread drew it before) lexes the text; this module turns its tokens into an immutable view-model
// the components only draw: paragraphs, headings, lists (ordered or not, nested, a task item with
// its box ticked or not), fenced or indented code, GFM tables, quotes and rules, each holding inline
// spans (inline.ts). It never throws and never loses words: a token it does not know is its raw text, a
// lexer failure is one paragraph of the raw text, and a reply still streaming (an unclosed '**', a
// half-written table, an unclosed fence) reads as what marked makes of it so far.

import { Lexer, getDefaults, type MarkedOptions, type Token, type Tokens } from 'marked';

import {
  LINE_BREAK_TAG,
  childrenOf,
  inlineSpans,
  plainSpans,
  rawOf,
  spansText,
  textOf,
  type Span,
} from './inline';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type CellAlign = 'left' | 'center' | 'right' | null;
/** A table cell: its inline spans. */
export type Cell = readonly Span[];

export type ListItem = {
  readonly blocks: readonly Block[];
  /** A task item's box ('- [x]' true, '- [ ]' false); null for an item that is not a task. */
  readonly checked: boolean | null;
};

export type ParagraphBlock = { readonly kind: 'paragraph'; readonly spans: readonly Span[] };
export type HeadingBlock = {
  readonly kind: 'heading';
  readonly level: HeadingLevel;
  readonly spans: readonly Span[];
};
export type ListBlock = {
  readonly kind: 'list';
  readonly ordered: boolean;
  /** The first item's number (an ordered list may start at 3); 1 for a bulleted list. */
  readonly start: number;
  readonly items: readonly ListItem[];
};
export type CodeBlock = {
  readonly kind: 'code';
  readonly lang: string | null;
  readonly text: string;
};
export type TableBlock = {
  readonly kind: 'table';
  readonly align: readonly CellAlign[];
  readonly header: readonly Cell[];
  /** Every row has exactly as many cells as the header. */
  readonly rows: readonly (readonly Cell[])[];
};
export type QuoteBlock = { readonly kind: 'quote'; readonly blocks: readonly Block[] };
export type RuleBlock = { readonly kind: 'rule' };

export type Block =
  ParagraphBlock | HeadingBlock | ListBlock | CodeBlock | TableBlock | QuoteBlock | RuleBlock;

/** Lists and quotes nest this deep; anything deeper reads as its raw text. */
export const MAX_NESTING = 8;
/** Past this size the answer is not lexed: its paragraphs read as plain words (as before OT-C8). */
export const MAX_MARKDOWN_CHARS = 60_000;

const RULE: RuleBlock = Object.freeze({ kind: 'rule' });
const PARAGRAPH_BREAK = /\n{2,}/;
const MAX_HEADING = 6;

/** Fresh options per lex: marked's Lexer writes its tokenizer onto the options it is given. */
export function lexOptions(): MarkedOptions {
  return { ...getDefaults(), gfm: true, breaks: true, silent: false };
}

// ── blocks ──────────────────────────────────────────────────────────────────────────────────

function paragraph(spans: readonly Span[]): Block[] {
  return spansText(spans).trim() ? [{ kind: 'paragraph', spans }] : [];
}

function rawParagraph(token: Token): Block[] {
  return paragraph(plainSpans(rawOf(token).trim()));
}

function headingLevel(depth: unknown): HeadingLevel {
  const level = typeof depth === 'number' && Number.isFinite(depth) ? Math.trunc(depth) : 1;
  return Math.min(Math.max(level, 1), MAX_HEADING) as HeadingLevel;
}

function heading(token: Token): Block[] {
  const spans = inlineSpans(childrenOf(token));
  if (!spansText(spans).trim()) return [];
  return [{ kind: 'heading', level: headingLevel((token as Tokens.Heading).depth), spans }];
}

function code(token: Token): Block[] {
  const lang = (token as Tokens.Code).lang;
  const name = typeof lang === 'string' ? lang.trim().split(/\s+/)[0] : '';
  return [{ kind: 'code', lang: name || null, text: textOf(token) }];
}

function alignOf(value: unknown): CellAlign {
  return value === 'left' || value === 'center' || value === 'right' ? value : null;
}

function cellOf(cell: unknown): Cell {
  const tokens = (cell as { tokens?: unknown } | null)?.tokens;
  return Array.isArray(tokens) ? inlineSpans(tokens as Token[]) : [];
}

/** A row cut or padded to the header's width (marked does this too; a stray row never breaks). */
function rowOf(row: unknown, width: number): Cell[] {
  const cells = Array.isArray(row) ? row.slice(0, width).map(cellOf) : [];
  return [...cells, ...Array.from({ length: width - cells.length }, (): Cell => [])];
}

function table(token: Token): Block[] {
  const { header, rows, align } = token as Partial<Tokens.Table>;
  if (!Array.isArray(header) || header.length === 0) return rawParagraph(token);
  const width = header.length;
  return [
    {
      kind: 'table',
      align: Array.from({ length: width }, (_, index) => alignOf(align?.[index])),
      header: header.map(cellOf),
      rows: (Array.isArray(rows) ? rows : []).map((row) => rowOf(row, width)),
    },
  ];
}

/** A task item's box (marked's task and checked); null for an item that is not a task. */
function checkedOf(item: Partial<Tokens.ListItem>): boolean | null {
  return item.task === true ? item.checked === true : null;
}

function list(token: Token, depth: number): Block[] {
  const { items, ordered, start } = token as Partial<Tokens.List>;
  const numbered = ordered === true;
  return [
    {
      kind: 'list',
      ordered: numbered,
      start: numbered && typeof start === 'number' && Number.isFinite(start) ? start : 1,
      items: (Array.isArray(items) ? items : []).map((item) => ({
        blocks: blocksOf(childrenOf(item as Token), depth + 1),
        checked: checkedOf(item),
      })),
    },
  ];
}

function quote(token: Token, depth: number): Block[] {
  return [{ kind: 'quote', blocks: blocksOf(childrenOf(token), depth + 1) }];
}

/** A text token's inline tokens when marked lexed them, else the token itself (its words). */
function textChildren(token: Token): readonly Token[] {
  const children = childrenOf(token);
  return children.length > 0 ? children : [token];
}

/** An HTML block as Auto wrote it, never interpreted; a line of only '<br>' is spacing. */
function htmlBlock(html: string): Block[] {
  return LINE_BREAK_TAG.test(html) ? [] : paragraph(plainSpans(html));
}

type BlockHandler = (token: Token, depth: number) => Block[];

/** A list or quote, unless it nests past MAX_NESTING: then its raw text. */
const nested =
  (build: BlockHandler): BlockHandler =>
  (token, depth) =>
    depth >= MAX_NESTING ? rawParagraph(token) : build(token, depth);

const BLOCKS: ReadonlyMap<string, BlockHandler> = new Map<string, BlockHandler>([
  ['space', () => []],
  // a link reference definition is not shown: its links already carry its address
  ['def', () => []],
  // a task item's box: the list draws it as the item's marker (ListItem.checked)
  ['checkbox', () => []],
  ['paragraph', (token) => paragraph(inlineSpans(childrenOf(token)))],
  // a tight list item's words: inline tokens when marked lexed them, else its text
  ['text', (token) => paragraph(inlineSpans(textChildren(token)))],
  ['heading', heading],
  ['code', code],
  ['table', table],
  ['blockquote', nested(quote)],
  ['list', nested(list)],
  ['hr', () => [RULE]],
  ['html', (token) => htmlBlock(textOf(token).trim())],
]);

function blocksOf(tokens: readonly Token[], depth: number): Block[] {
  return tokens.flatMap((token) => {
    const handler = BLOCKS.get(token.type);
    return handler ? handler(token, depth) : rawParagraph(token);
  });
}

/** Top-level tokens as blocks, in order (a token may make none); lex.ts lexes a reply as it grows. */
export function tokenBlocks(tokens: readonly Token[]): Block[] {
  return blocksOf(tokens, 0);
}

/** Plain paragraphs, split on blank lines: an answer too long to lex. */
function plainParagraphs(text: string): Block[] {
  return text.split(PARAGRAPH_BREAK).flatMap((part) => paragraph(plainSpans(part.trim())));
}

/**
 * Auto's answer as blocks. Empty or blank text is no blocks; anything marked cannot lex, or any
 * failure turning its tokens into blocks, is one paragraph of the raw text: this never throws.
 */
export function markdownBlocks(markdown: string): readonly Block[] {
  if (typeof markdown !== 'string' || !markdown.trim()) return [];
  if (markdown.length > MAX_MARKDOWN_CHARS) return plainParagraphs(markdown);
  try {
    return blocksOf(Lexer.lex(markdown, lexOptions()), 0);
  } catch {
    return paragraph(plainSpans(markdown.trim()));
  }
}
