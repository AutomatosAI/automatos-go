// Arcade's clock in React (the kit's motion/clock.ts useTicks): a component reads the tick divided
// down to what it draws, so a sprite renders again only when its frame changes and a cursor only
// when it blinks, never on every tick. Still (Reduce Motion, the pause control, a still sprite), it
// does not subscribe at all: the shared interval stops once nothing moving is mounted.

import { useSyncExternalStore } from 'react';

import { ARCADE_CLOCK, CURSOR_TICKS, cursorOn } from './clock';

function still(): () => void {
  return () => undefined;
}

/** The tick divided by `every`, re-rendering when it moves on; 0 and no clock while not `running`. */
export function useTicks(every: number, running: boolean): number {
  return useSyncExternalStore(
    running ? ARCADE_CLOCK.subscribe : still,
    () => (running ? Math.floor(ARCADE_CLOCK.now() / every) : 0),
    () => 0,
  );
}

/** The ▶ / ▼ cursor: blinking every CURSOR_TICKS while `running`, on while still (the README). */
export function useCursorOn(running: boolean): boolean {
  return cursorOn(useTicks(CURSOR_TICKS, running) * CURSOR_TICKS);
}
