import { describe, expect, it } from 'vitest';

import {
  SLIDER,
  adjustValue,
  clampValue,
  isAdjustAction,
  offsetToValue,
  sliderAccessibilityValue,
  sliderRange,
  sliderShape,
  touchToValue,
  trackLength,
  valueToOffset,
} from '../slider-model';

// Play's glow slider: 0-40, stopped at the look's safe glow (KS9).
const GLOW = sliderRange({ min: 0, max: 40, maxAllowed: 25 });
const GRID = sliderRange({ min: 0, max: 30 });
const TRACK = 300;

describe('sliderRange', () => {
  it('reaches max when nothing caps it, and stops at maxAllowed when something does', () => {
    expect(GRID).toEqual({ min: 0, max: 30, step: 1, highest: 30 });
    expect(GLOW.highest).toBe(25);
  });

  it('keeps the highest value a whole step from min', () => {
    expect(sliderRange({ min: 0, max: 40, step: 4, maxAllowed: 25 }).highest).toBe(24);
    expect(sliderRange({ min: 10, max: 20, step: 3 }).highest).toBe(19);
  });

  it('brings a maxAllowed outside the range inside it', () => {
    expect(sliderRange({ min: 0, max: 40, maxAllowed: 99 }).highest).toBe(40);
    expect(sliderRange({ min: 5, max: 40, maxAllowed: 1 }).highest).toBe(5);
  });

  it('refuses an empty range or a step that never moves', () => {
    expect(() => sliderRange({ min: 4, max: 4 })).toThrow(RangeError);
    expect(() => sliderRange({ min: 0, max: 10, step: 0 })).toThrow(RangeError);
  });
});

describe('clampValue', () => {
  it('rounds to the nearest whole step', () => {
    expect(clampValue(12.4, GLOW)).toBe(12);
    expect(clampValue(12.6, GLOW)).toBe(13);
    expect(clampValue(9, sliderRange({ min: 0, max: 40, step: 4 }))).toBe(8);
  });

  it('never goes under min or past the cap', () => {
    expect(clampValue(-3, GLOW)).toBe(0);
    expect(clampValue(30, GLOW)).toBe(25);
    expect(clampValue(40, GLOW)).toBe(25);
  });
});

describe('value and offset', () => {
  it('lays min to max along the whole track, the cap included', () => {
    expect(valueToOffset(0, GRID, TRACK)).toBe(0);
    expect(valueToOffset(15, GRID, TRACK)).toBe(150);
    expect(valueToOffset(30, GRID, TRACK)).toBe(TRACK);
    expect(valueToOffset(20, GLOW, TRACK)).toBe(150);
  });

  it('stops the thumb at the cap: a value past it sits where the cap does', () => {
    expect(valueToOffset(40, GLOW, TRACK)).toBe(valueToOffset(25, GLOW, TRACK));
    expect(offsetToValue(TRACK, GLOW, TRACK)).toBe(25);
  });

  it('turns an offset into a whole step, clamped at both ends', () => {
    expect(offsetToValue(151, GRID, TRACK)).toBe(15);
    expect(offsetToValue(-20, GRID, TRACK)).toBe(0);
    expect(offsetToValue(TRACK + 50, GRID, TRACK)).toBe(30);
  });

  it('round-trips every reachable value', () => {
    for (let value = GLOW.min; value <= GLOW.highest; value += 1) {
      expect(offsetToValue(valueToOffset(value, GLOW, TRACK), GLOW, TRACK)).toBe(value);
    }
  });

  it('draws nothing on a track not yet measured', () => {
    expect(valueToOffset(20, GLOW, 0)).toBe(0);
    expect(offsetToValue(100, GLOW, 0)).toBe(0);
  });
});

describe('touches', () => {
  it('runs the thumb centre from half a thumb in at each end', () => {
    expect(trackLength(300 + SLIDER.thumbSize)).toBe(300);
    expect(trackLength(10)).toBe(0);
  });

  it('reads a touch under the thumb centre', () => {
    const width = TRACK + SLIDER.thumbSize;
    expect(touchToValue(SLIDER.thumbSize / 2, GRID, width)).toBe(0);
    expect(touchToValue(SLIDER.thumbSize / 2 + 150, GRID, width)).toBe(15);
    expect(touchToValue(width, GRID, width)).toBe(30);
    expect(touchToValue(0, GRID, width)).toBe(0);
  });
});

describe('screen readers', () => {
  it('adjusts by one step, within the range', () => {
    expect(adjustValue(12, GLOW, 'increment')).toBe(13);
    expect(adjustValue(12, GLOW, 'decrement')).toBe(11);
    expect(adjustValue(25, GLOW, 'increment')).toBe(25);
    expect(adjustValue(0, GLOW, 'decrement')).toBe(0);
    expect(adjustValue(8, sliderRange({ min: 0, max: 40, step: 4 }), 'increment')).toBe(12);
  });

  it('knows the two adjust actions and nothing else', () => {
    expect(isAdjustAction('increment')).toBe(true);
    expect(isAdjustAction('decrement')).toBe(true);
    expect(isAdjustAction('activate')).toBe(false);
  });

  it('says min, the highest it reaches, the value and its words', () => {
    expect(sliderAccessibilityValue(30, GLOW, '25 of 40')).toEqual({
      min: 0,
      max: 25,
      now: 25,
      text: '25 of 40',
    });
    expect(sliderAccessibilityValue(7, GRID).text).toBe('7');
  });
});

describe('the drawing', () => {
  it('is a 4 pt track and a 28 pt thumb in a 44 pt row', () => {
    expect(SLIDER).toEqual({ trackHeight: 4, thumbSize: 28, rowHeight: 44 });
  });

  it('is square under HUD and round elsewhere', () => {
    expect(sliderShape(true)).toEqual({ thumbRadius: 0, trackRadius: 0 });
    expect(sliderShape(false)).toEqual({ thumbRadius: 14, trackRadius: 2 });
  });
});
