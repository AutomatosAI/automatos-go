// Test support: a word's advance width in ems from a TrueType font's own tables (the Windows
// Unicode BMP cmap, format 4, and hmtx), so a test can measure a bundled face without a renderer.
// Kerning is left out; a pixel face like Pixelify Sans spaces by advance alone.

type Tables = Readonly<Record<string, number>>;

function tables(font: Buffer): Tables {
  const count = font.readUInt16BE(4);
  const entries = Array.from({ length: count }, (_, index) => {
    const at = 12 + index * 16;
    return [font.toString('latin1', at, at + 4), font.readUInt32BE(at + 8)] as const;
  });
  return Object.fromEntries(entries);
}

/** The format 4 subtable for platform 3, encoding 1 (Windows, Unicode BMP). */
function unicodeMap(font: Buffer, cmap: number): number {
  const count = font.readUInt16BE(cmap + 2);
  const record = Array.from({ length: count }, (_, index) => cmap + 4 + index * 8).find(
    (at) => font.readUInt16BE(at) === 3 && font.readUInt16BE(at + 2) === 1,
  );
  if (record === undefined) throw new Error('the font has no Unicode BMP cmap');
  return cmap + font.readUInt32BE(record + 4);
}

function glyphOf(font: Buffer, map: number, code: number): number {
  const segments = font.readUInt16BE(map + 6) / 2;
  const ends = map + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;
  const segment = Array.from({ length: segments }, (_, index) => index).find(
    (index) => code <= font.readUInt16BE(ends + index * 2),
  );
  if (segment === undefined || code < font.readUInt16BE(starts + segment * 2)) return 0;
  const delta = font.readInt16BE(deltas + segment * 2);
  const range = font.readUInt16BE(ranges + segment * 2);
  if (range === 0) return (code + delta) & 0xffff;
  const offset =
    ranges + segment * 2 + range + (code - font.readUInt16BE(starts + segment * 2)) * 2;
  const glyph = font.readUInt16BE(offset);
  return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
}

/** The word's width in ems: the sum of its glyphs' advances over the font's units per em. */
export function advanceEm(font: Buffer, word: string): number {
  const at = tables(font);
  const unitsPerEm = font.readUInt16BE(at.head + 18);
  const metrics = font.readUInt16BE(at.hhea + 34);
  const map = unicodeMap(font, at.cmap);
  const units = [...word].reduce((sum, char) => {
    const glyph = Math.min(glyphOf(font, map, char.codePointAt(0) ?? 0), metrics - 1);
    return sum + font.readUInt16BE(at.hmtx + glyph * 4);
  }, 0);
  return units / unitsPerEm;
}
