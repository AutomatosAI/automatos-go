// Reads every bundled TTF with a small sfnt reader (no font dependency) and holds it to the
// FONT_FACES map: a face whose PostScript name drifts from the map renders as the system font
// on iOS, and a file the map does not know is dead weight in the binary.

import { createHash } from 'node:crypto';
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
  it('bundles the ten families (D57, D-ARC-4)', () => {
    expect(new Set(faces.map((face) => face.family))).toEqual(
      new Set(Object.values(FONT_FAMILIES)),
    );
    expect(Object.keys(FONT_FAMILIES)).toHaveLength(10);
    expect(familyDirs).toHaveLength(10);
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

/** Arcade's files (D-ARC-4): each one's sha256 as SOURCES.md records it; Press Start 2P's is the
 * design kit's mobile/press-start-2p-regular.ttf at 034fa629c, byte for byte. */
const ARCADE_FILES = {
  'press-start-2p/PressStart2P-Regular.ttf':
    '034c77f1f05ec89421e4a63f0e3a4ca1ecf852cc6d2bf611f126f275728e017d',
  'press-start-2p/OFL.txt': '705960c3281a5765ecc0b59bd4ed7ca59eed165748076bc2fc3e8fdbfeb944b0',
  'pixelify-sans/PixelifySans-Regular.ttf':
    '5436d485d1713afa376e1744911cbbcc0849eae1eb55ec9bc34c0753993ffef9',
  'pixelify-sans/PixelifySans-SemiBold.ttf':
    'a4b54982991cd47450df317a451a7f066bf6b91aa033e105643aba2cf7bd35c3',
  'pixelify-sans/OFL.txt': 'b66ba46f511a851ab09998b5a5a9fdbb102545a3864cb993095e1745996873a7',
} as const;

const sha256 = (file: string) =>
  createHash('sha256')
    .update(readFileSync(path.join(FONTS_DIR, file)))
    .digest('hex');

describe("Arcade's faces (US-022d, D-ARC-4)", () => {
  it('bundles Press Start 2P 400 and Pixelify Sans 400 and 600', () => {
    expect(fontFace(FONT_FAMILIES.pressStart2p, 400)?.file).toBe(
      'press-start-2p/PressStart2P-Regular.ttf',
    );
    expect(fontFace(FONT_FAMILIES.pixelifySans, 400)?.file).toBe(
      'pixelify-sans/PixelifySans-Regular.ttf',
    );
    expect(fontFace(FONT_FAMILIES.pixelifySans, 600)?.file).toBe(
      'pixelify-sans/PixelifySans-SemiBold.ttf',
    );
    expect(fontFace(FONT_FAMILIES.pressStart2p, 600)).toBeUndefined();
  });

  it('holds every new file to its sha256, recorded in SOURCES.md', () => {
    const sources = readFileSync(path.join(FONTS_DIR, 'SOURCES.md'), 'utf8');
    for (const [file, hash] of Object.entries(ARCADE_FILES)) {
      expect({ file, hash: sha256(file) }).toEqual({ file, hash });
      expect({ file, recorded: sources.includes(hash) }).toEqual({ file, recorded: true });
    }
  });

  it('carries each family’s OFL beside its fonts', () => {
    for (const dir of ['press-start-2p', 'pixelify-sans']) {
      expect(readdirSync(path.join(FONTS_DIR, dir))).toContain('OFL.txt');
      expect(readFileSync(path.join(FONTS_DIR, dir, 'OFL.txt'), 'utf8')).toContain(
        'SIL Open Font License, Version 1.1',
      );
    }
  });
});
