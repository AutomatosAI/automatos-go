// The installed themes the phone may paint (D58, D-CAPABILITIES, PRD-261 M-04): only with
// mobile_theme; each live, non-built-in install asked at most 4 at a time; offered when its answer
// paints; a 404 skips it; a revoked one is never asked ('disable', or a level the app does not
// know); Play's and HUD's web themes are the built-in rows; sorted by name as '<name> · <version>'.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../../lib/logger';
import { PICKER_COPY } from '../../strings';
import {
  MAX_THEME_INSTALLS,
  MOBILE_THEME_FETCH_CONCURRENCY,
  mapLimited,
  mayOffer,
  offeredPaint,
  offeredThemes,
} from '../installed';
import { MAX_MASCOT_STATES, MobileThemeSchema, revocationOf } from '../schemas';
import {
  HARBOUR_ID,
  MOSS_ID,
  PLAY_ID,
  WITHOUT_MOBILE_THEME,
  WITH_MOBILE_THEME,
  answer,
  fakeReader,
  row,
} from './fixtures';

const HARBOUR = row(HARBOUR_ID, { name: 'Harbour', version: '1.1.0' });
const MOSS = row(MOSS_ID, { name: 'Moss', version: '2.0.3' });

function id(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the capability gate (D-CAPABILITIES)', () => {
  it('lists nothing and asks nothing without mobile_theme, or before discovery loads', async () => {
    for (const discovery of [WITHOUT_MOBILE_THEME, null, undefined]) {
      const reader = fakeReader([HARBOUR], { [HARBOUR_ID]: answer(HARBOUR_ID) });
      const installed = vi.spyOn(reader, 'installed');
      expect(await offeredThemes(reader, discovery)).toEqual([]);
      expect(installed).not.toHaveBeenCalled();
      expect(reader.asked).toEqual([]);
    }
  });

  it('lists the installs that paint with mobile_theme', async () => {
    const reader = fakeReader([HARBOUR], { [HARBOUR_ID]: answer(HARBOUR_ID) });
    const themes = await offeredThemes(reader, WITH_MOBILE_THEME);
    expect(themes.map((theme) => theme.installId)).toEqual([HARBOUR_ID]);
    expect(themes[0].paint.installId).toBe(HARBOUR_ID);
  });
});

describe('which installs are asked and offered', () => {
  it('skips an install the server answers 404 for, and keeps the rest', async () => {
    const reader = fakeReader([HARBOUR, MOSS], { [MOSS_ID]: answer(MOSS_ID) });
    const themes = await offeredThemes(reader, WITH_MOBILE_THEME);
    expect(reader.asked.sort()).toEqual([HARBOUR_ID, MOSS_ID].sort());
    expect(themes.map((theme) => theme.installId)).toEqual([MOSS_ID]);
  });

  it('skips a null mobile block (no phone look, opt-in still required, withdrawn)', async () => {
    const optIn = row(HARBOUR_ID, {
      optIn: { required: true, wording: 'Run it?', packageId: 'p' },
    });
    const reader = fakeReader([optIn], { [HARBOUR_ID]: answer(HARBOUR_ID, null) });
    expect(await offeredThemes(reader, WITH_MOBILE_THEME)).toEqual([]);
  });

  it('skips a painting the phone cannot draw, and an answer for another install', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const reader = fakeReader([HARBOUR, MOSS], {
      [HARBOUR_ID]: answer(HARBOUR_ID, {
        tokens: { light: { '--card': '0 0% 100%' }, dark: null },
      }),
      [MOSS_ID]: answer(HARBOUR_ID),
    });
    expect(await offeredThemes(reader, WITH_MOBILE_THEME)).toEqual([]);
  });

  it("never asks for a withdrawn install ('disable'), and asks for a 'warn' one", async () => {
    const withdrawn = row(HARBOUR_ID, { revoked: revocationOf({ level: 'disable', reason: 'x' }) });
    const warned = row(MOSS_ID, { revoked: revocationOf({ level: 'warn', reason: 'old' }) });
    const reader = fakeReader([withdrawn, warned], {
      [HARBOUR_ID]: answer(HARBOUR_ID),
      [MOSS_ID]: answer(MOSS_ID),
    });
    const themes = await offeredThemes(reader, WITH_MOBILE_THEME);
    expect(reader.asked).toEqual([MOSS_ID]);
    expect(themes.map((theme) => theme.installId)).toEqual([MOSS_ID]);
  });

  it('reads a revocation level it does not know, or cannot read, as disable (fail closed)', () => {
    for (const revoked of [{ level: 'quarantine' }, { reason: 'no level' }, true, 'yes', 1]) {
      expect(mayOffer(row(HARBOUR_ID, { revoked: revocationOf(revoked) }))).toBe(false);
    }
    expect(mayOffer(row(HARBOUR_ID, { revoked: revocationOf(null) }))).toBe(true);
  });

  it("leaves out Play's and HUD's web themes: they are the built-in rows", async () => {
    const play = row(PLAY_ID, { themeId: 'automatos/play', name: 'Play' });
    const hud = row(id(9), { themeId: 'automatos/hud', name: 'HUD' });
    const reader = fakeReader([play, hud, HARBOUR], { [HARBOUR_ID]: answer(HARBOUR_ID) });
    const themes = await offeredThemes(reader, WITH_MOBILE_THEME);
    expect(reader.asked).toEqual([HARBOUR_ID]);
    expect(themes.map((theme) => theme.name)).toEqual(['Harbour']);
  });

  it('fails the read on any failure but a 404, so a passing fault never reads as no themes', async () => {
    const reader = fakeReader([HARBOUR, MOSS], {
      [HARBOUR_ID]: answer(HARBOUR_ID),
      [MOSS_ID]: new Error('network down'),
    });
    await expect(offeredThemes(reader, WITH_MOBILE_THEME)).rejects.toThrow('network down');
  });
});

describe('the order and the words under Studio', () => {
  it("sorts by name, and the picker titles each '<name> · <version>'", async () => {
    const zeta = row(id(3), { name: 'Zeta', version: '0.9.0' });
    const reader = fakeReader([zeta, MOSS, HARBOUR], {
      [id(3)]: answer(id(3)),
      [MOSS_ID]: answer(MOSS_ID),
      [HARBOUR_ID]: answer(HARBOUR_ID),
    });
    const themes = await offeredThemes(reader, WITH_MOBILE_THEME);
    expect(themes.map((theme) => PICKER_COPY.themeTitle(theme.name, theme.version))).toEqual([
      'Harbour · 1.1.0',
      'Moss · 2.0.3',
      'Zeta · 0.9.0',
    ]);
  });

  it('names an install without a manifest name by its theme id', async () => {
    const nameless = row(HARBOUR_ID, { name: null, themeId: 'acme/harbour' });
    const reader = fakeReader([nameless], { [HARBOUR_ID]: answer(HARBOUR_ID) });
    expect((await offeredThemes(reader, WITH_MOBILE_THEME))[0].name).toBe('acme/harbour');
  });

  it('finds an offered painting by install, and none for a built-in style', async () => {
    const reader = fakeReader([HARBOUR], { [HARBOUR_ID]: answer(HARBOUR_ID) });
    const themes = await offeredThemes(reader, WITH_MOBILE_THEME);
    expect(offeredPaint(HARBOUR_ID, themes)).toBe(themes[0].paint);
    expect(offeredPaint(MOSS_ID, themes)).toBeNull();
    expect(offeredPaint(null, themes)).toBeNull();
  });
});

describe(`at most ${MOBILE_THEME_FETCH_CONCURRENCY} paintings asked at a time`, () => {
  it('never has more than four requests in flight, and asks every install once', async () => {
    const rows = Array.from({ length: 11 }, (_, n) => row(id(n), { name: `T${n}` }));
    const answers = Object.fromEntries(rows.map((r) => [r.installId, answer(r.installId)]));
    const reader = fakeReader(rows, answers);
    const themes = await offeredThemes(reader, WITH_MOBILE_THEME);
    expect(MOBILE_THEME_FETCH_CONCURRENCY).toBe(4);
    expect(reader.peak()).toBe(4);
    expect([...reader.asked].sort()).toEqual(rows.map((r) => r.installId).sort());
    expect(themes).toHaveLength(11);
  });

  it('keeps the results in the order given', async () => {
    const waits = [5, 1, 3, 0];
    const results = await mapLimited(waits, 2, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms * 10;
    });
    expect(results).toEqual([50, 10, 30, 0]);
    expect(await mapLimited([], 4, async () => 1)).toEqual([]);
  });
});

describe('bounds on what one answer can cost (security review, 24 Oct)', () => {
  it(`asks at most ${MAX_THEME_INSTALLS} installs on one read, logged`, async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const rows = Array.from({ length: MAX_THEME_INSTALLS + 5 }, (_, n) => row(id(n)));
    const reader = fakeReader(rows, {});
    await offeredThemes(reader, WITH_MOBILE_THEME);
    expect(reader.asked).toHaveLength(MAX_THEME_INSTALLS);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`${MAX_THEME_INSTALLS}`));
  });

  it(`reads at most core's ${MAX_MASCOT_STATES} mascot states`, () => {
    const states = Array.from({ length: 40 }, (_, n) => ({
      name: `s${n}`,
      clip: null,
      still: null,
    }));
    const parsed = MobileThemeSchema.parse({
      ...answer(HARBOUR_ID),
      mobile: { ...answer(HARBOUR_ID).mobile, mascot: { mode: 'stills', states } },
    });
    expect(parsed.mobile?.mascot.states).toHaveLength(MAX_MASCOT_STATES);
  });
});
