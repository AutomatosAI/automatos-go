// The single passes over Auto's reply (src/voice/speech/runs.ts) answer as the patterns they
// replaced did, on ordinary replies and on thousands of short random ones, and their work grows with
// the reply, not with its square: a reply is text the server chooses, read again at every update.
// The old patterns are kept here only as the oracle.

import { describe, expect, it } from 'vitest';

import {
  GROWTH_FACTOR,
  LINEAR_GROWTH_LIMIT,
  growth,
  randomTexts,
} from '../../lib/__tests__/growth';
import { isSeparatorRow, terminatorsIn, withoutClosingHashes, wordBefore } from '../speech/runs';
import { sentenceChunker } from '../speech/sentences';
import { toSpeakable } from '../speech/speakable';

const OLD_TERMINATOR = /[.!?…]+["'”’)\]]*(?=\s)/g;
const OLD_TERMINATOR_OR_END = /[.!?…]+["'”’)\]]*(?=\s|$)/g;
const OLD_WORD_BEFORE = /[^\s(“"'‘[]+$/;
const OLD_HEADING_CLOSE = /\s+#+\s*$/;
const OLD_TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/;

const oldTerminators = (text: string, atTextEnd: boolean) =>
  [...text.matchAll(atTextEnd ? OLD_TERMINATOR_OR_END : OLD_TERMINATOR)].map((match) => ({
    index: match.index,
    text: match[0],
  }));

const REPLIES = [
  'Hello. World! Is it? Yes… "Quoted." (Aside.) Then e.g. this, i.e. that. 3.5 and 2.0.8 stay.',
  'Mr. Smith met Dr. J. R. R. Tolkien at 9 a.m. today!!! Really?! "Yes."\nNext line. ',
  '“Curly.” ‘Single.’ [Bracket.] end.',
  '...wait... ok. ',
  '',
  'No terminator at all',
];

describe('the terminators: as /[.!?…]+["\'”’)\\]]*(?=\\s|$)/g found them', () => {
  it.each([false, true])('on ordinary replies (at the end of the text: %s)', (atTextEnd) => {
    for (const reply of REPLIES) {
      expect(terminatorsIn(reply, atTextEnd)).toEqual(oldTerminators(reply, atTextEnd));
    }
  });

  it.each([false, true])('on short random texts (at the end of the text: %s)', (atTextEnd) => {
    for (const text of randomTexts('.!?…"”’)] a\n', 3000, 14)) {
      expect(terminatorsIn(text, atTextEnd)).toEqual(oldTerminators(text, atTextEnd));
    }
  });

  it(`grows with a run of dots, not with its square (under ${LINEAR_GROWTH_LIMIT}x for ${GROWTH_FACTOR}x)`, () => {
    for (const atTextEnd of [false, true]) {
      const hostile = (size: number) => () => terminatorsIn(`${'.'.repeat(size)}x`, atTextEnd);
      expect(growth(hostile, 20_000)).toBeLessThan(LINEAR_GROWTH_LIMIT);
    }
  });
});

describe('the word before a terminator: as /[^\\s(“"\'‘[]+$/ found it', () => {
  it('at every place in ordinary replies and short random texts', () => {
    for (const text of [...REPLIES, ...randomTexts('ab .(“"\'‘[\t', 2000, 12)]) {
      for (let index = 0; index <= text.length; index += 1) {
        const old = OLD_WORD_BEFORE.exec(text.slice(0, index))?.[0] ?? '';
        expect(wordBefore(text, index)).toBe(old);
      }
    }
  });

  it('grows with the word, not with its square', () => {
    const hostile = (size: number) => () => wordBefore('a'.repeat(size), size);
    expect(growth(hostile, 20_000)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });
});

describe("a heading's closing hashes: as text.replace(/\\s+#+\\s*$/, '')", () => {
  it('on ordinary headings and short random texts', () => {
    const headings = [
      'Title ##',
      'Title',
      'C# notes',
      'Title #  ',
      'a #b',
      ' #',
      '#',
      '',
      'x\t##\t',
    ];
    for (const text of [...headings, ...randomTexts('# a\t', 3000, 10)]) {
      expect(withoutClosingHashes(text)).toBe(text.replace(OLD_HEADING_CLOSE, ''));
    }
  });

  it('grows with a run of spaces, not with its square', () => {
    const hostile = (size: number) => () => withoutClosingHashes(`a${' '.repeat(size)}b`);
    expect(growth(hostile, 20_000)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });
});

describe("a table's separator row: as /^\\s*\\|?\\s*:?-{3,}:?\\s*(?:\\|…)*\\|?\\s*$/ took it", () => {
  it('on ordinary rows and short random texts', () => {
    const rows = [
      '| --- | :--: | ---: |',
      '|---|---|',
      '---|---',
      ' :--- ',
      '| a | b |',
      '|',
      '||',
      '|---||---|',
      '- - -',
      '| -- |',
      ': ---',
      '',
    ];
    for (const row of [...rows, ...randomTexts('|-----: \ta', 4000, 12)]) {
      expect(isSeparatorRow(row)).toBe(OLD_TABLE_SEPARATOR.test(row));
    }
  });

  it('grows with a run of spaces before or after the cells, not with its square', () => {
    const before = (size: number) => () => isSeparatorRow(`${' '.repeat(size)}x|`);
    const after = (size: number) => () => isSeparatorRow(`|---${' '.repeat(size)}x`);
    expect(growth(before, 20_000)).toBeLessThan(LINEAR_GROWTH_LIMIT);
    expect(growth(after, 20_000)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });
});

describe('a hostile reply, through the chunker and toSpeakable', () => {
  it('grows with the reply, not with its square', () => {
    const dots = (size: number) => () => sentenceChunker().push(`${'.'.repeat(size)}x `);
    const words = (size: number) => () => sentenceChunker().push('Mr. a. '.repeat(size / 7));
    const heading = (size: number) => () => toSpeakable(`# a${' '.repeat(size)}b\n`);
    const table = (size: number) => () => toSpeakable(`a | b\n|---${' '.repeat(size)}x\n`);
    for (const hostile of [dots, words, heading, table]) {
      expect(growth(hostile, 20_000)).toBeLessThan(LINEAR_GROWTH_LIMIT);
    }
  });
});
