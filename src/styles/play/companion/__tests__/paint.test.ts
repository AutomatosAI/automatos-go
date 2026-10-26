// What the Companion paints with (US-017c): each tool chip's fill, line and inks, the receipts'
// badges and the composer's button, all the look's variables or the lines tokens/ derives — in
// Ember and in Daylight, Play's one light ground.

import { describe, expect, it } from 'vitest';

import { DAYLIGHT, EMBER, PRESETS } from '../../../../core/frozen/lib/looks/presets';
import type { Look } from '../../../../core/frozen/lib/looks/types';
import { companionColours } from '../../../tokens/companion-colours';
import { playTokens, playVars } from '../../../tokens/play';
import { badgeInk, chipPaint, composerButtonPaint, type CompanionColourSource } from '../paint';

function source(look: Look): CompanionColourSource {
  const vars = playVars(look);
  return { vars, lines: companionColours(vars), text3: playTokens(look).fg3 };
}

describe('tool chips', () => {
  it.each([EMBER, DAYLIGHT])('paints running on the accent fill with its line and spinner (%#)', (look) => {
    const paint = source(look);
    expect(chipPaint('running', paint)).toEqual({
      fill: paint.vars.accentFill,
      line: paint.lines.accentLine,
      ink: paint.vars.accentText,
      markInk: paint.vars.accentText,
      spinner: true,
    });
    expect(chipPaint('waiting', paint)).toMatchObject({ fill: paint.vars.accentFill, spinner: false });
  });

  it("paints done on the ground's chip in text2 with no line", () => {
    const paint = source(EMBER);
    expect(chipPaint('done', paint)).toEqual({
      fill: paint.vars.groundChip,
      line: null,
      ink: paint.vars.groundText2,
      markInk: paint.vars.groundText2,
      spinner: false,
    });
  });

  it("paints failed in the error: its fill, its line, the error text and a ✕ in the error", () => {
    const paint = source(EMBER);
    expect(chipPaint('failed', paint)).toEqual({
      fill: paint.lines.failedFill,
      line: paint.lines.failedLine,
      ink: paint.vars.errorText,
      markInk: paint.vars.error,
      spinner: false,
    });
  });

  it('fades a skipped or stopped call to text-3', () => {
    const paint = source(EMBER);
    expect(chipPaint('muted', paint)).toMatchObject({ ink: paint.text3, line: null });
  });
});

describe('badges and the composer', () => {
  it('draws Done in the accent text, Not done in the error text, Skipped faded', () => {
    const paint = source(EMBER);
    expect(badgeInk('accent', paint)).toBe(paint.vars.accentText);
    expect(badgeInk('error', paint)).toBe(paint.vars.errorText);
    expect(badgeInk('faded', paint)).toBe(paint.text3);
  });

  it.each(PRESETS)("draws Send in the ground's text with the ground as ink, the accent on First open", (look) => {
    const paint = source(look);
    expect(composerButtonPaint({ fill: 'cream' }, paint)).toEqual({
      fill: paint.vars.groundText,
      ink: paint.vars.groundBg,
    });
    expect(composerButtonPaint({ fill: 'accent' }, paint)).toEqual({
      fill: paint.vars.accent,
      ink: paint.vars.accentInk,
    });
  });
});
