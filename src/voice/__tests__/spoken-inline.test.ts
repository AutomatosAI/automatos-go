// Auto's reply in words a voice can say (src/voice/speech/speakable.ts): its five paired marks, its
// links and its stray marks at a word's end are taken out in one pass (src/lib/inline-pairs.ts,
// inline-links.ts, speech/runs.ts), answering exactly as the patterns they replaced, on ordinary
// lines and on thousands of short random ones full of markers (unclosed, nested, overlapping, at the
// ends, empty); and a megabyte of opening markers with no close grows the work with its length, not
// with its square. The old patterns are kept here only as the oracle.

import { describe, expect, it } from 'vitest';

import {
  GROWTH_FACTOR,
  LINEAR_GROWTH_LIMIT,
  growth,
  randomTexts,
} from '../../lib/__tests__/growth';
import { IMAGE, LABELLED, LINK, replaceAngleLinks, replaceLinks } from '../../lib/inline-links';
import { replacePairs } from '../../lib/inline-pairs';
import { withoutMarksEndingWords } from '../speech/runs';
import { SPOKEN_PAIRS, stripInline } from '../speech/speakable';
import { SPOKEN_COPY } from '../strings';

const OLD_PAIRS = {
  stars: /\*\*(?=\S)(.*?\S)\*\*/g,
  underscores: /(^|\W)__(?=\S)(.*?\S)__(?!\w)/g,
  tildes: /~~(?=\S)(.*?\S)~~/g,
  star: /(^|[^\w*])\*(?=[^\s*])(.*?[^\s*])\*(?![\w*])/g,
  underscore: /(^|\W)_(?=[^\s_])(.*?[^\s_])_(?!\w)/g,
} as const;
const PAIR_KEPT: Readonly<Record<keyof typeof OLD_PAIRS, string>> = {
  stars: '$1',
  underscores: '$1$2',
  tildes: '$1',
  star: '$1$2',
  underscore: '$1$2',
};
const OLD_LABELLED = /\[([^\]]+)\]\[[^\]]*\]/g;
const OLD_ANGLE = /<(?:https?:\/\/|mailto:)[^>\s]+>/gi;
const OLD_WORD_END_MARKS = /(\S)[*_]+(?=[\s.,!?;:…]|$)/g;

/** stripInline as it was before the single passes. */
const OLD_INLINE: readonly (readonly [RegExp, string])[] = [
  [/!\[([^\]]*)\]\([^)]*\)/g, '$1'],
  [/\[([^\]]+)\]\([^)]*\)/g, '$1'],
  [OLD_LABELLED, '$1'],
  [OLD_ANGLE, SPOKEN_COPY.link],
  [/\b(?:https?:\/\/|www\.)[^\s<>]*[^\s<>.,;:!?'")\]]/gi, SPOKEN_COPY.link],
  [/`([^`]+)`/g, '$1'],
  [OLD_PAIRS.stars, '$1'],
  [OLD_PAIRS.underscores, '$1$2'],
  [OLD_PAIRS.tildes, '$1'],
  [OLD_PAIRS.star, '$1$2'],
  [OLD_PAIRS.underscore, '$1$2'],
  [/\*{2,}|~{2,}|`+/g, ''],
  [/(^|\s)[*_]+(?=\S)/g, '$1'],
  [OLD_WORD_END_MARKS, '$1'],
  [/[[\]]/g, ''],
  [/\|/g, ' '],
];
const oldStrip = (text: string) =>
  OLD_INLINE.reduce((out, [pattern, kept]) => out.replace(pattern, kept), text);

const LINES = [
  '**bold** __bold__ ~~struck~~ *em* _em_ snake_case and 2*3*4',
  '**unclosed __also ~~too *one _two',
  '**a *b* c** and **a __b** c__',
  '****',
  '*****',
  '** **',
  '*a**',
  '_a__',
  '**at the end**',
  'word**. word__, word* ',
  '[words](https://x.example) ![alt](a.png) [label][1] [unclosed](',
  '<https://x.example/a> <HTTP://X> <mailto:a@b.example> <http://> <http://a b> <ftp://x>',
  'www.example.com, then http://a.example/b.',
  '`code` and ``',
  '| a | b |',
  '',
];

/** Short random texts made of these pieces, for the patterns whose markers are words. */
function randomPieces(pieces: readonly string[], count: number, longest: number): string[] {
  const alphabet = pieces.map((_, index) => String.fromCharCode(65 + index)).join('');
  return randomTexts(alphabet, count, longest).map((text) =>
    [...text].map((letter) => pieces[letter.charCodeAt(0) - 65] ?? '').join(''),
  );
}

describe('the five paired marks: as their lazy patterns took them', () => {
  it.each(Object.keys(OLD_PAIRS) as (keyof typeof OLD_PAIRS)[])(
    '%s, on ordinary lines and thousands of short random ones',
    (name) => {
      for (const text of [...LINES, ...randomTexts('*_~ a.\n', 6000, 16)]) {
        const old = text.replace(OLD_PAIRS[name], PAIR_KEPT[name]);
        expect(replacePairs(text, SPOKEN_PAIRS[name])).toBe(old);
      }
    },
  );
});

describe('links, labels, addresses in <…> and the marks at a word’s end: as their patterns did', () => {
  it('on ordinary lines and thousands of short random ones', () => {
    const angles = randomPieces(
      ['<', '>', 'http://', 'HTTPS://', 'mailto:', 'a', ' ', 'httpſ://'],
      6000,
      8,
    );
    for (const text of [...LINES, ...randomTexts('[]()!a \n', 6000, 14), ...angles]) {
      expect(replaceLinks(text, LABELLED)).toBe(text.replace(OLD_LABELLED, '$1'));
      expect(replaceAngleLinks(text, SPOKEN_COPY.link)).toBe(
        text.replace(OLD_ANGLE, SPOKEN_COPY.link),
      );
    }
    for (const text of [...LINES, ...randomTexts('*_ a.…\t,', 6000, 14)]) {
      expect(withoutMarksEndingWords(text)).toBe(text.replace(OLD_WORD_END_MARKS, '$1'));
    }
  });
});

describe('a whole line, every rule in its order', () => {
  it('reads as it did, on ordinary lines and thousands of short random ones', () => {
    for (const text of [...LINES, ...randomTexts('*_~[]()!<>`|a .', 8000, 16)]) {
      expect(stripInline(text)).toBe(oldStrip(text));
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
    ['stars', '**a '],
    ['underscores', ' __a'],
    ['tildes', '~~a '],
    ['star', ' *a '],
    ['underscore', ' _a '],
  ] as const)('grows with a line of %s openers', (name, unit) => {
    const hostile = openers(unit, (text) => replacePairs(text, SPOKEN_PAIRS[name]));
    expect(growth(hostile, SIZE)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });

  it.each([['![a]('], ['[a]('], ['[a]['], ['[a']])('grows with a line of %s', (unit) => {
    const hostile = openers(unit, (text) =>
      replaceLinks(replaceLinks(replaceLinks(text, IMAGE), LINK), LABELLED),
    );
    expect(growth(hostile, SIZE)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });

  it('grows with a line of <http:// openers', () => {
    const hostile = openers('<http://a', (text) => replaceAngleLinks(text, SPOKEN_COPY.link));
    expect(growth(hostile, SIZE)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });

  it('grows with one long run of marks inside a word', () => {
    const hostile = (size: number) => {
      const text = `a${'*'.repeat(size)}b`;
      return () => withoutMarksEndingWords(text);
    };
    expect(growth(hostile, SIZE)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });

  it('grows with a line of every opener, through stripInline', () => {
    const hostile = openers('**a ~~b *c _d [e]( <http://f ', (text) => stripInline(text));
    expect(growth(hostile, SIZE)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });
});
