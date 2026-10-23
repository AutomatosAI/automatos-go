// How Auto's markdown is dressed (OT-C8), from the look's tokens only: each mark's face (bold,
// italic or its hint, the mono face for code at the text's size), a link's and code's paint, the
// heading scale, list markers, and table columns sized from their longest line.

import { describe, expect, it } from 'vitest';

import { tokensFor } from '../../../styles/tokens';
import { STUDIO_TYPE, MIN_TEXT_SIZE } from '../../../styles/type';
import { MARKDOWN_COPY } from '../../strings';
import type { Cell } from '../blocks';
import type { Span } from '../inline';
import {
  CODE_BLOCK_ROLE,
  TABLE_COLUMNS,
  columnWidths,
  headingTextLevel,
  listMarker,
  monoFace,
  spanStyle,
} from '../look';

const { colours, type } = tokensFor('studio', 'light');
const DARK = tokensFor('studio', 'dark').colours;

const cell = (words: string): Cell => [{ kind: 'text', text: words, marks: [], href: null }];

describe('spanStyle', () => {
  it('leaves plain words to the block', () => {
    expect(spanStyle(type, colours, 'body1', [], false)).toBeNull();
  });

  it('draws bold in the role’s family at 600, the role’s size kept', () => {
    const style = spanStyle(type, colours, 'body1', ['strong'], false);
    expect(style?.fontFamily).toBe('Geist-SemiBold');
    expect(style?.fontSize).toBe(STUDIO_TYPE.body1.fontSize);
    expect(style?.lineHeight).toBe(STUDIO_TYPE.body1.lineHeight);
  });

  it('draws italic in a bundled italic face, else the upright face with the italic hint', () => {
    // Newsreader (titles) bundles 500 italic; Geist (body) bundles no italic
    expect(spanStyle(type, colours, 'title4', ['em'], false)).toMatchObject({
      fontFamily: 'Newsreader16pt16pt-MediumItalic',
    });
    expect(spanStyle(type, colours, 'title4', ['em'], false)?.fontStyle).toBeUndefined();
    expect(spanStyle(type, colours, 'body1', ['em'], false)).toMatchObject({
      fontFamily: 'Geist-Regular',
      fontStyle: 'italic',
    });
  });

  it('keeps bold when bold and italic have no face together', () => {
    expect(spanStyle(type, colours, 'body1', ['strong', 'em'], false)).toMatchObject({
      fontFamily: 'Geist-SemiBold',
      fontStyle: 'italic',
    });
    expect(spanStyle(type, colours, 'title4', ['strong', 'em'], false)).toMatchObject({
      fontFamily: 'Newsreader16pt16pt-SemiBold',
      fontStyle: 'italic',
    });
  });

  it('draws code in the look’s mono face at the text’s size, on the secondary ground', () => {
    const style = spanStyle(type, colours, 'body1', ['code'], false);
    expect(style).toMatchObject({
      fontFamily: 'GeistMono-Regular',
      fontSize: STUDIO_TYPE.body1.fontSize,
      letterSpacing: 0,
      backgroundColor: colours.secondary,
    });
    expect(style?.textTransform).toBeUndefined();
    expect(spanStyle(type, colours, 'body1', ['strong', 'code'], false)?.fontFamily).toBe(
      'GeistMono-SemiBold',
    );
  });

  it('paints a link in the accent, underlined; struck words through', () => {
    expect(spanStyle(type, colours, 'body1', [], true)).toMatchObject({
      color: colours.accent,
      textDecorationLine: 'underline',
    });
    expect(spanStyle(type, DARK, 'body1', [], true)?.color).toBe(DARK.accent);
    expect(spanStyle(type, colours, 'body1', ['del'], false)?.textDecorationLine).toBe(
      'line-through',
    );
    expect(spanStyle(type, colours, 'body1', ['del'], true)?.textDecorationLine).toBe(
      'underline line-through',
    );
  });
});

describe('monoFace', () => {
  it('is the code block’s mono face at Body 4, never under the 11 pt floor, no caps', () => {
    const face = monoFace(type, CODE_BLOCK_ROLE);
    expect(face).toEqual({
      fontFamily: 'GeistMono-Regular',
      fontSize: STUDIO_TYPE.body4.fontSize,
      lineHeight: STUDIO_TYPE.body4.lineHeight,
      letterSpacing: 0,
    });
    expect(face.fontSize).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
  });
});

describe('headings', () => {
  it('sit on the thread’s Title scale, h1 largest, h4 to h6 at Title 6', () => {
    expect([1, 2, 3, 4, 5, 6].map((level) => headingTextLevel(level as 1))).toEqual([
      3, 4, 5, 6, 6, 6,
    ]);
  });
});

describe('listMarker', () => {
  it('numbers from the list’s start', () => {
    const list = { ordered: true, start: 3 };
    expect([0, 1, 2].map((index) => listMarker(list, index, 0))).toEqual(['3.', '4.', '5.']);
  });

  it('bullets by depth, cycling past the last shape', () => {
    const list = { ordered: false, start: 1 };
    const [first, second, third] = MARKDOWN_COPY.bullets;
    expect([0, 1, 2, 3].map((depth) => listMarker(list, 0, depth))).toEqual([
      first,
      second,
      third,
      first,
    ]);
  });
});

describe('columnWidths', () => {
  const padding = 8;

  it('sizes each column from its longest line, padded on both sides', () => {
    const widths = columnWidths(
      { header: [cell('Doc'), cell('Owner')], rows: [[cell('plan-for-november.md'), cell('Ge')]] },
      1,
      padding,
    );
    expect(widths).toEqual([
      Math.round(20 * TABLE_COLUMNS.glyphWidth + padding * 2),
      TABLE_COLUMNS.min,
    ]);
  });

  it('keeps a column between the narrowest and the widest, grown with Dynamic Type', () => {
    const long: Cell = cell('x'.repeat(400));
    expect(columnWidths({ header: [long], rows: [] }, 1, padding)).toEqual([TABLE_COLUMNS.max]);
    expect(columnWidths({ header: [long], rows: [] }, 2, padding)).toEqual([TABLE_COLUMNS.max * 2]);
    expect(columnWidths({ header: [cell('')], rows: [] }, 1, padding)).toEqual([
      TABLE_COLUMNS.min,
    ]);
  });

  it('measures a cell with a line break by its longest line', () => {
    const broken: Span[] = [
      { kind: 'text', text: 'short', marks: [], href: null },
      { kind: 'break' },
      { kind: 'text', text: 'a much longer line', marks: ['strong'], href: null },
    ];
    expect(columnWidths({ header: [broken], rows: [] }, 1, 0)).toEqual([
      Math.round(18 * TABLE_COLUMNS.glyphWidth),
    ]);
  });

  it('treats a nonsense font scale as 1', () => {
    const table = { header: [cell('Owner of the plan')], rows: [] };
    expect(columnWidths(table, Number.NaN, padding)).toEqual(columnWidths(table, 1, padding));
    expect(columnWidths(table, 0, padding)).toEqual(columnWidths(table, 1, padding));
  });
});
