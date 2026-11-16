// A Deliverable's file name and its text are what the server chooses (the text up to a megabyte):
// viewerFileName and monoParagraphs trim them in one read, answering exactly as the patterns they
// replaced did (/^[.-]+|[.-]+$/g, /[ \t]+$/gm, /^\n+|\n+$/g), on ordinary names and texts and on
// thousands of short random ones, while their work grows with the input, not with its square.
// The old functions are kept here only as the oracle.

import { describe, expect, it } from 'vitest';

import {
  GROWTH_FACTOR,
  LINEAR_GROWTH_LIMIT,
  growth,
  randomTexts,
} from '../../lib/__tests__/growth';
import { monoParagraphs } from '../deliverables/detail';
import type { ViewerFormat } from '../deliverables/file-kind';
import { viewerFileName } from '../deliverables/file-source';

/** viewerFileName as it was before the single pass. */
function oldViewerFileName(name: string | null | undefined, format: ViewerFormat): string {
  const base = (name ?? '').split('/').pop() ?? '';
  const stem = base.toLowerCase().endsWith(`.${format}`) ? base.slice(0, -format.length - 1) : base;
  const safe = stem
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 96);
  return `${safe || 'deliverable'}.${format}`;
}

/** monoParagraphs as it was before the single pass. */
function oldMonoParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((block) => block.replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, ''))
    .filter((block) => block.trim() !== '');
}

const FORMATS: readonly ViewerFormat[] = ['pdf', 'docx', 'xlsx'];

describe("the viewer copy's name: as /^[.-]+|[.-]+$/g trimmed it", () => {
  it('on ordinary names and short random ones', () => {
    const names = [
      'Q3 report.pdf',
      '../../etc/passwd',
      '.hidden.docx',
      '-draft-.xlsx',
      '...',
      'a.b.c',
      'résumé final (2).pdf',
      '',
      null,
      undefined,
    ];
    for (const format of FORMATS) {
      for (const name of [...names, ...randomTexts('a.-_ /é?P', 1500, 14)]) {
        expect(viewerFileName(name, format)).toBe(oldViewerFileName(name, format));
      }
    }
  });

  it(`grows with a run of dots, not with its square (under ${LINEAR_GROWTH_LIMIT}x for ${GROWTH_FACTOR}x)`, () => {
    const hostile = (size: number) => () => viewerFileName(`a${'.'.repeat(size)}a`, 'pdf');
    expect(growth(hostile, 20_000)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });
});

describe("a file's text in paragraphs: as /[ \\t]+$/gm and /^\\n+|\\n+$/g trimmed it", () => {
  it('on ordinary texts and short random ones', () => {
    const texts = [
      'line one   \nline two\t\n\n\nnext block  ',
      'a \r\nb \r\n\r\nc',
      'x \u2028y \u2029z ',
      '\n\n  \n',
      '',
    ];
    for (const text of [...texts, ...randomTexts('a \t\n\r\u2028x', 4000, 14)]) {
      expect(monoParagraphs(text)).toEqual(oldMonoParagraphs(text));
    }
  });

  it('grows with a run of spaces inside a line, not with its square', () => {
    const hostile = (size: number) => () => monoParagraphs(`a${' '.repeat(size)}b`);
    expect(growth(hostile, 20_000)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });
});
