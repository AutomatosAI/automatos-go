// The one clock every suggestions surface shares (minute-ticker.ts), driven by hand: one timer
// however many surfaces read it, set for the next turn of the minute, gone when the last stops.

import { describe, expect, it } from 'vitest';

import { createMinuteTicker, type TickerClock } from '../minute-ticker';

const AT = Date.parse('2026-10-28T08:59:10Z');
const MINUTE_MS = 60_000;

/** A clock and timers the test moves by hand. */
function handClock(start: number) {
  let now = start;
  let waiting: { run: () => void; ms: number; handle: number }[] = [];
  let next = 0;
  const clock: TickerClock = {
    now: () => now,
    set: (run, ms) => {
      next += 1;
      waiting = [...waiting, { run, ms, handle: next }];
      return next;
    },
    clear: (handle) => {
      waiting = waiting.filter((each) => each.handle !== handle);
    },
  };
  /** Moves the clock to the first timer's moment and runs it. */
  const fire = () => {
    const [first, ...rest] = waiting;
    waiting = rest;
    if (!first) return;
    now += first.ms;
    first.run();
  };
  return { clock, fire, timers: () => waiting.map((each) => each.ms) };
}

describe('the minute ticker', () => {
  it('keeps one timer for every reader, set for the next turn of the minute', () => {
    const hand = handClock(AT);
    const ticker = createMinuteTicker(hand.clock);
    ticker.subscribe(() => undefined);
    ticker.subscribe(() => undefined);
    ticker.subscribe(() => undefined);
    expect(hand.timers()).toEqual([50_000]);
  });

  it('tells every reader at each turn, and its minute changes only then', () => {
    const hand = handClock(AT);
    const ticker = createMinuteTicker(hand.clock);
    let heard = 0;
    ticker.subscribe(() => (heard += 1));
    ticker.subscribe(() => (heard += 1));
    const before = ticker.minute();
    hand.fire();
    expect(heard).toBe(2);
    expect(ticker.minute()).toBe(before + 1);
    expect(hand.timers()).toEqual([MINUTE_MS]);
    hand.fire();
    expect(heard).toBe(4);
  });

  it('stops when the last reader goes, and starts again with the next', () => {
    const hand = handClock(AT);
    const ticker = createMinuteTicker(hand.clock);
    const stopFirst = ticker.subscribe(() => undefined);
    const stopSecond = ticker.subscribe(() => undefined);
    stopFirst();
    expect(hand.timers()).toHaveLength(1);
    stopSecond();
    expect(hand.timers()).toEqual([]);
    ticker.subscribe(() => undefined);
    expect(hand.timers()).toHaveLength(1);
  });
});
