// The waveform's table (US-018b): wave() in 'Automatos Command HUD.dc.html' — 44 bars 36 high on the
// phone, each bar's level, height, opacity, breath and delay, the shared width and A6's levels.

import { describe, expect, it } from 'vitest';

import { WAVE, barWidth, levelScales, waveBar, waveBars, waveValue } from '../waveform';

const formula = (i: number) => 0.25 + 0.75 * Math.abs(Math.sin(1.7 * i) * Math.cos(0.37 * i));

describe('the bars', () => {
  it('are 44 bars 36 high with 3 pt gaps on the phone, 72 x 44 on the desktop', () => {
    expect(WAVE.phone).toEqual({ bars: 44, height: 36 });
    expect(WAVE.desktop).toEqual({ bars: 72, height: 44 });
    expect(WAVE.gap).toBe(3);
    expect(waveBars()).toHaveLength(44);
    expect(waveBars(72, 44)).toHaveLength(72);
  });

  it('bar 0 stands at 0.25: 9 high at opacity 0.5125, 0.6 s, no delay', () => {
    expect(waveBar(0)).toEqual({
      index: 0,
      value: 0.25,
      height: 9,
      opacity: 0.5125,
      durationMs: 600,
      delayMs: 0,
    });
  });

  it('bar 7 follows the formula: v 0.6448, 23 high, opacity 0.7692, 0.84 s, no delay', () => {
    const bar = waveBar(7);
    expect(bar.value).toBeCloseTo(formula(7), 12);
    expect(bar.value).toBeCloseTo(0.6448, 4);
    expect(bar.height).toBe(23);
    expect(bar.height).toBe(Math.round(36 * formula(7)));
    expect(bar.opacity).toBeCloseTo(0.35 + 0.65 * formula(7), 12);
    expect(bar.opacity).toBeCloseTo(0.7692, 4);
    expect(bar.durationMs).toBe(840); // 0.6 + (7 mod 5) x 0.12
    expect(bar.delayMs).toBe(0); // (7 mod 7) x 0.07
  });

  it('every bar keeps the formula, its breath and delay cycling by 5 and 7', () => {
    waveBars().forEach((bar, i) => {
      expect(bar.value).toBeCloseTo(formula(i), 12);
      expect(bar.value).toBeGreaterThanOrEqual(0.25);
      expect(bar.value).toBeLessThanOrEqual(1);
      expect(bar.durationMs).toBe(Math.round((0.6 + (i % 5) * 0.12) * 1000));
      expect(bar.delayMs).toBe(Math.round((i % 7) * 0.07 * 1000));
    });
    expect(waveBar(4).durationMs).toBe(1080);
    expect(waveBar(6).delayMs).toBe(420);
    expect(waveValue(3)).toBeCloseTo(formula(3), 12);
  });

  it('breathes from 0.25 to 1', () => {
    expect(WAVE.scale).toEqual([0.25, 1]);
  });
});

describe('the width', () => {
  it('shares 350 pt (390 less 20 a side) among 44 bars with 43 gaps of 3', () => {
    expect(barWidth(350)).toBeCloseTo((350 - 43 * 3) / 44, 9);
    expect(barWidth(0)).toBe(0);
    expect(barWidth(100, 0)).toBe(0);
  });
});

describe("A6's levels", () => {
  it('are none without levels: the bars do as motion says', () => {
    expect(levelScales(undefined)).toBeNull();
    expect(levelScales(null)).toBeNull();
    expect(levelScales([])).toBeNull();
  });

  it('spread over the bars in order, held to 0.25-1', () => {
    const scales = levelScales([0, 0.5, 2, Number.NaN], 8);
    expect(scales).toEqual([0.25, 0.25, 0.5, 0.5, 1, 1, 0.25, 0.25]);
    expect(levelScales([0.6], 44)).toEqual(Array.from({ length: 44 }, () => 0.6));
  });
});
