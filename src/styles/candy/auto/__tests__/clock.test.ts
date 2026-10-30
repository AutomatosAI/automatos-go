// Candy's one clock (D-CAN-5; the kit's art/art.module.css at 3920359d5): the float, 3 s each way
// ease-in-out up 3.5 of the 104 units (4 pt at 120 pt); the blink on a fixed cycle of periods
// inside 4–6 s, the eyes shut to scaleY 0.1 over each period's last 6 % (94 % → 97 % → 100 %);
// motionAt joining both and STILL_MOTION at rest; and the one ticker every moving Auto shares,
// running only while something listens.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTO_BOX } from '../auto-geometry';
import {
  BLINK_CLOSES,
  BLINK_PERIODS_MS,
  BLINK_SCALE,
  BLINK_SHUT,
  CANDY_CLOCK,
  FLOAT_MS,
  FLOAT_UNITS,
  FRAME_MS,
  STILL_MOTION,
  blinkPhaseAt,
  clockMs,
  easeInOut,
  eyeScaleAt,
  floatAt,
  motionAt,
} from '../clock';

afterEach(() => {
  vi.useRealTimers();
});

describe("CSS's ease-in-out", () => {
  it('is cubic-bezier(0.42, 0, 0.58, 1)', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.1)).toBeCloseTo(0.019722, 5);
    expect(easeInOut(0.25)).toBeCloseTo(0.129162, 5);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 9);
    expect(easeInOut(0.75)).toBeCloseTo(0.870838, 5);
    expect(easeInOut(0.9)).toBeCloseTo(0.980278, 5);
  });

  it('rises the whole way and is the same curve backwards', () => {
    const xs = Array.from({ length: 101 }, (_, i) => i / 100);
    const ys = xs.map(easeInOut);
    ys.slice(1).forEach((y, i) => expect(y).toBeGreaterThanOrEqual(ys[i] as number));
    xs.forEach((x) => expect(easeInOut(1 - x)).toBeCloseTo(1 - easeInOut(x), 9));
  });

  it('holds its ends outside 0–1', () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(2)).toBe(1);
  });
});

describe('the float', () => {
  it('rises 3.5 of the 104 units: 4 pt when Auto is drawn at 120 pt', () => {
    expect(FLOAT_MS).toBe(3000);
    expect(FLOAT_UNITS).toBe(3.5);
    expect(Math.round((FLOAT_UNITS * 120) / AUTO_BOX.size)).toBe(4);
  });

  it('goes up for 3 s and down for 3 s, ease-in-out (up is negative)', () => {
    expect(floatAt(0)).toBe(0);
    expect(floatAt(750)).toBeCloseTo(-0.452067, 5);
    expect(floatAt(1500)).toBeCloseTo(-1.75, 9);
    expect(floatAt(2250)).toBeCloseTo(-3.047933, 5);
    expect(floatAt(3000)).toBe(-3.5);
    expect(floatAt(4500)).toBeCloseTo(-1.75, 9);
    expect(floatAt(6000)).toBe(0);
  });

  it('goes the same way back as up, and round again every 6 s', () => {
    [250, 900, 1800, 2700].forEach((ms) => {
      expect(floatAt(FLOAT_MS * 2 - ms)).toBeCloseTo(floatAt(ms), 9);
      expect(floatAt(ms + FLOAT_MS * 2 * 3)).toBeCloseTo(floatAt(ms), 9);
    });
  });

  it('is at rest before the clock starts', () => {
    expect(floatAt(-500)).toBe(0);
  });
});

describe('the blink', () => {
  it('runs a fixed cycle of periods, each inside 4–6 s (the web blinks every 5 s)', () => {
    expect(BLINK_PERIODS_MS).toEqual([5000, 4200, 5800, 4600, 5400]);
    BLINK_PERIODS_MS.forEach((period) => {
      expect(period).toBeGreaterThanOrEqual(4000);
      expect(period).toBeLessThanOrEqual(6000);
    });
    expect(Object.isFrozen(BLINK_PERIODS_MS)).toBe(true);
  });

  it("closes over each period's last 6 %: shut at 97 %, open again at its end", () => {
    expect([BLINK_CLOSES, BLINK_SHUT, BLINK_SCALE]).toEqual([0.94, 0.97, 0.1]);
    expect(eyeScaleAt(0)).toBe(1);
    expect(eyeScaleAt(4699)).toBe(1);
    expect(eyeScaleAt(4700)).toBe(1);
    expect(eyeScaleAt(4775)).toBeCloseTo(0.55, 9);
    expect(eyeScaleAt(4850)).toBeCloseTo(0.1, 9);
    expect(eyeScaleAt(4925)).toBeCloseTo(0.55, 9);
    expect(eyeScaleAt(5000)).toBe(1);
  });

  it('finds the period a moment falls in, and starts the cycle again after 25 s', () => {
    expect(blinkPhaseAt(0)).toEqual({ period: 0, progress: 0 });
    expect(blinkPhaseAt(5000)).toEqual({ period: 1, progress: 0 });
    expect(blinkPhaseAt(9200)).toEqual({ period: 2, progress: 0 });
    expect(blinkPhaseAt(24999).period).toBe(4);
    expect(blinkPhaseAt(25000)).toEqual({ period: 0, progress: 0 });
    expect(blinkPhaseAt(-1)).toEqual({ period: 0, progress: 0 });
  });

  it('shuts once in every period, at 97 % of it', () => {
    const ends = BLINK_PERIODS_MS.reduce<number[]>(
      (acc, period) => [...acc, (acc[acc.length - 1] ?? 0) + period],
      [],
    );
    ends.forEach((end, i) => {
      const period = BLINK_PERIODS_MS[i] as number;
      const start = end - period;
      expect(eyeScaleAt(start + period * BLINK_SHUT)).toBeCloseTo(BLINK_SCALE, 9);
      expect(eyeScaleAt(start + period * 0.5)).toBe(1);
    });
    const shutMoments = Array.from({ length: 25000 / 25 }, (_, i) => i * 25).filter(
      (ms) => eyeScaleAt(ms) < 0.2,
    );
    const blinks = shutMoments.filter(
      (ms, i) => i === 0 || ms - (shutMoments[i - 1] as number) > 25,
    );
    expect(blinks).toHaveLength(5);
  });
});

describe('motionAt', () => {
  it('joins both loops on one clock', () => {
    expect(motionAt(0)).toEqual(STILL_MOTION);
    expect(motionAt(3000)).toEqual({ floatY: -3.5, eyeScale: 1 });
    const shut = motionAt(4850);
    expect(shut.floatY).toBeCloseTo(floatAt(4850), 9);
    expect(shut.eyeScale).toBeCloseTo(0.1, 9);
    expect(Object.isFrozen(shut)).toBe(true);
  });

  it('is at rest with open eyes when still', () => {
    expect(STILL_MOTION).toEqual({ floatY: 0, eyeScale: 1 });
    expect(Object.isFrozen(STILL_MOTION)).toBe(true);
  });
});

describe('the one Candy clock', () => {
  it('counts ticks of about 30 frames a second as milliseconds of motion', () => {
    expect(FRAME_MS).toBe(33);
    expect(clockMs(0)).toBe(0);
    expect(clockMs(10)).toBe(330);
    expect(clockMs(-3)).toBe(0);
  });

  it('runs only while something listens, and every listener hears the same tick', () => {
    vi.useFakeTimers();
    expect(CANDY_CLOCK.running()).toBe(false);
    const heard: number[] = [];
    const first = CANDY_CLOCK.subscribe(() => heard.push(CANDY_CLOCK.now()));
    const second = CANDY_CLOCK.subscribe(() => heard.push(CANDY_CLOCK.now()));
    expect(CANDY_CLOCK.running()).toBe(true);
    const before = CANDY_CLOCK.now();
    vi.advanceTimersByTime(FRAME_MS * 2);
    expect(heard).toEqual([before + 1, before + 1, before + 2, before + 2]);
    first();
    expect(CANDY_CLOCK.running()).toBe(true);
    second();
    expect(CANDY_CLOCK.running()).toBe(false);
    vi.advanceTimersByTime(FRAME_MS * 5);
    expect(CANDY_CLOCK.now()).toBe(before + 2);
  });
});
