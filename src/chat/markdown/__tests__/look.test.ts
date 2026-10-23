// How Auto's markdown is dressed (OT-C8), from the look's tokens only: each mark's face (bold,
// italic always a bundled italic face, since iOS never slants an upright one; the mono face for
// code at the text's size, no ground), a link's paint, the heading faces a step above the
// thread's 16 pt words (D72), the gap between blocks (closer inside a list item), list markers (a
// task item's box), the code block's widest line, and table columns sized from their longest line.

import { describe, expect, it } from 'vitest';

import { FONT_FACES } from '../../../styles/fonts';
import { tokensFor } from '../../../styles/tokens';
import { STUDIO_TYPE, MIN_TEXT_SIZE, TYPE_SPECS, type TypeRole } from '../../../styles/type';
import { MARKDOWN_COPY } from '../../strings';
import type { Cell } from '../blocks';
import type { InlineMark, Span } from '../inline';
import { textFace, textRole } from '../../../ui/variants';
import {
  CODE_BLOCK_MAX_WIDTH,
  CODE_BLOCK_ROLE,
  TABLE_COLUMNS,
  STRONG_WEIGHT,
  blockGap,
  columnWidths,
  headingFace,
  listMarker,
  monoFace,
  spanStyle,
} from '../look';

const { colours, type } = tokensFor('studio', 'light');
const DARK = tokensFor('studio', 'dark').colours;

const cell = (words: string): Cell => [{ kind: 'text', text: words, marks: [], href: null }];

/** The bundled face a style's fontFamily names (its PostScript name), if any. */
const faceNamed = (fontFamily: unknown) =>
  [...FONT_FACES.values()].find((face) => face.postscriptName === fontFamily);

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

  it('draws italic in a bundled italic face (iOS never slants an upright one), no hint on top', () => {
    // Newsreader (titles) bundles 400 and 500 italic; Geist (body) bundles none: the serif's
    expect(spanStyle(type, colours, 'title4', ['em'], false)).toMatchObject({
      fontFamily: 'Newsreader16pt16pt-MediumItalic',
      fontSize: STUDIO_TYPE.title4.fontSize,
    });
    expect(spanStyle(type, colours, 'body1', ['em'], false)).toMatchObject({
      fontFamily: 'Newsreader16pt16pt-Italic',
      fontSize: STUDIO_TYPE.body1.fontSize,
      lineHeight: STUDIO_TYPE.body1.lineHeight,
    });
    // bold and italic together: the nearest bundled italic weight, never an upright face
    expect(spanStyle(type, colours, 'body1', ['strong', 'em'], false)?.fontFamily).toBe(
      'Newsreader16pt16pt-MediumItalic',
    );
    expect(spanStyle(type, colours, 'title4', ['strong', 'em'], false)?.fontFamily).toBe(
      'Newsreader16pt16pt-MediumItalic',
    );
  });

  it('gives every role a face that really is italic for em, with or without bold', () => {
    const roles = Object.keys(TYPE_SPECS) as TypeRole[];
    const markSets: InlineMark[][] = [['em'], ['strong', 'em'], ['em', 'del']];
    for (const role of roles) {
      for (const marks of markSets) {
        const style = spanStyle(type, colours, role, marks, false);
        expect(faceNamed(style?.fontFamily)?.style, `${role} ${marks.join('+')}`).toBe('italic');
        expect(style?.fontStyle, role).toBeUndefined();
        expect(style?.fontSize, role).toBe(STUDIO_TYPE[role].fontSize);
      }
    }
  });

  it('draws code in the look’s mono face at the text’s size, with no ground behind it', () => {
    const style = spanStyle(type, colours, 'body1', ['code'], false);
    expect(style).toMatchObject({
      fontFamily: 'GeistMono-Regular',
      fontSize: STUDIO_TYPE.body1.fontSize,
      letterSpacing: 0,
    });
    expect(style?.backgroundColor).toBeUndefined();
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

  it('caps a code block’s width under the iOS layer limit (16,384 px at 3x)', () => {
    const SCREEN_SCALE = 3;
    const TEXTURE_LIMIT_PX = 16_384;
    expect(CODE_BLOCK_MAX_WIDTH * SCREEN_SCALE).toBeLessThan(TEXTURE_LIMIT_PX);
    // still wide enough that ordinary code scrolls sideways rather than wraps
    expect(CODE_BLOCK_MAX_WIDTH).toBeGreaterThan(200 * 8);
  });
});

describe('blockGap', () => {
  it('sets the answer’s blocks 12 pt apart, and 6 inside a list item, so a sub-list sits with it', () => {
    expect(blockGap(0)).toBe('space5');
    expect([1, 2, 3].map(blockGap)).toEqual(['space2', 'space2', 'space2']);
    const { spacing } = tokensFor('studio', 'dark');
    expect([spacing[blockGap(0)], spacing[blockGap(1)]]).toEqual([12, 6]);
  });
});

describe('headings', () => {
  const levels = [1, 2, 3, 4, 5, 6] as const;

  it('draw h1 and h2 on the thread’s titles, h3 to h6 as the thread’s words at 600 (D72)', () => {
    expect(levels.map(headingFace)).toEqual([
      { variant: 'thread', level: 1 },
      { variant: 'thread', level: 2 },
      { variant: 'thread', weight: STRONG_WEIGHT },
      { variant: 'thread', weight: STRONG_WEIGHT },
      { variant: 'thread', weight: STRONG_WEIGHT },
      { variant: 'thread', weight: STRONG_WEIGHT },
    ]);
    expect(STRONG_WEIGHT).toBe(600);
  });

  it('run h1 > h2 > the thread’s 16 pt words, and h3 is the words in semibold', () => {
    const size = (level: (typeof levels)[number]) => {
      const face = headingFace(level);
      return STUDIO_TYPE[textRole(face.variant, face.level)].fontSize;
    };
    expect(size(1)).toBeGreaterThan(size(2));
    expect(size(2)).toBeGreaterThan(STUDIO_TYPE.thread.fontSize);
    expect(size(3)).toBe(STUDIO_TYPE.thread.fontSize);
    // a step above the words, as the web's chat (18 and 16 px serif over 16 px): never a page title
    expect([size(1), size(2)]).toEqual([19, 17]);
    const face = (level: 1 | 2) => STUDIO_TYPE[textRole('thread', level)].fontFamily;
    expect([face(1), face(2)]).toEqual(['Newsreader16pt16pt-Medium', 'Newsreader16pt16pt-Medium']);
    expect(STUDIO_TYPE.thread.fontSize).toBe(16);
    expect(textFace(type, 'thread', { weight: 600 }).fontFamily).toBe('Geist-SemiBold');
  });

  it('keeps a minor heading’s 600 on a run that is not bold (an italic or a link in an h3)', () => {
    const italic = spanStyle(type, colours, 'thread', ['em'], false, 600);
    expect(faceNamed(italic?.fontFamily)).toMatchObject({ style: 'italic', weight: 500 });
    const link = spanStyle(type, colours, 'thread', [], true, 600);
    expect(link?.fontFamily).toBe('Geist-SemiBold');
    // without the block's weight a plain link is the role's own face
    expect(spanStyle(type, colours, 'thread', [], true)?.fontFamily).toBe('Geist-Regular');
  });
});

describe('listMarker', () => {
  it('numbers from the list’s start', () => {
    const list = { ordered: true, start: 3 };
    expect([0, 1, 2].map((index) => listMarker(list, index, 0))).toEqual(['3.', '4.', '5.']);
  });

  it('draws a task item’s box, ticked or not, in place of its bullet or number', () => {
    const bulleted = { ordered: false, start: 1 };
    expect(listMarker(bulleted, 0, 0, true)).toBe(MARKDOWN_COPY.taskMarks.done);
    expect(listMarker(bulleted, 1, 2, false)).toBe(MARKDOWN_COPY.taskMarks.open);
    expect(listMarker({ ordered: true, start: 1 }, 0, 0, false)).toBe(MARKDOWN_COPY.taskMarks.open);
    expect(MARKDOWN_COPY.taskMarks.done).not.toBe(MARKDOWN_COPY.taskMarks.open);
    expect([MARKDOWN_COPY.taskWords(true), MARKDOWN_COPY.taskWords(false)]).toEqual([
      'Done',
      'Not done',
    ]);
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
    expect(columnWidths({ header: [cell('')], rows: [] }, 1, padding)).toEqual([TABLE_COLUMNS.min]);
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
