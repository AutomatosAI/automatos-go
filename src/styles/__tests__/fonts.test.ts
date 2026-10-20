// Reads every bundled TTF with a small sfnt reader (no font dependency) and holds it to the
// FONT_FACES map: a face whose PostScript name drifts from the map renders as the system font
// on iOS, and a file the map does not know is dead weight in the binary.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { FONT_FACES, FONT_FAMILIES, TYPE_FAMILIES, fontFace } from '../fonts';

const FONTS_DIR = path.resolve(__dirname, '../../../assets/fonts');
const SFNT_TRUETYPE = 0x00010000;
const SFNT_APPLE_TRUE = 0x74727565; // 'true'
const NAME_ID_POSTSCRIPT = 6;
const PLATFORM_MAC = 1;
const FS_SELECTION_ITALIC = 0x1;

type TableRecord = { offset: number; length: number };

function readTables(font: Buffer): Map<string, TableRecord> {
  const count = font.readUInt16BE(4);
  const tables = new Map<string, TableRecord>();
  for (let i = 0; i < count; i += 1) {
    const at = 12 + i * 16;
    const tag = font.toString('latin1', at, at + 4);
    tables.set(tag, { offset: font.readUInt32BE(at + 8), length: font.readUInt32BE(at + 12) });
  }
  return tables;
}

function decodeName(bytes: Buffer, platformId: number): string {
  if (platformId === PLATFORM_MAC) return bytes.toString('latin1');
  return bytes.swap16().toString('utf16le'); // Unicode and Windows names are UTF-16BE
}

function postscriptNames(font: Buffer, name: TableRecord): string[] {
  const count = font.readUInt16BE(name.offset + 2);
  const strings = name.offset + font.readUInt16BE(name.offset + 4);
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = name.offset + 6 + i * 12;
    if (font.readUInt16BE(at + 6) !== NAME_ID_POSTSCRIPT) continue;
    const start = strings + font.readUInt16BE(at + 10);
    const bytes = Buffer.from(font.subarray(start, start + font.readUInt16BE(at + 8)));
    names.push(decodeName(bytes, font.readUInt16BE(at)));
  }
  return names;
}

type SfntInfo = {
  magic: number;
  postscriptNames: string[];
  weightClass: number;
  italic: boolean;
};

function readSfnt(file: string): SfntInfo {
  const font = readFileSync(path.join(FONTS_DIR, file));
  const tables = readTables(font);
  const name = tables.get('name');
  const os2 = tables.get('OS/2');
  if (!name || !os2) throw new Error(`${file} has no name or OS/2 table`);
  return {
    magic: font.readUInt32BE(0),
    postscriptNames: postscriptNames(font, name),
    weightClass: font.readUInt16BE(os2.offset + 4),
    italic: (font.readUInt16BE(os2.offset + 62) & FS_SELECTION_ITALIC) !== 0,
  };
}

const familyDirs = readdirSync(FONTS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const ttfFiles = familyDirs
  .flatMap((dir) => readdirSync(path.join(FONTS_DIR, dir)).map((file) => `${dir}/${file}`))
  .filter((file) => file.endsWith('.ttf'))
  .sort();
const faces = [...FONT_FACES.values()];

describe('bundled TTFs (US-002d, K6)', () => {
  it.each(faces.map((face) => [face.file, face] as const))('%s is a valid sfnt', (file, face) => {
    const info = readSfnt(file);
    expect([SFNT_TRUETYPE, SFNT_APPLE_TRUE]).toContain(info.magic);
    expect(info.postscriptNames.length).toBeGreaterThan(0);
    expect(new Set(info.postscriptNames)).toEqual(new Set([face.postscriptName]));
    expect(info.weightClass).toBe(face.weight);
    expect(info.italic).toBe(face.style === 'italic');
  });

  it('every PostScript name is unique', () => {
    const names = faces.map((face) => face.postscriptName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every map entry has a file and every file a map entry', () => {
    expect(faces.map((face) => face.file).sort()).toEqual(ttfFiles);
  });

  it('every family directory carries its licence', () => {
    const withoutLicence = familyDirs.filter(
      (dir) => !readdirSync(path.join(FONTS_DIR, dir)).some((file) => /^(LICENSE|OFL)/.test(file)),
    );
    expect(withoutLicence).toEqual([]);
  });

  it('SOURCES.md records every bundled file', () => {
    const sources = readFileSync(path.join(FONTS_DIR, 'SOURCES.md'), 'utf8');
    const files = familyDirs.flatMap((dir) => readdirSync(path.join(FONTS_DIR, dir)));
    expect(files.filter((file) => !sources.includes(`\`${file}\``))).toEqual([]);
  });
});

describe('FONT_FACES', () => {
  it('bundles the eight families (D57)', () => {
    expect(new Set(faces.map((face) => face.family))).toEqual(
      new Set(Object.values(FONT_FAMILIES)),
    );
    expect(familyDirs).toHaveLength(8);
  });

  it('bundles a face for every weight the type scale and the HUD presets use', () => {
    expect(fontFace(TYPE_FAMILIES.serif, 500)?.postscriptName).toBe('Newsreader16pt16pt-Medium');
    expect(fontFace(TYPE_FAMILIES.sans, 400)?.postscriptName).toBe('Geist-Regular');
    expect(fontFace(TYPE_FAMILIES.mono, 600)?.postscriptName).toBe('GeistMono-SemiBold');
    expect(fontFace(FONT_FAMILIES.rajdhani, 700)?.file).toBe('rajdhani/Rajdhani-Bold.ttf');
    expect(fontFace(FONT_FAMILIES.chakraPetch, 600)?.file).toBe(
      'chakra-petch/ChakraPetch-SemiBold.ttf',
    );
    expect(fontFace(FONT_FAMILIES.instrumentSerif, 400, 'italic')?.postscriptName).toBe(
      'InstrumentSerif-Italic',
    );
  });

  it('answers undefined for a face that is not bundled', () => {
    expect(fontFace(FONT_FAMILIES.newsreader, 600, 'italic')).toBeUndefined();
    expect(fontFace(FONT_FAMILIES.fredoka, 400)).toBeUndefined();
  });

  it('names each file after its PostScript name, so one fontFamily works on iOS and Android', () => {
    const mismatched = faces.filter(
      (face) => path.basename(face.file, '.ttf') !== face.postscriptName,
    );
    expect(mismatched).toEqual([]);
  });
});
