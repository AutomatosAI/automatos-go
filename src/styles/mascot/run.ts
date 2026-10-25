// What use-mascot.ts holds, pure: the driver (driver.ts) and the run of the clip on screen. A run is
// one play of a clip from its start: every 'swap' and 'restart' the driver's step answers is a new
// run, so the stage plays its clip from the start whenever the run changes, and a boundary names
// the run it ended — a late report from an earlier run (timeUpdate and playToEnd both landing, the
// web's P260-FX-15) changes nothing. The stage says whether a clip plays at all ('stills': Android,
// Reduce Motion, HUD's motion off, a still for this state, a clip that failed): with none, the
// driver jumps and a one-shot ends on its CLIP_MS timer (stillBoundaryMs). A pose holds one state
// for a screen that feeds Auto no events (an edge screen, a preview): it starts the driver there.

import type { Frame } from '../../core/ai-sdk-stream';
import { INITIAL_MASCOT } from '../../core/web/lib/mascot/reducer';
import type { MascotEvent, MascotName } from '../../core/web/lib/mascot/types';
import { mascotEventsFromFrame } from './chat-events';
import { startDriver, stepMascot, type DriverInput, type MascotDriver } from './driver';

export type MascotRun = {
  readonly driver: MascotDriver;
  /** One more at each swap and restart: the clip on screen plays from its start. */
  readonly run: number;
};

export type RunInput =
  | { readonly type: 'event'; readonly event: MascotEvent }
  | { readonly type: 'frame'; readonly frame: Frame }
  | { readonly type: 'boundary'; readonly run: number }
  | { readonly type: 'stills'; readonly stills: boolean }
  | { readonly type: 'pose'; readonly state: MascotName };

/** The driver resting in a state with no events behind it: a pose keeps idle's rank. */
function poseDriver(state: MascotName, stills: boolean): MascotDriver {
  return startDriver(stills, { ...INITIAL_MASCOT, mascot: state });
}

/** A run starting in a state (idle for a caller that feeds events). */
export function startRun(state: MascotName = INITIAL_MASCOT.mascot, stills = false): MascotRun {
  return Object.freeze({ driver: poseDriver(state, stills), run: 0 });
}

function sameDriver(a: MascotDriver, b: MascotDriver): boolean {
  return a.mascot === b.mascot && a.player === b.player && a.reduceMotion === b.reduceMotion;
}

/** One driver step; the same object back when nothing changed (no re-render). */
function advance(current: MascotRun, input: DriverInput): MascotRun {
  const { action, mascot, player, reduceMotion } = stepMascot(current.driver, input);
  const driver = { mascot, player, reduceMotion };
  const replays = action === 'swap' || action === 'restart';
  if (!replays && sameDriver(current.driver, driver)) return current;
  return Object.freeze({
    driver: Object.freeze(driver),
    run: replays ? current.run + 1 : current.run,
  });
}

/** A chat frame's events, in order; a tool runs while the reducer holds one open. */
function onFrame(current: MascotRun, frame: Frame): MascotRun {
  const toolRunning = current.driver.mascot.openTools.length > 0;
  return mascotEventsFromFrame(frame, toolRunning).reduce<MascotRun>(advance, current);
}

function onPose(current: MascotRun, state: MascotName): MascotRun {
  const { driver } = current;
  if (driver.mascot.mascot === state && driver.player.showing === state) return current;
  return Object.freeze({ driver: poseDriver(state, driver.reduceMotion), run: current.run + 1 });
}

export function stepRun(current: MascotRun, input: RunInput): MascotRun {
  switch (input.type) {
    case 'event':
      return advance(current, input.event);
    case 'frame':
      return onFrame(current, input.frame);
    case 'boundary':
      return input.run === current.run ? advance(current, { type: 'boundary' }) : current;
    case 'stills':
      return advance(current, { type: 'motion', reduce: input.stills });
    case 'pose':
      return onPose(current, input.state);
  }
}
