// Auto's loops in React, on Candy's one clock (clock.ts CANDY_CLOCK): a moving Auto listens to the
// shared ticker and draws motionAt for its tick; a still one (Reduce Motion, the look's Motion
// paused, the pause control, a still drawing) does not listen at all and draws STILL_MOTION, so the
// interval stops once no moving Auto is mounted. Every Auto on screen reads the same tick, so they
// float and blink together.

import { useSyncExternalStore } from 'react';

import { CANDY_CLOCK, STILL_MOTION, clockMs, motionAt, type AutoMotion } from './clock';

function still(): () => void {
  return () => undefined;
}

/** The clock's tick while `moving`; 0 and no listener while still (the orb's arc and the writing dots read it too). */
export function useCandyTick(moving: boolean): number {
  return useSyncExternalStore(
    moving ? CANDY_CLOCK.subscribe : still,
    () => (moving ? CANDY_CLOCK.now() : 0),
    () => 0,
  );
}

/** The float and the blink now, or Auto at rest while not `moving`. */
export function useAutoMotion(moving: boolean): AutoMotion {
  const tick = useCandyTick(moving);
  return moving ? motionAt(clockMs(tick)) : STILL_MOTION;
}
