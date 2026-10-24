// The flip (D54, D-A11Y): nothing for the style already shown; otherwise the choice, a 180 ms
// crossfade (none under Reduce Motion) and, entering Play, Auto's hello — the vendored reducer's
// 'app-open', which plays his hello clip.

import { describe, expect, it } from 'vitest';

import { INITIAL_MASCOT, mascotReducer } from '../../../core/web/lib/mascot/reducer';
import { FOLLOW_STUDIO, builtinChoice, themeChoice } from '../../registry/style-id';
import { FLIP_CROSSFADE_MS, FLIP_HELLO, flipPlan, phoneFlipPlan } from '../flip-plan';

const STUDIO = builtinChoice('studio');
const PLAY = builtinChoice('play');
const HUD = builtinChoice('hud');
const THEME = themeChoice('3f2b6c1e-9d4a-4b7e-8c21-5a6f0e9d1b42');

describe('flipPlan', () => {
  it('does nothing for the style already shown', () => {
    for (const choice of [STUDIO, PLAY, HUD, THEME]) {
      expect(flipPlan(choice, { ...choice }, false)).toEqual({ changed: false });
    }
  });

  it('crossfades for 180 ms, and swaps at once under Reduce Motion', () => {
    expect(FLIP_CROSSFADE_MS).toBe(180);
    expect(flipPlan(STUDIO, HUD, false)).toMatchObject({ changed: true, crossfadeMs: 180 });
    expect(flipPlan(STUDIO, HUD, true)).toMatchObject({ changed: true, crossfadeMs: 0 });
  });

  it('carries the choice it flips to', () => {
    expect(flipPlan(PLAY, THEME, false)).toMatchObject({ changed: true, choice: THEME });
  });

  it('has Auto say hello once for a flip that enters Play', () => {
    for (const from of [STUDIO, HUD, THEME]) {
      expect(flipPlan(from, PLAY, false)).toMatchObject({ hello: true });
      expect(flipPlan(from, PLAY, true)).toMatchObject({ hello: true });
    }
  });

  it('has Auto say nothing for a flip that leaves Play or never enters it', () => {
    expect(flipPlan(PLAY, HUD, false)).toMatchObject({ hello: false });
    expect(flipPlan(PLAY, STUDIO, false)).toMatchObject({ hello: false });
    expect(flipPlan(PLAY, THEME, false)).toMatchObject({ hello: false });
    expect(flipPlan(STUDIO, HUD, false)).toMatchObject({ hello: false });
    expect(flipPlan(HUD, THEME, false)).toMatchObject({ hello: false });
  });

  it("sends the vendored reducer's app-open, which plays Auto's hello", () => {
    expect(FLIP_HELLO).toEqual({ type: 'app-open' });
    expect(mascotReducer(INITIAL_MASCOT, FLIP_HELLO).mascot).toBe('hello');
  });
});

describe("phoneFlipPlan: a pick on the phone, 'Same as Studio' included (D-PHONE-CHOICE)", () => {
  it('does nothing for the choice already stored', () => {
    expect(phoneFlipPlan(FOLLOW_STUDIO, { kind: 'follow' }, PLAY, false)).toEqual({
      changed: false,
    });
    expect(phoneFlipPlan(HUD, { ...HUD }, PLAY, false)).toEqual({ changed: false });
  });

  it("stores 'Same as Studio' at once when it paints what is already shown", () => {
    expect(phoneFlipPlan(PLAY, FOLLOW_STUDIO, PLAY, false)).toEqual({
      changed: true,
      choice: FOLLOW_STUDIO,
      crossfadeMs: 0,
      hello: false,
    });
  });

  it("crossfades into what Studio uses, with Auto's hello when that is Play", () => {
    expect(phoneFlipPlan(HUD, FOLLOW_STUDIO, PLAY, false)).toEqual({
      changed: true,
      choice: FOLLOW_STUDIO,
      crossfadeMs: FLIP_CROSSFADE_MS,
      hello: true,
    });
    expect(phoneFlipPlan(STUDIO, FOLLOW_STUDIO, THEME, true)).toMatchObject({ crossfadeMs: 0 });
  });

  it('a pick that overrides the follow crossfades from what Studio painted', () => {
    expect(phoneFlipPlan(FOLLOW_STUDIO, HUD, THEME, false)).toEqual({
      changed: true,
      choice: HUD,
      crossfadeMs: FLIP_CROSSFADE_MS,
      hello: false,
    });
    expect(phoneFlipPlan(FOLLOW_STUDIO, PLAY, PLAY, false)).toMatchObject({
      changed: true,
      crossfadeMs: 0,
      hello: false,
    });
  });
});
