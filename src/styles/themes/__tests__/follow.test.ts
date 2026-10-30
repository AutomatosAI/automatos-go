// 'Same as Studio' (D-PHONE-CHOICE, D58): followStudio's branches (Play's and HUD's web themes are
// the built-in styles; another theme with a painting is that theme over Studio; studio, classic,
// no theme, revoked or no painting is Studio), the default, a phone pick overriding the follow and
// 'Same as Studio' returning to it, and the revoked fallback with its one toast (plan.ts).

import { describe, expect, it } from 'vitest';

import { FOLLOW_STUDIO, builtinChoice, paintedChoice, themeChoice } from '../../registry/style-id';
import { createStyleStore, appStyleSources } from '../../provider/store';
import { memoryStorage } from '../../../storage/encrypted-storage';
import {
  BUILT_IN_THEME_STYLES,
  builtInStyleOf,
  choiceAfterLoss,
  followStudio,
  paintedInstall,
  themeGone,
} from '../follow';
import type { OfferedTheme } from '../installed';
import { themePaint } from '../paint';
import { paintForChoice, paintedChange, planRead, type ThemeSnapshot } from '../plan';
import { revocationOf, type Active } from '../schemas';
import { HARBOUR_ID, MOSS_ID, PLAY_ID, active, activeTheme, answer } from './fixtures';

const STUDIO = builtinChoice('studio');

function offer(installId: string, name = 'Harbour'): OfferedTheme {
  const theme = answer(installId);
  const paint = themePaint(theme);
  if (!paint) throw new Error('the fixture should paint');
  return { installId, themeId: theme.themeId, name, version: theme.version, answer: theme, paint };
}

const HARBOUR = offer(HARBOUR_ID);
const MOSS = offer(MOSS_ID, 'Moss');

function snapshot(overrides: Partial<ThemeSnapshot> = {}): ThemeSnapshot {
  return { choice: FOLLOW_STUDIO, followed: STUDIO, paint: null, ...overrides };
}

function withdrawn(installId: string): Active {
  const revoked = revocationOf({ level: 'disable', reason: 'withdrawn' });
  return active({ choice: 'studio', theme: null, revoked: { installId, ...revoked! } });
}

describe('followStudio: what Same as Studio paints', () => {
  it("paints Play's, HUD's, Arcade's or Candy's built-in style for their web themes (installing them flips the phone)", () => {
    expect(BUILT_IN_THEME_STYLES).toEqual({
      'automatos/play': 'play',
      'automatos/hud': 'hud',
      'automatos/arcade': 'arcade',
      'automatos/candy': 'candy',
    });
    expect(followStudio(activeTheme(PLAY_ID, 'automatos/play'), null)).toEqual(
      builtinChoice('play'),
    );
    expect(followStudio(activeTheme(PLAY_ID, 'automatos/hud'), null)).toEqual(builtinChoice('hud'));
    expect(followStudio(activeTheme(PLAY_ID, 'automatos/arcade'), null)).toEqual(
      builtinChoice('arcade'),
    );
    expect(builtInStyleOf('automatos/arcade')).toBe('arcade');
    expect(followStudio(activeTheme(PLAY_ID, 'automatos/candy'), null)).toEqual(
      builtinChoice('candy'),
    );
    expect(builtInStyleOf('automatos/candy')).toBe('candy');
    expect(builtInStyleOf('acme/harbour')).toBeNull();
    expect(builtInStyleOf('toString')).toBeNull();
  });

  it('paints another theme over Studio when its phone answer paints', () => {
    expect(followStudio(activeTheme(HARBOUR_ID), answer(HARBOUR_ID))).toEqual(
      themeChoice(HARBOUR_ID),
    );
  });

  it('is Studio for studio, classic, no theme, a null block, no answer or another install’s', () => {
    expect(followStudio(active({ choice: 'studio' }), null)).toEqual(STUDIO);
    expect(followStudio(active({ choice: 'classic' }), null)).toEqual(STUDIO);
    expect(followStudio(activeTheme(HARBOUR_ID), null)).toEqual(STUDIO);
    expect(followStudio(activeTheme(HARBOUR_ID), answer(HARBOUR_ID, null))).toEqual(STUDIO);
    expect(followStudio(activeTheme(HARBOUR_ID), answer(MOSS_ID))).toEqual(STUDIO);
  });

  it('is Studio for a revoked theme, even a built-in one', () => {
    expect(followStudio(withdrawn(HARBOUR_ID), answer(HARBOUR_ID))).toEqual(STUDIO);
    const disabledPlay = activeTheme(PLAY_ID, 'automatos/play');
    const failClosed = {
      ...disabledPlay,
      theme: { ...disabledPlay.theme!, revoked: revocationOf({ level: 'mystery' }) },
    };
    expect(followStudio(failClosed, null)).toEqual(STUDIO);
  });
});

describe('the default, the override and the return', () => {
  it("a new phone follows Studio: the default paints what Studio's theme maps to", () => {
    const state = createStyleStore(appStyleSources(() => memoryStorage())).getState();
    expect(state.choice).toEqual(FOLLOW_STUDIO);
    const plan = planRead(snapshot(), {
      active: activeTheme(PLAY_ID, 'automatos/play'),
      offered: [],
    });
    expect(paintedChoice(plan.choice, plan.followed)).toEqual(builtinChoice('play'));
  });

  it('a style picked on the phone overrides what Studio uses', () => {
    const picked = snapshot({ choice: builtinChoice('hud') });
    const plan = planRead(picked, { active: activeTheme(HARBOUR_ID), offered: [HARBOUR] });
    expect(plan.followed).toEqual(themeChoice(HARBOUR_ID));
    expect(paintedChoice(plan.choice, plan.followed)).toEqual(builtinChoice('hud'));
  });

  it("'Same as Studio' picked again returns to what Studio uses", () => {
    const plan = planRead(snapshot({ choice: builtinChoice('hud') }), {
      active: activeTheme(HARBOUR_ID),
      offered: [HARBOUR],
    });
    expect(paintedChoice(FOLLOW_STUDIO, plan.followed)).toEqual(themeChoice(HARBOUR_ID));
    expect(paintForChoice(FOLLOW_STUDIO, plan.followed, plan.themes)).toBe(HARBOUR.paint);
    expect(paintForChoice(builtinChoice('play'), plan.followed, plan.themes)).toBeNull();
  });
});

describe('planRead: one read applied', () => {
  it('follows Studio onto a theme with its painting and the picker rows', () => {
    const plan = planRead(snapshot(), {
      active: activeTheme(HARBOUR_ID),
      offered: [HARBOUR, MOSS],
    });
    expect(plan).toMatchObject({
      choice: FOLLOW_STUDIO,
      followed: themeChoice(HARBOUR_ID),
      paint: HARBOUR.paint,
      lost: false,
    });
    expect(plan.themes).toEqual([HARBOUR, MOSS]);
    expect(paintedChange(snapshot(), plan)).toEqual({ from: STUDIO, to: themeChoice(HARBOUR_ID) });
  });

  it('keeps the held painting while a built-in style is painted and its install is offered', () => {
    const held = snapshot({ choice: builtinChoice('play'), paint: HARBOUR.paint });
    expect(planRead(held, { active: active(), offered: [HARBOUR] }).paint).toBe(HARBOUR.paint);
  });

  it('drops the held painting once its install is not offered (uninstalled, withdrawn)', () => {
    const held = snapshot({ choice: builtinChoice('play'), paint: HARBOUR.paint });
    expect(planRead(held, { active: active(), offered: [MOSS] }).paint).toBeNull();
    const followed = snapshot({ followed: themeChoice(HARBOUR_ID), paint: HARBOUR.paint });
    expect(planRead(followed, { active: withdrawn(HARBOUR_ID), offered: [] }).paint).toBeNull();
  });

  it('paints a theme picked on the phone from this read', () => {
    const plan = planRead(snapshot({ choice: themeChoice(MOSS_ID) }), {
      active: active(),
      offered: [HARBOUR, MOSS],
    });
    expect(plan.paint).toBe(MOSS.paint);
    expect(paintedInstall(plan.choice, plan.followed)).toBe(MOSS_ID);
  });

  it('Studio switching to another theme or to Play is an ordinary follow, never a toast', () => {
    const before = snapshot({ followed: themeChoice(HARBOUR_ID), paint: HARBOUR.paint });
    expect(planRead(before, { active: activeTheme(MOSS_ID), offered: [HARBOUR, MOSS] }).lost).toBe(
      false,
    );
    const toPlay = planRead(before, {
      active: activeTheme(PLAY_ID, 'automatos/play'),
      offered: [],
    });
    expect(toPlay.lost).toBe(false);
    expect(toPlay.followed).toEqual(builtinChoice('play'));
  });
});

describe('the revoked fallback: back on Studio, with the toast', () => {
  it('a followed theme /active reports withdrawn', () => {
    const before = snapshot({ followed: themeChoice(HARBOUR_ID), paint: HARBOUR.paint });
    const plan = planRead(before, { active: withdrawn(HARBOUR_ID), offered: [] });
    expect(plan.followed).toEqual(STUDIO);
    expect(plan.choice).toEqual(FOLLOW_STUDIO);
    expect(plan.lost).toBe(true);
  });

  it('a followed theme Studio still names that the phone can no longer paint', () => {
    const before = snapshot({ followed: themeChoice(HARBOUR_ID), paint: HARBOUR.paint });
    const plan = planRead(before, { active: activeTheme(HARBOUR_ID), offered: [] });
    expect(plan.followed).toEqual(STUDIO);
    expect(plan.lost).toBe(true);
  });

  it('a theme picked on the phone that is no longer offered: the choice becomes Studio', () => {
    const before = snapshot({ choice: themeChoice(HARBOUR_ID), paint: HARBOUR.paint });
    const plan = planRead(before, { active: active(), offered: [MOSS] });
    expect(plan.choice).toEqual(STUDIO);
    expect(plan.lost).toBe(true);
    expect(paintedChange(before, plan)).toEqual({ from: themeChoice(HARBOUR_ID), to: STUDIO });
  });

  it('no toast for a theme that was never on screen (no painting held), but Studio all the same', () => {
    const before = snapshot({ choice: themeChoice(HARBOUR_ID), paint: null });
    const plan = planRead(before, { active: active(), offered: [] });
    expect(plan.choice).toEqual(STUDIO);
    expect(plan.lost).toBe(false);
  });

  it('themeGone and choiceAfterLoss over the cases', () => {
    const offered = [MOSS_ID];
    const base = { active: active(), offered };
    expect(themeGone({ ...base, choice: themeChoice(HARBOUR_ID), before: HARBOUR_ID })).toBe(true);
    expect(themeGone({ ...base, choice: themeChoice(MOSS_ID), before: MOSS_ID })).toBe(false);
    expect(themeGone({ ...base, choice: builtinChoice('play'), before: null })).toBe(false);
    expect(themeGone({ ...base, choice: FOLLOW_STUDIO, before: HARBOUR_ID })).toBe(false);
    expect(choiceAfterLoss(themeChoice(HARBOUR_ID))).toEqual(STUDIO);
    expect(choiceAfterLoss(FOLLOW_STUDIO)).toBe(FOLLOW_STUDIO);
  });
});
