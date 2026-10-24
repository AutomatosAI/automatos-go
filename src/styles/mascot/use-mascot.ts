// Auto's driver in React (D37): run.ts's state for one Auto on screen. useMascot() is for a caller
// that feeds him (the homes in phase 2: chat frames, the composer's focus, the backend's state); it
// also sends the vendored 'app-open', his hello, each time a flip enters Play (the store's
// playEntries, never on mount). useMascotPose(state) holds one state for a screen that feeds him
// nothing (an edge screen, a preview). Either goes to <Mascot state={…}>, which reports each clip's
// boundary and whether a clip plays; under stills a one-shot ends on stillBoundaryMs's timer here.

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import type { Frame } from '../../core/ai-sdk-stream';
import type { MascotEvent, MascotName } from '../../core/web/lib/mascot/types';
import { useStyleStore } from '../provider/context';
import { stillBoundaryMs, type MascotDriver } from './driver';
import { startRun, stepRun, type RunInput } from './run';

export type MascotController = {
  /** What Auto should show (driver.mascot) and what is on screen (driver.player). */
  readonly driver: MascotDriver;
  /** The run of the clip on screen: a new one plays its clip from the start. */
  readonly run: number;
  readonly send: (event: MascotEvent) => void;
  /** A chat frame (src/core/ai-sdk-stream.ts) as the vendored reducer's events. */
  readonly sendFrame: (frame: Frame) => void;
  /** The stage: run's clip reached its end. */
  readonly boundary: (run: number) => void;
  /** The stage: no clip plays for the state on screen. */
  readonly setStills: (stills: boolean) => void;
};

function useController(start: MascotName): readonly [MascotController, (input: RunInput) => void] {
  const [current, dispatch] = useReducer(stepRun, start, startRun);
  const wait = stillBoundaryMs(current.driver);
  useEffect(() => {
    if (wait === null) return undefined;
    const timer = setTimeout(() => dispatch({ type: 'boundary', run: current.run }), wait);
    return () => clearTimeout(timer);
  }, [wait, current.run]);

  const send = useCallback((event: MascotEvent) => dispatch({ type: 'event', event }), []);
  const sendFrame = useCallback((frame: Frame) => dispatch({ type: 'frame', frame }), []);
  const boundary = useCallback((run: number) => dispatch({ type: 'boundary', run }), []);
  const setStills = useCallback((stills: boolean) => dispatch({ type: 'stills', stills }), []);
  const controller = useMemo<MascotController>(
    () => ({ driver: current.driver, run: current.run, send, sendFrame, boundary, setStills }),
    [current, send, sendFrame, boundary, setStills],
  );
  return [controller, dispatch] as const;
}

/** Auto for a caller that feeds him events; he says hello whenever a flip enters Play. */
export function useMascot(): MascotController {
  const [controller] = useController('idle');
  const entries = useStyleStore((state) => state.playEntries);
  const seen = useRef(entries);
  const { send } = controller;
  useEffect(() => {
    if (entries === seen.current) return;
    seen.current = entries;
    send({ type: 'app-open' });
  }, [entries, send]);
  return controller;
}

/** Auto holding one state; a new state starts him there at once. */
export function useMascotPose(state: MascotName): MascotController {
  const [controller, dispatch] = useController(state);
  useEffect(() => dispatch({ type: 'pose', state }), [dispatch, state]);
  return controller;
}
