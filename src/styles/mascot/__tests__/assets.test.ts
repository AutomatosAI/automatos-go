// The 24 bundled files (KS6): present, byte for byte what SOURCES.md records, and the formats the
// phone plays — an ISO BMFF file whose video sample entry is HEVC 'hvc1', a 512 x 512 RGBA PNG.
// The platform tables are read as text: they require() media files, which node cannot load.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MASCOT_STATES } from '../../../core/web/lib/mascot/types';

const ROOT = path.resolve(__dirname, '../../../..');
const MASCOT_DIR = path.join(ROOT, 'assets/mascot');
const SOURCE_PIN = '630fc1c85';

function bytesOf(file: string): Buffer {
  return readFileSync(path.join(MASCOT_DIR, file));
}

type Recorded = { readonly source: string; readonly sha256: string; readonly bytes: number };

/** SOURCES.md's table: | file | source | sha256 | bytes |. */
function recorded(): ReadonlyMap<string, Recorded> {
  const rows = readFileSync(path.join(MASCOT_DIR, 'SOURCES.md'), 'utf8').matchAll(
    /^\| ([a-z]+\.(?:mp4|png)) \| (\S+) \| ([0-9a-f]{64}) \| (\d+) \|$/gm,
  );
  return new Map(
    [...rows].map(([, file = '', source = '', sha256 = '', bytes]) => [
      file,
      { source, sha256, bytes: Number(bytes) },
    ]),
  );
}

type Box = { readonly type: string; readonly body: number; readonly end: number };

/** The boxes between start and end (ISO/IEC 14496-12 §4.2: 32-bit size, or 1 and a 64-bit size). */
function boxesIn(file: Buffer, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let at = start;
  while (at + 8 <= end) {
    const short = file.readUInt32BE(at);
    const size = short === 1 ? Number(file.readBigUInt64BE(at + 8)) : short || end - at;
    boxes.push({
      type: file.toString('ascii', at + 4, at + 8),
      body: at + (short === 1 ? 16 : 8),
      end: at + size,
    });
    at += size;
  }
  return boxes;
}

const TRACK_PATH = ['mdia', 'minf', 'stbl', 'stsd'];
/** stsd is a full box: version and flags, then the entry count, then the entries. */
const STSD_ENTRIES = 8;

/** Each track's first sample entry type: moov → trak → mdia → minf → stbl → stsd → entry. */
function sampleEntries(file: Buffer): string[] {
  const moov = boxesIn(file, 0, file.length).find((box) => box.type === 'moov');
  if (!moov) return [];
  return boxesIn(file, moov.body, moov.end)
    .filter((box) => box.type === 'trak')
    .flatMap((trak) => {
      const stsd = TRACK_PATH.reduce<Box | undefined>(
        (box, type) => box && boxesIn(file, box.body, box.end).find((child) => child.type === type),
        trak,
      );
      return stsd
        ? boxesIn(file, stsd.body + STSD_ENTRIES, stsd.end)
            .slice(0, 1)
            .map((e) => e.type)
        : [];
    });
}

const PNG_SIGNATURE = '89504e470d0a1a0a';
const STILL_SIDE = 512;
const RGBA = 6;

describe('the bundled files', () => {
  it.each(MASCOT_STATES)('%s has its clip and its still', (state) => {
    expect(bytesOf(`${state}.mp4`).length).toBeGreaterThan(0);
    expect(bytesOf(`${state}.png`).length).toBeGreaterThan(0);
  });

  it('holds the 24 files, SOURCES.md and no .webm', () => {
    const files = readdirSync(MASCOT_DIR).sort();
    const expected = MASCOT_STATES.flatMap((state) => [`${state}.mp4`, `${state}.png`]);
    expect(files).toEqual([...expected, 'SOURCES.md'].sort());
    expect(files.filter((file) => file.endsWith('.webm'))).toEqual([]);
  });

  it('SOURCES.md records each file’s source at the pin, its sha256 and its size', () => {
    const table = recorded();
    expect(table.size).toBe(MASCOT_STATES.length * 2);
    for (const [file, { source, sha256, bytes }] of table) {
      const data = bytesOf(file);
      expect(source).toBe(`frontend/public/auto/${file}`);
      expect(createHash('sha256').update(data).digest('hex')).toBe(sha256);
      expect(data.length).toBe(bytes);
    }
    const notes = readFileSync(path.join(MASCOT_DIR, 'SOURCES.md'), 'utf8');
    expect(notes).toContain(`at commit \`${SOURCE_PIN}\``);
    expect(notes).toMatch(/rights confirmed\s+20 Oct 2026/);
  });
});

describe('the clips', () => {
  it.each(MASCOT_STATES)('%s.mp4 is an ftyp file with an hvc1 sample entry', (state) => {
    const clip = bytesOf(`${state}.mp4`);
    expect(boxesIn(clip, 0, clip.length)[0]?.type).toBe('ftyp');
    expect(sampleEntries(clip)).toContain('hvc1');
  });
});

describe('the stills', () => {
  it.each(MASCOT_STATES)('%s.png is a 512 x 512 RGBA PNG', (state) => {
    const still = bytesOf(`${state}.png`);
    expect(still.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
    expect(still.toString('ascii', 12, 16)).toBe('IHDR');
    expect(still.readUInt32BE(16)).toBe(STILL_SIDE);
    expect(still.readUInt32BE(20)).toBe(STILL_SIDE);
    expect(still[25]).toBe(RGBA);
  });
});

describe('the platform tables', () => {
  const table = (platform: string) =>
    readFileSync(path.join(ROOT, `src/styles/mascot/assets.${platform}.ts`), 'utf8');
  const required = (source: string) =>
    [...source.matchAll(/require\('\.\.\/\.\.\/\.\.\/assets\/mascot\/([a-z]+\.[a-z0-9]+)'\)/g)].map(
      ([, file]) => file,
    );

  it('iOS requires the 12 clips and the 12 stills', () => {
    const files = required(table('ios'));
    expect(files.filter((file) => file?.endsWith('.mp4'))).toEqual(
      MASCOT_STATES.map((s) => `${s}.mp4`),
    );
    expect(files.filter((file) => file?.endsWith('.png'))).toEqual(
      MASCOT_STATES.map((s) => `${s}.png`),
    );
  });

  it('Android requires the 12 stills and no clip', () => {
    const source = table('android');
    expect(required(source)).toEqual(MASCOT_STATES.map((s) => `${s}.png`));
    expect(source).not.toContain('.mp4');
    expect(source).toMatch(/clips: null/);
  });
});
