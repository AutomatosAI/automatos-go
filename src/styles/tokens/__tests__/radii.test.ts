import { describe, expect, it } from 'vitest';

import { BUILT_IN_STYLE_IDS } from '../../registry/style-id';
import { STYLE_RADII } from '../radii';
import { STUDIO_RADII } from '../studio';

const NAMES = [...Object.keys(STUDIO_RADII), 'input'].sort();

describe('STYLE_RADII', () => {
  it('keeps Studio’s handoff radii unchanged, inputs at its 6 pt', () => {
    expect(STYLE_RADII.studio).toEqual({ ...STUDIO_RADII, input: 6 });
  });

  it('gives Play Ember’s radii: 6 paper, 8 tool line, 10 button, 12 field, 14 card, pill chips', () => {
    expect(STYLE_RADII.play).toEqual({
      tag: 999,
      chip: 8,
      segment: 10,
      control: 10,
      input: 12,
      card: 14,
      panel: 14,
      pill: 999,
      sheet: 14,
      full: 999,
      paper: 6,
    });
  });

  it('squares every HUD corner', () => {
    expect(Object.values(STYLE_RADII.hud).every((radius) => radius === 0)).toBe(true);
  });

  it('squares every Arcade corner, its message field too', () => {
    expect(Object.values(STYLE_RADII.arcade).every((radius) => radius === 0)).toBe(true);
    expect(STYLE_RADII.arcade.input).toBe(0);
  });

  it('names the same radii in every style (Play adds paper), frozen', () => {
    expect(Object.keys(STYLE_RADII).sort()).toEqual([...BUILT_IN_STYLE_IDS].sort());
    expect(Object.keys(STYLE_RADII.studio).sort()).toEqual(NAMES);
    expect(Object.keys(STYLE_RADII.hud).sort()).toEqual(NAMES);
    expect(Object.keys(STYLE_RADII.arcade).sort()).toEqual(NAMES);
    expect(Object.keys(STYLE_RADII.play).sort()).toEqual([...NAMES, 'paper'].sort());
    expect(Object.isFrozen(STYLE_RADII)).toBe(true);
    for (const id of BUILT_IN_STYLE_IDS) expect(Object.isFrozen(STYLE_RADII[id])).toBe(true);
  });
});
