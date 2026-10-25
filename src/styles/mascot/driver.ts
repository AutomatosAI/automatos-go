// Auto's one step function (D37), pure: the vendored reducer (what Auto should show) and player
// (which clip is on screen, which waits for the clip boundary) moved together, so US-017b's
// Mascot keeps one value and does what the step's action says. Behaviour reference: automatos-ai
// frontend/hooks/use-mascot-player.ts @ 630fc1c85, its effects and timers made explicit:
//
//   an event       the reducer's new target retargets the player (urgent states and anything after
//                  a finished one-shot swap at once, the rest wait for the boundary); under Reduce
//                  Motion every target jumps, since no clip plays to a boundary
//   boundary       the clip on screen reached its end: swap to the queued clip, restart the loop,
//                  or end a one-shot (the reducer is told clip-ended and the player follows it);
//                  under Reduce Motion it is the CLIP_MS timer of a one-shot shown as a still
//   motion         the phone's Reduce Motion changed: on, the target shows at once as a still;
//                  off, its clip plays
//
// action: 'swap' shows player.showing from its start, 'restart' plays the same clip again,
// 'finish' rests a one-shot on its last frame, 'none' changes nothing on screen.

import {
  CLIP_MS,
  clipBoundary,
  jumpTo,
  retarget,
  startPlayer,
  type BoundaryAction,
  type PlayerState,
} from '../../core/web/lib/mascot/player';
import { INITIAL_MASCOT, mascotReducer } from '../../core/web/lib/mascot/reducer';
import { ONE_SHOTS, type MascotEvent, type MascotState } from '../../core/web/lib/mascot/types';

export type MascotDriver = {
  readonly mascot: MascotState;
  readonly player: PlayerState;
  /** The phone's Reduce Motion: no clip plays, so targets jump and one-shots end on a timer. */
  readonly reduceMotion: boolean;
};

export type DriverInput =
  | MascotEvent
  | { readonly type: 'boundary' }
  | { readonly type: 'motion'; readonly reduce: boolean };

export type DriverStep = MascotDriver & { readonly action: BoundaryAction };

export function startDriver(
  reduceMotion: boolean,
  mascot: MascotState = INITIAL_MASCOT,
): MascotDriver {
  return Object.freeze({ mascot, player: startPlayer(mascot.mascot), reduceMotion });
}

function stepOf(
  driver: MascotDriver,
  changes: Partial<MascotDriver>,
  action: BoundaryAction,
): DriverStep {
  return Object.freeze({ ...driver, ...changes, action });
}

/** The player after the reducer's target moved: a swap when another clip starts. */
function follow(driver: MascotDriver, mascot: MascotState, from: PlayerState): DriverStep {
  const move = driver.reduceMotion ? jumpTo : retarget;
  const player = move(from, mascot.mascot);
  return stepOf(driver, { mascot, player }, player.showing !== from.showing ? 'swap' : 'none');
}

function onEvent(driver: MascotDriver, event: MascotEvent): DriverStep {
  const mascot = mascotReducer(driver.mascot, event);
  if (mascot === driver.mascot) return stepOf(driver, {}, 'none');
  return follow(driver, mascot, driver.player);
}

/**
 * A one-shot's end: the reducer hears clip-ended for it and the player follows the new target; a
 * reducer that stays (a stale end) leaves the one-shot resting on its last frame.
 */
function endOneShot(driver: MascotDriver, finished: PlayerState): DriverStep {
  const mascot = mascotReducer(driver.mascot, { type: 'clip-ended', state: finished.showing });
  if (mascot.mascot === finished.showing)
    return stepOf(driver, { mascot, player: finished }, 'finish');
  return follow(driver, mascot, finished);
}

function onBoundary(driver: MascotDriver): DriverStep {
  const { player } = driver;
  if (driver.reduceMotion) {
    const oneShot = ONE_SHOTS.has(player.showing) && !player.finished;
    return oneShot ? endOneShot(driver, { ...player, finished: true }) : stepOf(driver, {}, 'none');
  }
  const boundary = clipBoundary(player);
  if (boundary.action === 'finish') return endOneShot(driver, boundary.player);
  return stepOf(driver, { player: boundary.player }, boundary.action);
}

function onMotion(driver: MascotDriver, reduce: boolean): DriverStep {
  if (reduce === driver.reduceMotion) return stepOf(driver, {}, 'none');
  const target = driver.mascot.mascot;
  const player = reduce ? jumpTo(driver.player, target) : retarget(driver.player, target);
  return stepOf(driver, { player, reduceMotion: reduce }, 'swap');
}

/** One step: an event for the reducer, the clip boundary, or a change of Reduce Motion. */
export function stepMascot(driver: MascotDriver, input: DriverInput): DriverStep {
  if (input.type === 'boundary') return onBoundary(driver);
  if (input.type === 'motion') return onMotion(driver, input.reduce);
  return onEvent(driver, input);
}

/**
 * How long until a {type: 'boundary'} under Reduce Motion: a one-shot shown as a still ends after
 * CLIP_MS (as on the web, where no clip plays); null when no timer runs (with motion the clip's
 * own end is the boundary).
 */
export function stillBoundaryMs(driver: MascotDriver): number | null {
  const { player } = driver;
  return driver.reduceMotion && ONE_SHOTS.has(player.showing) && !player.finished ? CLIP_MS : null;
}
