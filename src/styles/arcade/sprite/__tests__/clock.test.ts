// Arcade's one clock (D-ARC-5): the kit's timing (60 ms ticks, a sprite frame every 3, the cursor
// every 8), frameAt's sequence for every state against the kit's frames as its AutoSprite steps
// them (frames[floor(tick / SPRITE_TICKS) % frames.length], pixel-art.tsx at 034fa629c), cursorOn as
// its dialogue's blink (floor(tick / CURSOR_TICKS) % 2 === 0), and the shared ticker: one interval,
// started by the first listener and stopped when the last one leaves.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { MASCOT_STATES } from '../../../../core/frozen/lib/mascot/types';
import {
  ARCADE_CLOCK,
  CURSOR_TICKS,
  SPRITE_TICKS,
  TICK_MS,
  createTicker,
  cursorOn,
  frameAt,
  frameIndexAt,
} from '../clock';
import { spriteState } from '../states';
import { KIT_FRAMES, digest } from './kit-frames';

afterEach(() => {
  vi.useRealTimers();
});

describe("the clock's timing", () => {
  it('is the kit’s: 60 ms ticks, a sprite frame every 3, the cursor every 8', () => {
    expect(TICK_MS).toBe(60);
    expect(SPRITE_TICKS).toBe(3);
    expect(CURSOR_TICKS).toBe(8);
  });

  it.each(MASCOT_STATES)('frameAt steps %s through the kit’s frames every 3 ticks', (name) => {
    const frames = KIT_FRAMES[name];
    const ticks = Array.from({ length: SPRITE_TICKS * frames.length * 2 + 1 }, (_, tick) => tick);
    const kit = ticks.map((tick) => frames[Math.floor(tick / SPRITE_TICKS) % frames.length]);
    expect(ticks.map((tick) => digest(frameAt(name, tick)))).toEqual(kit);
  });

  it('pins the frame index sequence: idle over 15 ticks', () => {
    const indices = Array.from({ length: 15 }, (_, tick) => frameIndexAt(4, tick));
    expect(indices).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0, 0, 0]);
  });

  it('shows frame 1 at tick 0 (the still) and never before it', () => {
    MASCOT_STATES.forEach((name) => {
      expect(frameAt(name, 0)).toBe(spriteState(name).frames[0]);
      expect(frameAt(name, -5)).toBe(spriteState(name).frames[0]);
    });
    expect(frameIndexAt(0, 7)).toBe(0);
  });

  it('blinks the cursor: on for 8 ticks, off for 8, on at tick 0', () => {
    const blink = Array.from({ length: 24 }, (_, tick) => cursorOn(tick));
    expect(blink.slice(0, 8).every(Boolean)).toBe(true);
    expect(blink.slice(8, 16).some(Boolean)).toBe(false);
    expect(blink.slice(16, 24).every(Boolean)).toBe(true);
    expect(cursorOn(0)).toBe(true);
  });
});

describe('the shared ticker', () => {
  it('runs one interval while someone listens, and stops when the last one leaves', () => {
    vi.useFakeTimers();
    const ticker = createTicker();
    const first = vi.fn();
    const second = vi.fn();
    expect(ticker.running()).toBe(false);
    const leaveFirst = ticker.subscribe(first);
    const leaveSecond = ticker.subscribe(second);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(TICK_MS * 3);
    expect(ticker.now()).toBe(3);
    expect(first).toHaveBeenCalledTimes(3);
    expect(second).toHaveBeenCalledTimes(3);
    leaveFirst();
    expect(ticker.running()).toBe(true);
    leaveSecond();
    expect(ticker.running()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(TICK_MS * 5);
    expect(ticker.now()).toBe(3);
  });

  it('starts again for a new listener and keeps counting from where it stopped', () => {
    vi.useFakeTimers();
    const ticker = createTicker();
    const leave = ticker.subscribe(() => undefined);
    vi.advanceTimersByTime(TICK_MS * 2);
    leave();
    leave();
    const again = ticker.subscribe(() => undefined);
    vi.advanceTimersByTime(TICK_MS);
    expect(ticker.now()).toBe(3);
    again();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('takes its timers from the caller (one interval of TICK_MS)', () => {
    const setInterval = vi.fn(() => 'handle');
    const clearInterval = vi.fn();
    const ticker = createTicker(TICK_MS, { setInterval, clearInterval });
    const leave = ticker.subscribe(() => undefined);
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), TICK_MS);
    leave();
    expect(clearInterval).toHaveBeenCalledWith('handle');
  });

  it("the app's clock is idle while nothing moving is mounted", () => {
    expect(ARCADE_CLOCK.running()).toBe(false);
  });
});
