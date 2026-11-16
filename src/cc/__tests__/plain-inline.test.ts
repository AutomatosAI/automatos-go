// A question's or a Deliverable's markdown in plain words (src/cc/questions/plain.ts): its links,
// images, strong and struck words are taken out in one pass (src/lib/inline-links.ts,
// inline-pairs.ts), answering exactly as the patterns they replaced, on ordinary lines and on
// thousands of short random ones full of markers (unclosed, nested, overlapping, at the ends, empty,
// across lines); and a megabyte of opening markers with no close grows the work with its length, not
// with its square. The old patterns are kept here only as the oracle.

import { describe, expect, it } from 'vitest';

import {
  GROWTH_FACTOR,
  LINEAR_GROWTH_LIMIT,
  growth,
  randomTexts,
} from '../../lib/__tests__/growth';
import { IMAGE, LINK, replaceLinks } from '../../lib/inline-links';
import { replacePairs } from '../../lib/inline-pairs';
import { PLAIN_PAIRS, plainInline, plainParagraphs } from '../questions/plain';

const OLD_IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
const OLD_LINK = /\[([^\]]+)\]\([^)]*\)/g;
const OLD_STRONG = /(\*\*|__)(?=\S)([\s\S]*?\S)\1/g;
const OLD_STRIKE = /~~(?=\S)([\s\S]*?\S)~~/g;

/** plainInline as it was before the single passes. */
function oldInline(line: string): string {
  return line
    .replace(OLD_IMAGE, '$1')
    .replace(OLD_LINK, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(OLD_STRONG, '$2')
    .replace(/\*(?=\S)([^*\n]*?\S)\*/g, '$1')
    .replace(/(^|\W)_(?=\S)([^_\n]*?\S)_(?=\W|$)/g, '$1$2')
    .replace(OLD_STRIKE, '$1');
}

const LINES = [
  '**bold** and __bold__ and ~~struck~~, *em* and _em_',
  '**unclosed and __also ~~too',
  '**a *b* c**',
  '**a __b** c__',
  '****',
  '*****',
  '** **',
  '~~~~~',
  '~~a~~~',
  '**at the end**',
  '**x**y**z**',
  'a**b**c',
  '**across\nlines**',
  '~~across\nlines~~',
  '__snake_case__',
  '![alt](a.png) [words](https://x.example) [unclosed](',
  '[a][b](c)',
  '![](x)',
  '[](x)',
  '[a]x(b)',
  '![a',
  '[a](b',
  '[[a]](b)',
  '',
];

const MARKS = '*_~ a\n';
const LINKS = '[]()!a \n';

describe('strong and struck words: as /(\\*\\*|__)(?=\\S)([\\s\\S]*?\\S)\\1/g and /~~…~~/g', () => {
  it('on ordinary lines and thousands of short random ones', () => {
    for (const text of [...LINES, ...randomTexts(MARKS, 6000, 16)]) {
      expect(replacePairs(text, PLAIN_PAIRS.strong)).toBe(text.replace(OLD_STRONG, '$2'));
      expect(replacePairs(text, PLAIN_PAIRS.struck)).toBe(text.replace(OLD_STRIKE, '$1'));
    }
  });
});

describe('links and images: as /\\[([^\\]]+)\\]\\([^)]*\\)/g and /!\\[([^\\]]*)\\]\\([^)]*\\)/g', () => {
  it('on ordinary lines and thousands of short random ones', () => {
    for (const text of [...LINES, ...randomTexts(LINKS, 6000, 14)]) {
      expect(replaceLinks(text, IMAGE)).toBe(text.replace(OLD_IMAGE, '$1'));
      expect(replaceLinks(text, LINK)).toBe(text.replace(OLD_LINK, '$1'));
    }
  });
});

describe('a whole line, every rule in its order', () => {
  it('reads as it did, on ordinary lines and thousands of short random ones', () => {
    for (const text of [...LINES, ...randomTexts('*_~[]()!`a \n', 6000, 16)]) {
      expect(plainInline(text)).toBe(oldInline(text));
    }
  });
});

describe(`a megabyte of opening markers with no close (under ${LINEAR_GROWTH_LIMIT}x for ${GROWTH_FACTOR}x)`, () => {
  const SIZE = 131_072; // GROWTH_FACTOR times this is a megabyte
  const openers = (unit: string, take: (text: string) => unknown) => (size: number) => {
    const text = unit.repeat(Math.ceil(size / unit.length));
    return () => take(text);
  };

  it.each([
    ['**', '**a '],
    ['__', '__a '],
  ])('grows with a line of %s openers', (_marker, unit) => {
    const hostile = openers(unit, (text) => replacePairs(text, PLAIN_PAIRS.strong));
    expect(growth(hostile, SIZE)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });

  it('grows with a line of ~~ openers', () => {
    const hostile = openers('~~a ', (text) => replacePairs(text, PLAIN_PAIRS.struck));
    expect(growth(hostile, SIZE)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });

  it.each([['![a]('], ['![a'], ['[a]('], ['[a']])('grows with a line of %s', (unit) => {
    const hostile = openers(unit, (text) => replaceLinks(replaceLinks(text, IMAGE), LINK));
    expect(growth(hostile, SIZE)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });

  it("grows with a Deliverable's text of openers, through plainParagraphs", () => {
    const hostile = openers('**a ~~b [c]( ', (text) => plainParagraphs(text));
    expect(growth(hostile, SIZE)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });
});
