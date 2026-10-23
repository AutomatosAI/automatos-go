// Auto's answer lexed as it streams, pure (OT-C8). A reply grows a few characters a frame; lexing
// all of it every frame costs time that grows with the square of its length. A top-level block that
// ends before a blank line, with a later block begun after it, is settled: text added at the end
// cannot change it (a blank line closes a paragraph, a table, a quote or an HTML block; a list
// goes on past one only for an indented line or another item, which its first character already
// shows, except a number still being written: '2' may yet be '2.', so a block of only digits is
// never where the settled part ends). Without the blank line a block is not settled: the next one
// may only interrupt it until its own first line is done ('```' opens a fence, '```x`' does not).
// Each lex keeps the settled part (its text and its blocks, the same objects frame after frame, so
// the components skip drawing them again) and the next text that starts with it lexes only from
// there.
//
// The result is always what markdownBlocks makes of the whole text; lex.test.ts streams answers a
// character at a time to prove it. Where marked carries something from one block to the next, the
// whole text is lexed instead: a link reference definition (it names links anywhere in the
// answer), and an <a>, <pre>, <code>, <kbd> or <script> tag (marked's inline state crosses blocks).
// Anything unexpected (the lexed lengths do not add up, a throw) lexes the whole text too.

import { Lexer, type Token, type TokensList } from 'marked';

import { MAX_MARKDOWN_CHARS, lexOptions, markdownBlocks, tokenBlocks, type Block } from './blocks';

/** The part of an answer no later text can change: its text and its blocks. */
type Settled = { readonly text: string; readonly blocks: readonly Block[] };

export type MarkdownLex = {
  /** The answer's blocks: always equal to markdownBlocks of the same text. */
  readonly blocks: readonly Block[];
  /** What the next lex may start from; null: the next text is lexed whole. */
  readonly settled: Settled | null;
};

const LINE_ENDS = /\r\n?/g;
/** A block of only digits so far: it may yet be an ordered item of the list above it. */
const NUMBER_SO_FAR = /^[ \t]*\d{1,9}\s*$/;
/** Tags whose state marked carries from one block's words into the next block's. */
const CARRIED_TAG = /<\/?(?:a|pre|code|kbd|script)(?:[\s/>]|$)/i;
const NOTHING: MarkdownLex = Object.freeze({ blocks: [], settled: null });
const START: Settled = Object.freeze({ text: '', blocks: [] });

function rawLength(tokens: readonly Token[]): number {
  return tokens.reduce(
    (total, token) => total + (typeof token.raw === 'string' ? token.raw.length : Number.NaN),
    0,
  );
}

/** Lexing from here on its own reads as the whole text would: no definitions, every character. */
function standsAlone(tokens: TokensList, source: string): boolean {
  const links: unknown = tokens.links;
  const defined = typeof links === 'object' && links !== null && Object.keys(links).length > 0;
  return !defined && rawLength(tokens) === source.length;
}

/** The line before `end` in `text` is blank (only spaces or tabs, after a line of its own). */
function blankLineBefore(text: string, end: number): boolean {
  if (end < 2 || text[end - 1] !== '\n') return false;
  const lineStart = text.lastIndexOf('\n', end - 2) + 1;
  return lineStart > 0 && text.slice(lineStart, end - 1).trim() === '';
}

/**
 * The first token not settled: the latest block start after a blank line, the last block itself
 * included unless it is only a number so far (trailing space is no block). 0: nothing new settles.
 */
function settledCount(tail: string, tokens: readonly Token[]): number {
  let offset = rawLength(tokens);
  let last = true;
  for (let index = tokens.length - 1; index > 0; index -= 1) {
    const token = tokens[index];
    offset -= token.raw.length;
    if (token.type === 'space') continue;
    const number = last && NUMBER_SO_FAR.test(token.raw);
    last = false;
    if (!number && blankLineBefore(tail, offset)) return index;
  }
  return 0;
}

/** `tail`'s tokens after what was settled: the answer's blocks and what is settled now. */
function settle(before: Settled, tail: string, tokens: readonly Token[]): MarkdownLex {
  const cut = settledCount(tail, tokens);
  const firm = tokens.slice(0, cut);
  const settled: Settled =
    firm.length === 0
      ? before
      : {
          text: before.text + tail.slice(0, rawLength(firm)),
          blocks: [...before.blocks, ...tokenBlocks(firm)],
        };
  return {
    blocks: [...settled.blocks, ...tokenBlocks(tokens.slice(cut))],
    settled: CARRIED_TAG.test(settled.text) ? null : settled,
  };
}

/** The whole text lexed; where markdownBlocks would not lex it (too long, a failure), its blocks. */
function lexWhole(markdown: string, text: string): MarkdownLex {
  if (text.length > MAX_MARKDOWN_CHARS) return { blocks: markdownBlocks(markdown), settled: null };
  try {
    const tokens = Lexer.lex(text, lexOptions());
    if (!standsAlone(tokens, text)) return { blocks: tokenBlocks(tokens), settled: null };
    return settle(START, text, tokens);
  } catch {
    return { blocks: markdownBlocks(markdown), settled: null };
  }
}

/**
 * Auto's answer as blocks, lexing only the text after what `previous` settled when the answer has
 * only grown since. Never throws; the blocks always equal markdownBlocks(markdown).
 */
export function lexMarkdown(markdown: string, previous: MarkdownLex | null = null): MarkdownLex {
  if (typeof markdown !== 'string' || !markdown.trim()) return NOTHING;
  const text = markdown.replace(LINE_ENDS, '\n');
  const settled = previous?.settled;
  if (!settled || text.length > MAX_MARKDOWN_CHARS || !text.startsWith(settled.text)) {
    return lexWhole(markdown, text);
  }
  try {
    const tail = text.slice(settled.text.length);
    const tokens = Lexer.lex(tail, lexOptions());
    return standsAlone(tokens, tail) ? settle(settled, tail, tokens) : lexWhole(markdown, text);
  } catch {
    return lexWhole(markdown, text);
  }
}
