// How Auto's markdown is dressed, pure (OT-C8): every value comes from the look's tokens (its type
// scale and colours), so Studio, Play and HUD each dress it their own way and nothing here names a
// colour or a font family. A span's face: bold is the role's family at 600; italic is always a
// bundled italic face, because iOS never slants an upright custom face (React Native's iOS font
// lookup keeps the upright face when the family has no italic, and an italic hint does nothing):
// the role's own family's italic at the nearest weight where it has one (Newsreader for titles),
// else the serif family's (the body's Geist bundles none; the handoff's own italic is the serif's,
// as in 'Auto is working…'), at the role's size. Code is the look's mono face (its label role's
// family at 400, or 600 in bold) at the surrounding text's size, with no ground behind it: a
// ground on a run of words paints a block the line's full height on iOS (Gerard, 23 Oct: no boxes
// in Auto's text). Headings sit on the thread's scale (body is 14 pt), a list says its marker (a
// task item its box), and a table's columns are sized from their longest line, then scroll.

import type { TextStyle } from 'react-native';

import {
  TYPE_FAMILIES,
  fontFace,
  type FontFace,
  type FontFamily,
  type FontWeight,
} from '../../styles/fonts';
import type { Colours } from '../../styles/tokens';
import { TYPE_SPECS, type TypeRole, type TypeScale } from '../../styles/type';
import { textFace, type TextLevel } from '../../ui/variants';
import { MARKDOWN_COPY } from '../strings';
import type { HeadingLevel, ListBlock, TableBlock } from './blocks';
import { spansText, type InlineMark } from './inline';

export const STRONG_WEIGHT: FontWeight = 600;
const CODE_WEIGHT: FontWeight = 400;
/** The look's mono family is its label role's (Studio: Geist Mono). */
const MONO_ROLE: TypeRole = 'label';
/** A code block's size: Body 4 (12.5 pt). */
export const CODE_BLOCK_ROLE: TypeRole = 'body4';
/**
 * The widest a code block's lines grow (points) before they wrap. A code block scrolls sideways,
 * but iOS draws a text into one layer, and a layer wider than the GPU's texture limit (16,384 px)
 * draws blank: 4,000 pt is 12,000 px at 3x, so a 1,200-character line of minified JSON still shows.
 */
export const CODE_BLOCK_MAX_WIDTH = 4000;
/** A table cell's Body level: Body 3 (13 pt). */
export const TABLE_TEXT_LEVEL: TextLevel = 3;

/** h1 → Title 3 (21 pt), h2 → Title 4 (15), h3 → Title 5 (14.5), h4–h6 → Title 6 (14). */
const HEADING_LEVELS: Readonly<Record<HeadingLevel, TextLevel>> = Object.freeze({
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 6,
  6: 6,
});

export function headingTextLevel(level: HeadingLevel): TextLevel {
  return HEADING_LEVELS[level];
}

const WEIGHTS: readonly FontWeight[] = [400, 500, 600, 700];

/** The family's bundled italic nearest `weight` (the heavier on a tie), or none. */
function nearestItalic(family: FontFamily, weight: FontWeight): FontFace | undefined {
  const byDistance = [...WEIGHTS].sort(
    (a, b) => Math.abs(a - weight) - Math.abs(b - weight) || b - a,
  );
  for (const each of byDistance) {
    const face = fontFace(family, each, 'italic');
    if (face) return face;
  }
  return undefined;
}

/** A bundled italic for a role: its own family's where it has one, else the serif family's. */
export function italicFace(role: TypeRole, weight: FontWeight): FontFace | undefined {
  return (
    nearestItalic(TYPE_FAMILIES[TYPE_SPECS[role].family], weight) ??
    nearestItalic(TYPE_FAMILIES.serif, weight)
  );
}

/** The mono face at a role's size, with none of the label's caps or tracking. */
export function monoFace(type: TypeScale, role: TypeRole, strong = false): TextStyle {
  const mono = textFace(type, MONO_ROLE, { weight: strong ? STRONG_WEIGHT : CODE_WEIGHT });
  const size = type[role];
  return {
    fontFamily: mono.fontFamily,
    fontSize: size.fontSize,
    lineHeight: size.lineHeight,
    letterSpacing: 0,
  };
}

function wordsFace(type: TypeScale, role: TypeRole, marks: readonly InlineMark[]): TextStyle {
  const weight = marks.includes('strong') ? STRONG_WEIGHT : undefined;
  const upright = textFace(type, role, { weight });
  if (!marks.includes('em')) return { ...upright };
  const italic = italicFace(role, weight ?? TYPE_SPECS[role].weight);
  // no fontStyle on top: the face is the italic (on Android a hint can slant an italic file again)
  return italic ? { ...upright, fontFamily: italic.postscriptName } : { ...upright };
}

function decoration(marks: readonly InlineMark[], link: boolean): TextStyle {
  const lines = [link ? 'underline' : null, marks.includes('del') ? 'line-through' : null]
    .filter(Boolean)
    .join(' ');
  return lines ? { textDecorationLine: lines as TextStyle['textDecorationLine'] } : {};
}

/**
 * A run of words inside a block of `role`: its face, its line, and its paint (a link in the
 * accent; code in the mono face alone, no ground). Nothing for plain words: they take the block's.
 */
export function spanStyle(
  type: TypeScale,
  colours: Colours,
  role: TypeRole,
  marks: readonly InlineMark[],
  link: boolean,
): TextStyle | null {
  if (marks.length === 0 && !link) return null;
  const code = marks.includes('code');
  const face = code ? monoFace(type, role, marks.includes('strong')) : wordsFace(type, role, marks);
  return {
    ...face,
    ...decoration(marks, link),
    ...(link ? { color: colours.accent } : {}),
  };
}

/**
 * The marker before a list item: a task item's box (ticked or not), else '1.', '2.' … from the
 * list's start, or a bullet by depth.
 */
export function listMarker(
  list: Pick<ListBlock, 'ordered' | 'start'>,
  index: number,
  depth: number,
  checked: boolean | null = null,
): string {
  if (checked !== null) return MARKDOWN_COPY.taskMarks[checked ? 'done' : 'open'];
  if (list.ordered) return MARKDOWN_COPY.listNumber(list.start + index);
  const bullets = MARKDOWN_COPY.bullets;
  return bullets[Math.max(0, depth) % bullets.length];
}

/** Column sizing: an average glyph at Body 3, and the narrowest and widest a column may be. */
export const TABLE_COLUMNS = Object.freeze({ glyphWidth: 7.5, min: 56, max: 220 });

function longestLine(text: string): number {
  return text.split('\n').reduce((longest, line) => Math.max(longest, line.trim().length), 0);
}

/**
 * Each column's width in points: its longest line at the average glyph width (grown by Dynamic
 * Type's scale), plus the cell's padding on both sides, kept between the narrowest and widest. A
 * table wider than the thread scrolls sideways; a cell longer than the widest column wraps.
 */
export function columnWidths(
  table: Pick<TableBlock, 'header' | 'rows'>,
  fontScale: number,
  cellPadding: number,
): number[] {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const rows = [table.header, ...table.rows];
  return table.header.map((_, column) => {
    const chars = rows.reduce(
      (longest, row) => Math.max(longest, longestLine(spansText(row[column] ?? []))),
      0,
    );
    const width = chars * TABLE_COLUMNS.glyphWidth * scale + cellPadding * 2;
    const widest = TABLE_COLUMNS.max * scale;
    return Math.round(Math.min(Math.max(width, TABLE_COLUMNS.min), widest));
  });
}
