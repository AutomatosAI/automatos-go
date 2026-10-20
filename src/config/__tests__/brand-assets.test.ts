// The icon and splash PNGs (US-002e, K7): App Store processing rejects an icon with an alpha
// channel even when it is fully opaque (ITMS-90717), so the headers are read and pinned here.
// No image dependency: the IHDR chunk carries size and colour type, and the first pixel of the
// first row decodes the same under every PNG filter (it has no left or upper neighbour).

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import appJson from '../../../app.json';

const { expo } = appJson;

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const BRAND_DIR = 'assets/brand';
const BRAND_REF = `./${BRAND_DIR}/`;

const ICON = `${BRAND_REF}icon.png`;
const ICON_DARK = `${BRAND_REF}icon-dark.png`;
const ADAPTIVE_ICON = `${BRAND_REF}adaptive-icon.png`;
const SPLASH = `${BRAND_REF}splash.png`;

// The Studio grounds as bytes: cream hsl(38 50% 92%) and Studio Dark hsl(30 12% 9%).
const CREAM = [0xf4, 0xee, 0xe2];
const DARK = [0x1a, 0x18, 0x14];
const ICON_SIZE = 1024;
const SPLASH_IMAGE_WIDTH = 220; // as the academy template

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COLOUR_TYPE_RGB = 2;
const ALPHA_COLOUR_TYPES = [4, 6]; // greyscale + alpha, RGB + alpha
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

type Png = {
  width: number;
  height: number;
  bitDepth: number;
  colourType: number;
  chunkTypes: string[];
  firstPixel: number[];
};

function chunksOf(bytes: Buffer): { type: string; data: Buffer }[] {
  const chunks: { type: string; data: Buffer }[] = [];
  for (let offset = PNG_SIGNATURE.length; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += length + 12; // length, type, data, CRC
  }
  return chunks;
}

function readPng(ref: string): Png {
  const bytes = readFileSync(path.join(PROJECT_ROOT, ref));
  expect(bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true);
  const chunks = chunksOf(bytes);
  expect(chunks[0].type).toBe('IHDR');
  const header = chunks[0].data;
  const colourType = header.readUInt8(9);
  const pixels = inflateSync(
    Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data)),
  );
  return {
    width: header.readUInt32BE(0),
    height: header.readUInt32BE(4),
    bitDepth: header.readUInt8(8),
    colourType,
    chunkTypes: chunks.map((chunk) => chunk.type),
    // byte 0 is the row's filter type
    firstPixel: [...pixels.subarray(1, 1 + (CHANNELS[colourType] ?? 0))],
  };
}

function hex(rgb: number[]): string {
  return `#${rgb.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

// Every string in app.json that points into assets/brand/.
function brandRefs(value: unknown): string[] {
  if (typeof value === 'string') return value.startsWith(BRAND_REF) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(brandRefs);
  if (value && typeof value === 'object') return Object.values(value).flatMap(brandRefs);
  return [];
}

type PluginEntry = string | [string, Record<string, unknown>];

function pluginOptions(name: string): unknown {
  const plugins = expo.plugins as readonly PluginEntry[];
  const entry = plugins.find((item) => Array.isArray(item) && item[0] === name);
  return Array.isArray(entry) ? entry[1] : undefined;
}

describe('app icons (US-002e)', () => {
  it.each([ICON, ICON_DARK])('%s is 1024x1024 8-bit RGB with no alpha channel', (ref) => {
    const png = readPng(ref);
    expect([png.width, png.height]).toEqual([ICON_SIZE, ICON_SIZE]);
    expect(png.bitDepth).toBe(8);
    expect(png.colourType).toBe(COLOUR_TYPE_RGB);
    expect(png.chunkTypes).not.toContain('tRNS');
  });

  it('icon.png sits on Studio cream', () => {
    expect(readPng(ICON).firstPixel).toEqual(CREAM);
  });

  it('icon-dark.png sits on the Studio Dark ground', () => {
    expect(readPng(ICON_DARK).firstPixel).toEqual(DARK);
  });

  it('adaptive-icon.png is a 1024x1024 foreground with alpha and a transparent edge', () => {
    const png = readPng(ADAPTIVE_ICON);
    expect([png.width, png.height]).toEqual([ICON_SIZE, ICON_SIZE]);
    expect(png.bitDepth).toBe(8);
    expect(ALPHA_COLOUR_TYPES).toContain(png.colourType);
    expect(png.firstPixel.at(-1)).toBe(0);
  });

  it('splash.png has an alpha channel (the mark on a transparent background)', () => {
    expect(ALPHA_COLOUR_TYPES).toContain(readPng(SPLASH).colourType);
  });
});

describe('app.json wires the brand assets (US-002e)', () => {
  it('references exactly the four brand files, and they are all that is on disk', () => {
    const onDisk = readdirSync(path.join(PROJECT_ROOT, BRAND_DIR))
      .filter((file) => file.endsWith('.png'))
      .map((file) => `${BRAND_REF}${file}`);
    const expected = [ADAPTIVE_ICON, ICON, ICON_DARK, SPLASH].sort();
    expect([...new Set(brandRefs(expo))].sort()).toEqual(expected);
    expect(onDisk.sort()).toEqual(expected);
  });

  it('uses icon.png as the app icon and icon-dark.png as the iOS dark icon', () => {
    expect(expo.icon).toBe(ICON);
    expect(expo.ios.icon).toEqual({ light: ICON, dark: ICON_DARK });
  });

  it('gives Android an adaptive icon on Studio cream', () => {
    expect(expo.android.adaptiveIcon).toEqual({
      foregroundImage: ADAPTIVE_ICON,
      backgroundColor: hex(CREAM),
    });
  });

  it('wires the splash through expo-splash-screen, cream in light and Studio Dark in dark', () => {
    expect(pluginOptions('expo-splash-screen')).toEqual({
      backgroundColor: hex(CREAM),
      image: SPLASH,
      imageWidth: SPLASH_IMAGE_WIDTH,
      dark: { backgroundColor: hex(DARK) },
    });
  });
});
