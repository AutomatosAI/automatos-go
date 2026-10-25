// The last theme answers on the phone, for the first frame (US-016i, D59): the painting and what
// 'Same as Studio' painted round-trip through the encrypted store; anything read back that does
// not fit (garbage, another version, a colour or a file URL the phone would refuse) is no
// painting; a failing store is logged, never thrown.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import { builtinChoice, themeChoice } from '../../registry/style-id';
import {
  THEME_FOLLOWED_KEY,
  THEME_PAINT_KEY,
  parseThemePaint,
  serialiseThemePaint,
  themeFollowedPart,
  themePaintPart,
} from '../cache';
import { themePaint } from '../paint';
import type { ThemePaint } from '../types';
import { FONT_URL, HARBOUR_ID, answer, fileUrl, hex } from './fixtures';

function painting(): ThemePaint {
  const paint = themePaint(
    answer(HARBOUR_ID, {
      fonts: { sans: FONT_URL },
      mascot: {
        mode: 'clips',
        states: [
          {
            name: 'idle',
            clip: fileUrl('assets/mascot/idle.mp4'),
            still: fileUrl('assets/mascot/idle.png'),
          },
        ],
      },
    }),
  );
  if (!paint) throw new Error('the fixture should paint');
  return paint;
}

function stored(paint: unknown): string {
  return JSON.stringify({ v: 1, paint });
}

function failingStorage(): KeyValueStorage {
  const fail = () => {
    throw new Error('mmkv unavailable');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the painting on the phone', () => {
  it('round-trips a painting with its fonts and mascot files', () => {
    const paint = painting();
    expect(parseThemePaint(serialiseThemePaint(paint))).toEqual(paint);
    expect(parseThemePaint(serialiseThemePaint(null))).toBeNull();
  });

  it('reads garbage, another version or nothing as no painting', () => {
    for (const raw of [
      null,
      undefined,
      '',
      '{',
      '[]',
      '42',
      JSON.stringify({ v: 2, paint: painting() }),
    ]) {
      expect(parseThemePaint(raw)).toBeNull();
    }
  });

  it('refuses a painting with a colour missing or not #RRGGBB(AA)', () => {
    const paint = painting();
    const { background: _dropped, ...missing } = paint.colours.light;
    expect(
      parseThemePaint(stored({ ...paint, colours: { ...paint.colours, light: missing } })),
    ).toBeNull();
    const odd = { ...paint.colours.light, accent: 'red' };
    expect(
      parseThemePaint(stored({ ...paint, colours: { ...paint.colours, light: odd } })),
    ).toBeNull();
    const alpha = { ...paint.colours.light, accent2: hex('C2410C1A') };
    expect(
      parseThemePaint(stored({ ...paint, colours: { ...paint.colours, light: alpha } })),
    ).not.toBeNull();
  });

  it('refuses a stored font or mascot URL the allowlist would refuse', () => {
    const paint = painting();
    expect(
      parseThemePaint(stored({ ...paint, fonts: { sans: 'https://evil.example/a.ttf' } })),
    ).toBeNull();
    const code = {
      mode: 'clips',
      states: [{ name: 'idle', clip: fileUrl('dist/entry.js'), still: null }],
    };
    expect(parseThemePaint(stored({ ...paint, mascotFiles: code }))).toBeNull();
  });

  it('keeps the painting under styles.theme.paint and reads it back on the next launch', () => {
    const storage = memoryStorage();
    const part = themePaintPart(() => storage);
    expect(part.get()).toBeNull();
    expect(part.set(painting())).toBe(true);
    expect(storage.getItem(THEME_PAINT_KEY)).not.toBeNull();
    expect(themePaintPart(() => storage).get()).toEqual(painting());
  });
});

describe("what 'Same as Studio' painted", () => {
  it('keeps it under styles.theme.followed; garbage is Studio', () => {
    const storage = memoryStorage();
    const part = themeFollowedPart(() => storage);
    expect(part.get()).toEqual(builtinChoice('studio'));
    part.set(themeChoice(HARBOUR_ID));
    expect(themeFollowedPart(() => storage).get()).toEqual(themeChoice(HARBOUR_ID));
    storage.setItem(THEME_FOLLOWED_KEY, 'sepia');
    expect(themeFollowedPart(() => storage).get()).toEqual(builtinChoice('studio'));
  });
});

describe('a failing store', () => {
  it('is logged: no painting on read, false on save, the value held for this launch', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const part = themePaintPart(failingStorage);
    expect(part.get()).toBeNull();
    expect(part.set(painting())).toBe(false);
    expect(part.get()).toEqual(painting());
    const unopened = themeFollowedPart(() => {
      throw new Error('keychain locked');
    });
    expect(unopened.get()).toEqual(builtinChoice('studio'));
    expect(warn).toHaveBeenCalled();
  });
});
