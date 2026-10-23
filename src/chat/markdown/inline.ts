// Auto's inline markdown as flat spans, pure (OT-C8): marked's inline tokens (text, strong, em,
// codespan, del, link, br, and what else may sit in a line) become runs of words, each carrying
// every mark around it and the link it opens. Flat, not a tree, because the phone draws a mark
// with a font face: bold inside italic is one face (Geist 600 italic, or its nearest), not two
// nested styles that would undo each other. HTML stays its literal text, never interpreted; an
// image is its alt text, never fetched (the web's Play rule for untrusted model output); a token
// this module does not know is its raw text, so no words ever vanish. Nothing here throws on a
// malformed token: each field is read defensively.

import type { Token } from 'marked';

export type InlineMark = 'strong' | 'em' | 'del' | 'code';

export type TextSpan = {
  readonly kind: 'text';
  readonly text: string;
  /** Every mark on these words, in MARK_ORDER, each once. */
  readonly marks: readonly InlineMark[];
  /** The link these words open, as Auto wrote it; null for words that are not a link. */
  readonly href: string | null;
};

/** A line break inside a block (a single newline in Auto's text keeps its line). */
export type BreakSpan = { readonly kind: 'break' };

export type Span = TextSpan | BreakSpan;

export const MARK_ORDER: readonly InlineMark[] = Object.freeze(['strong', 'em', 'del', 'code']);

type Frame = { readonly marks: readonly InlineMark[]; readonly href: string | null };

const PLAIN: Frame = Object.freeze({ marks: [], href: null });
const BREAK: BreakSpan = Object.freeze({ kind: 'break' });

// ── reading a token defensively ─────────────────────────────────────────────────────────────

type Loose = { readonly [field: string]: unknown };

const fieldOf = (token: Token, field: string): unknown => (token as unknown as Loose)[field];

export function textOf(token: Token): string {
  const text = fieldOf(token, 'text');
  return typeof text === 'string' ? text : '';
}

export function rawOf(token: Token): string {
  const raw = fieldOf(token, 'raw');
  return typeof raw === 'string' ? raw : textOf(token);
}

export function childrenOf(token: Token): readonly Token[] {
  const children = fieldOf(token, 'tokens');
  return Array.isArray(children) ? (children as Token[]) : [];
}

function hrefOf(token: Token): string | null {
  const href = fieldOf(token, 'href');
  return typeof href === 'string' && href.trim() ? href.trim() : null;
}

// ── character references ────────────────────────────────────────────────────────────────────

/** U+00A0, written as a number so the source holds no invisible character. */
const NO_BREAK_SPACE = 0xa0;
const ENTITY = /&(amp|lt|gt|quot|apos|nbsp|#\d{1,7}|#x[0-9a-f]{1,6});/gi;
const NAMED: Readonly<Record<string, string>> = Object.freeze({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: String.fromCharCode(NO_BREAK_SPACE),
});
const MAX_CODE_POINT = 0x10ffff;
const SURROGATES = { low: 0xd800, high: 0xdfff } as const;
const HEX = 16;
const DECIMAL = 10;

function codePointText(reference: string): string | null {
  const hex = reference.startsWith('#x');
  const value = Number.parseInt(reference.slice(hex ? 2 : 1), hex ? HEX : DECIMAL);
  const surrogate = value >= SURROGATES.low && value <= SURROGATES.high;
  return value > 0 && value <= MAX_CODE_POINT && !surrogate ? String.fromCodePoint(value) : null;
}

/**
 * The few character references a model writes (&amp;, &lt;, &#39;, …) as their characters; any
 * other '&' stays as written. Text only: a code span keeps its characters exactly.
 */
export function decodeEntities(text: string): string {
  return text.replace(ENTITY, (whole: string, name: string) => {
    const lower = name.toLowerCase();
    const decoded = lower.startsWith('#') ? codePointText(lower) : NAMED[lower];
    return decoded ?? whole;
  });
}

// ── tokens to spans ─────────────────────────────────────────────────────────────────────────

function words(text: string, frame: Frame): Span[] {
  return text ? [{ kind: 'text', text, marks: frame.marks, href: frame.href }] : [];
}

/** Plain words as one span (a cell, an HTML block, a fallback): nothing parsed. */
export function plainSpans(text: string): Span[] {
  return words(text, PLAIN);
}

function withMark(frame: Frame, mark: InlineMark): Frame {
  if (frame.marks.includes(mark)) return frame;
  const marks = MARK_ORDER.filter((each) => each === mark || frame.marks.includes(each));
  return { ...frame, marks };
}

type InlineHandler = (token: Token, frame: Frame) => Span[];

const markedWith =
  (mark: InlineMark): InlineHandler =>
  (token, frame) =>
    spansOf(childrenOf(token), withMark(frame, mark));

const INLINE: ReadonlyMap<string, InlineHandler> = new Map<string, InlineHandler>([
  [
    'text',
    (token, frame) =>
      childrenOf(token).length > 0
        ? spansOf(childrenOf(token), frame)
        : words(decodeEntities(textOf(token)), frame),
  ],
  ['escape', (token, frame) => words(textOf(token), frame)],
  ['strong', markedWith('strong')],
  ['em', markedWith('em')],
  ['del', markedWith('del')],
  ['codespan', (token, frame) => words(textOf(token), withMark(frame, 'code'))],
  ['br', () => [BREAK]],
  [
    'link',
    (token, frame) => spansOf(childrenOf(token), { ...frame, href: frame.href ?? hrefOf(token) }),
  ],
  // an image is never fetched: a URL loaded with no click could carry the chat to any host
  ['image', (token, frame) => words(textOf(token), frame)],
  // HTML is shown as Auto wrote it, never interpreted
  ['html', (token, frame) => words(textOf(token), frame)],
  // a task item's box: the item reads as plain words
  ['checkbox', () => []],
]);

function spanOf(token: Token, frame: Frame): Span[] {
  const handler = INLINE.get(token.type);
  return handler ? handler(token, frame) : words(rawOf(token), frame);
}

function spansOf(tokens: readonly Token[], frame: Frame): Span[] {
  return tokens.flatMap((token) => spanOf(token, frame));
}

function sameLook(a: TextSpan, b: TextSpan): boolean {
  return a.href === b.href && a.marks.join() === b.marks.join();
}

/** Neighbouring words with the same marks and link as one span. */
export function mergeSpans(spans: readonly Span[]): Span[] {
  return spans.reduce<Span[]>((merged, span) => {
    const last = merged.at(-1);
    if (last?.kind === 'text' && span.kind === 'text' && sameLook(last, span)) {
      return [...merged.slice(0, -1), { ...last, text: last.text + span.text }];
    }
    return [...merged, span];
  }, []);
}

/** A block's inline tokens as spans: words, marks, links and line breaks. */
export function inlineSpans(tokens: readonly Token[]): Span[] {
  return mergeSpans(spansOf(tokens, PLAIN));
}

/** The words of some spans, a line break as a newline (table widths, tests). */
export function spansText(spans: readonly Span[]): string {
  return spans.map((span) => (span.kind === 'break' ? '\n' : span.text)).join('');
}

/** The same spans in bold (a table's header row). */
export function strongSpans(spans: readonly Span[]): Span[] {
  return spans.map((span) =>
    span.kind === 'text' ? { ...span, marks: withMark(span, 'strong').marks } : span,
  );
}
