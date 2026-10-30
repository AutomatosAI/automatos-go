// Arcade's one clock (PRD-001 §4.6.1, D-ARC-5; the design's "one clock, 60 ms ticks"): sprite frames
// step every SPRITE_TICKS, the ▶ / ▼ cursor blinks every CURSOR_TICKS, and the dialogue box types
// on the same ticks (US-022f). The timing is the design kit's themes/arcade/src/motion/clock.ts at
// 034fa629c (sha256 7cfb56117f9e9fa4b051f7a1b1af6aa0fa0b614d8db4cdc6acc42091ff2b3aa7), as
// functions of a tick count: frameAt(state, tick) and cursorOn(tick). Its ticker is ARCADE_CLOCK,
// one JS interval shared by everything that moves: it runs only while something listens and stops
// when the last listener goes, so nothing ticks while no sprite, cursor or typed line is mounted
// or while they are still (use-ticks.ts subscribes only while moving). Pure: no React, React
// Native, Expo or Skia.

import type { MascotName } from '../../../core/frozen/lib/mascot/types';
import { spriteState, type SpriteFrame } from './states';

/** One tick, in milliseconds (the design's 60 ms). */
export const TICK_MS = 60;
/** A sprite steps to its next frame every 3 ticks (180 ms). */
export const SPRITE_TICKS = 3;
/** The cursor turns on or off every 8 ticks (480 ms). */
export const CURSOR_TICKS = 8;

/** Which of `frameCount` frames shows at `tick`: a new one every SPRITE_TICKS, looping. */
export function frameIndexAt(frameCount: number, tick: number): number {
  if (frameCount <= 0) return 0;
  return Math.floor(Math.max(0, tick) / SPRITE_TICKS) % frameCount;
}

/** The state's frame at `tick`; tick 0 is its first frame, the still. */
export function frameAt(state: MascotName, tick: number): SpriteFrame {
  const { frames } = spriteState(state);
  return frames[frameIndexAt(frames.length, tick)];
}

/** The cursor at `tick`: on for CURSOR_TICKS, off for CURSOR_TICKS; on at tick 0 (and when still). */
export function cursorOn(tick: number): boolean {
  return Math.floor(Math.max(0, tick) / CURSOR_TICKS) % 2 === 0;
}

export type Ticker = {
  /** The ticks counted since the ticker was made. */
  readonly now: () => number;
  /** Hears every tick; the first listener starts the interval, the last one to leave stops it. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The interval runs (someone listens). */
  readonly running: () => boolean;
};

export type TickTimers = {
  readonly setInterval: (run: () => void, ms: number) => unknown;
  readonly clearInterval: (handle: unknown) => void;
};

const GLOBAL_TIMERS: TickTimers = {
  setInterval: (run, ms) => setInterval(run, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

/** A ticker over one interval of `intervalMs`, started and stopped by its listeners. */
export function createTicker(intervalMs = TICK_MS, timers: TickTimers = GLOBAL_TIMERS): Ticker {
  let tick = 0;
  let handle: unknown = undefined;
  let started = false;
  const listeners = new Set<() => void>();

  const advance = () => {
    tick += 1;
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (!started) {
      started = true;
      handle = timers.setInterval(advance, intervalMs);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size > 0 || !started) return;
      timers.clearInterval(handle);
      started = false;
      handle = undefined;
    };
  };

  return Object.freeze({ now: () => tick, subscribe, running: () => started });
}

/** The app's one Arcade clock: every sprite, cursor and typed line reads it. */
export const ARCADE_CLOCK: Ticker = createTicker();

/** The clock's tick now. */
export function clockNow(): number {
  return ARCADE_CLOCK.now();
}
