// A filter pill's count (rule 10.5): a colour, never an opacity on the text, so the contrast test
// can hold it at AA in every style's dress (src/styles/__tests__/contrast.test.ts). It is the
// pill's ink at three quarters over the ground the pill shows, as it always looked, and the ink
// itself where that would read under AA.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { AA_TEXT, contrastRatio, mixHex } from '../../core/web/lib/look-kit/contrast';
import { dressOf } from '../../styles/dress/dress';
import { CANDY, HUD_STYLES, STUDIO_LIGHT } from '../../styles/dress/__tests__/fixtures';
import { PILL_COUNT_ALPHA, pillCount } from '../pill-count';

const pill = readFileSync(path.resolve(__dirname, '..', 'Pill.tsx'), 'utf8');

describe("a pill's count", () => {
  it('is drawn in a colour, never an opacity (read from source)', () => {
    expect(pill).toContain('pillCount(dress, { selected, pressed }, colours.background).colour;');
    expect(pill).toContain('<Text variant="mono" style={{ color: countInk(pressed) }}>');
    expect(pill).not.toMatch(/opacity: PILL_COUNT/);
  });

  it("is Studio's ink at three quarters over the pill, as it looked before", () => {
    const { colours } = STUDIO_LIGHT.tokens;
    const idle = pillCount(dressOf(STUDIO_LIGHT), { selected: false }, colours.background);
    expect(PILL_COUNT_ALPHA).toBe(0.75);
    expect(idle).toEqual({
      ground: colours.card,
      colour: mixHex(colours.card, colours.foreground, PILL_COUNT_ALPHA),
      measured: true,
    });
  });

  it('shows the page where the pill has no fill', () => {
    const hud = HUD_STYLES[0];
    expect(hud).toBeDefined();
    if (!hud) return;
    const { background } = hud.tokens.colours;
    expect(pillCount(dressOf(hud), { selected: false }, background).ground).toBe(background);
  });

  it('is read on the pressed fill while a finger is on it, and a chosen pill draws no press', () => {
    const { colours } = STUDIO_LIGHT.tokens;
    const dress = dressOf(STUDIO_LIGHT);
    const pressed = pillCount(dress, { selected: false, pressed: true }, colours.background);
    expect(pressed.ground).toBe(dress.paints.pill.pressed.background);
    expect(pillCount(dress, { selected: true, pressed: true }, colours.background)).toEqual(
      pillCount(dress, { selected: true }, colours.background),
    );
  });

  it('never throws on a colour it cannot read: the ink as written, not measured', () => {
    const dress = dressOf(STUDIO_LIGHT);
    const odd = {
      ...dress,
      paints: {
        ...dress.paints,
        pill: {
          ...dress.paints.pill,
          rest: { ...dress.paints.pill.rest, background: 'not a colour' },
        },
      },
    };
    const count = pillCount(odd, { selected: false }, STUDIO_LIGHT.tokens.colours.background);
    expect(count).toEqual({
      colour: dress.paints.pill.rest.foreground,
      ground: STUDIO_LIGHT.tokens.colours.background,
      measured: false,
    });
    // a pill with no fill shows the page, which here cannot be read
    const hud = HUD_STYLES[0];
    expect(hud && pillCount(dressOf(hud), { selected: false }, 'nonsense').measured).toBe(false);
  });

  it('takes the ink itself where three quarters would read under AA', () => {
    const { background } = CANDY.tokens.colours;
    const dress = dressOf(CANDY);
    const chosen = pillCount(dress, { selected: true }, background);
    const ink = dress.paints.pill.selected.foreground;
    expect(contrastRatio(mixHex(chosen.ground, ink, PILL_COUNT_ALPHA), chosen.ground)).toBeLessThan(
      AA_TEXT,
    );
    expect(chosen.colour).toBe(ink);
    expect(contrastRatio(chosen.colour, chosen.ground)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
