// The shared paint and touch helpers. Colours come from the tokens, never as literals (D-TOKENS):
// an expectation is a token's hex with the alpha byte the helper should append.

import { describe, expect, it } from 'vitest';

import { tokensFor } from '../../styles/tokens';
import { MIN_TOUCH, hitSlopFor, joinLabel, paint, stackedSlop, tint, touchRoom } from '../paint';

const { colours } = tokensFor('studio', 'light');

describe('paint', () => {
  it('reads a token, and passes transparent through', () => {
    expect(paint(colours, 'accent')).toBe(colours.accent);
    expect(paint(colours, 'transparent')).toBe('transparent');
  });
});

describe('tint: a token at an alpha', () => {
  it('appends the alpha byte to #RRGGBB', () => {
    expect(tint(colours.accent, 0.1)).toBe(`${colours.accent}1A`);
    expect(tint(colours.accent, 0)).toBe(`${colours.accent}00`);
    expect(tint(colours.accent, 1)).toBe(`${colours.accent}FF`);
    expect(tint(colours.accent.toLowerCase(), 0.5)).toBe(`${colours.accent.toLowerCase()}80`);
  });

  it('multiplies an alpha the token already carries (accent2 is the accent at 10 %)', () => {
    expect(tint(tint(colours.accent, 0.1), 0.5)).toBe(`${colours.accent}0D`);
    expect(tint(colours.accent2, 1)).toBe(colours.accent2);
  });

  it('refuses anything that is not a token colour or an alpha', () => {
    expect(() => tint('accent', 0.1)).toThrow(RangeError);
    expect(() => tint(colours.accent.slice(0, 4), 0.1)).toThrow(RangeError);
    expect(() => tint(colours.accent.slice(1), 0.1)).toThrow(RangeError);
    expect(() => tint(colours.accent, 1.5)).toThrow(RangeError);
    expect(() => tint(colours.accent, Number.NaN)).toThrow(RangeError);
  });
});

describe('hitSlopFor: the 44 pt touch target', () => {
  it('grows a small control to 44 tall and leaves a big one alone', () => {
    expect(MIN_TOUCH).toBe(44);
    expect(hitSlopFor(30)).toEqual({ top: 7, bottom: 7, left: 0, right: 0 });
    expect(hitSlopFor(28)).toEqual({ top: 8, bottom: 8, left: 0, right: 0 });
    expect(hitSlopFor(36, 36)).toEqual({ top: 4, bottom: 4, left: 4, right: 4 });
    expect(hitSlopFor(42, 42)).toEqual({ top: 1, bottom: 1, left: 1, right: 1 });
    expect(hitSlopFor(44)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    expect(hitSlopFor(60, 120)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});

describe('touchRoom: the 44 pt touch where the parent would cut the slop off', () => {
  it('pads a row of small controls to 44 and takes the same margin back', () => {
    expect(touchRoom(28)).toEqual({ paddingVertical: 8, marginVertical: -8 });
    expect(touchRoom(30)).toEqual({ paddingVertical: 7, marginVertical: -7 });
    expect(touchRoom(40)).toEqual({ paddingVertical: 2, marginVertical: -2 });
  });

  it('leaves a row of 44 pt controls alone', () => {
    expect(touchRoom(44)).toEqual({ paddingVertical: 0, marginVertical: 0 });
    expect(Object.is(touchRoom(48).marginVertical, 0)).toBe(true);
  });

  it('makes the row exactly the touch target, its drawn height unchanged', () => {
    for (const height of [12.65, 18.75, 28, 30, 36]) {
      const room = touchRoom(height);
      expect(height + 2 * room.paddingVertical).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(height + 2 * room.paddingVertical).toBeLessThan(MIN_TOUCH + 2);
      expect(room.paddingVertical + room.marginVertical).toBe(0);
    }
  });
});

describe('stackedSlop: a column of small controls', () => {
  it('reaches 44 where no control is beside it', () => {
    expect(stackedSlop(18.75, 6, { above: false, below: false })).toEqual(hitSlopFor(18.75));
  });

  it('stops at half the gap toward another control, so two slops never overlap', () => {
    const between = stackedSlop(18.75, 6, { above: true, below: true });
    expect(between).toEqual({ top: 3, bottom: 3, left: 0, right: 0 });
    const first = stackedSlop(18.75, 6, { above: false, below: true });
    const second = stackedSlop(18.75, 6, { above: true, below: false });
    expect(first.bottom + second.top).toBeLessThanOrEqual(6);
    expect(first.top).toBe(13);
  });

  it('never grows a slop past what 44 needs, nor below nothing', () => {
    expect(stackedSlop(40, 30, { above: true, below: true })).toEqual(hitSlopFor(40));
    expect(stackedSlop(20, -4, { above: true, below: false }).top).toBe(0);
  });
});

describe('joinLabel', () => {
  it('joins the parts VoiceOver reads, dropping empty ones and keeping a 0 count', () => {
    expect(joinLabel('Blocked', 3)).toBe('Blocked, 3');
    expect(joinLabel('Blocked', 0)).toBe('Blocked, 0');
    expect(joinLabel('Blocked', undefined)).toBe('Blocked');
    expect(joinLabel('', null, '  ', 'Daily digest', 'Board, Calendar')).toBe(
      'Daily digest, Board, Calendar',
    );
  });
});
