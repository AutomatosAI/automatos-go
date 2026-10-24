// What use-mascot.ts holds (run.ts): the driver and the run of the clip on screen. A swap or a
// restart is a new run; a boundary counts only for the run it names; the stage's stills put the
// driver in Reduce Motion's mode; a chat frame becomes the reducer's events; a pose holds one state.

import { describe, expect, it } from 'vitest';

import { parseLine } from '../../../core/ai-sdk-stream';
import { INITIAL_MASCOT } from '../../../core/web/lib/mascot/reducer';
import type { MascotEvent } from '../../../core/web/lib/mascot/types';
import { startRun, stepRun, type MascotRun, type RunInput } from '../run';

const event = (e: MascotEvent): RunInput => ({ type: 'event', event: e });
const boundary = (run: number): RunInput => ({ type: 'boundary', run });
const frame = (payload: unknown): RunInput => ({
  type: 'frame',
  frame: parseLine(`d:${JSON.stringify(payload)}`),
});
const SEARCH_START = frame({
  type: 'tool-start',
  data: { toolCallId: 'c1', toolName: 'platform_web_search', input: { q: 'x' } },
});

const steps = (from: MascotRun, inputs: readonly RunInput[]) => inputs.reduce(stepRun, from);
const showing = (run: MascotRun) => run.driver.player.showing;

describe('startRun', () => {
  it('starts idle on run 0 with clips playing, frozen', () => {
    const run = startRun();
    expect(run.run).toBe(0);
    expect(run.driver.mascot).toEqual(INITIAL_MASCOT);
    expect(showing(run)).toBe('idle');
    expect(run.driver.reduceMotion).toBe(false);
    expect(Object.isFrozen(run)).toBe(true);
  });

  it('starts a pose in its state, with stills when asked', () => {
    const run = startRun('lost', true);
    expect(run.driver.mascot.mascot).toBe('lost');
    expect(showing(run)).toBe('lost');
    expect(run.driver.reduceMotion).toBe(true);
  });
});

describe('runs', () => {
  it('an urgent state swaps at once: a new run', () => {
    const run = stepRun(startRun(), event({ type: 'app-open' }));
    expect(showing(run)).toBe('hello');
    expect(run.run).toBe(1);
  });

  it('a calm change waits for the boundary on the same run, then swaps on a new one', () => {
    const queued = stepRun(startRun(), event({ type: 'send' }));
    expect(queued.driver.mascot.mascot).toBe('thinking');
    expect(showing(queued)).toBe('idle');
    expect(queued.run).toBe(0);
    const swapped = stepRun(queued, boundary(0));
    expect(showing(swapped)).toBe('thinking');
    expect(swapped.run).toBe(1);
  });

  it('a loop with nothing queued restarts: the same clip on a new run', () => {
    const run = stepRun(startRun(), boundary(0));
    expect(showing(run)).toBe('idle');
    expect(run.run).toBe(1);
  });

  it("a boundary from an earlier run changes nothing (timeUpdate and playToEnd both landing)", () => {
    const once = stepRun(startRun(), boundary(0));
    expect(stepRun(once, boundary(0))).toBe(once);
  });

  it('a one-shot that ends goes back to idle on a new run', () => {
    const hello = stepRun(startRun(), event({ type: 'app-open' }));
    const after = stepRun(hello, boundary(hello.run));
    expect(after.driver.mascot.mascot).toBe('idle');
    expect(showing(after)).toBe('idle');
    expect(after.run).toBe(hello.run + 1);
  });

  it('an event the reducer ignores returns the same object', () => {
    const run = startRun();
    expect(stepRun(run, event({ type: 'input-blur' }))).toBe(run);
  });
});

describe('stills', () => {
  it('no clip plays: targets jump at once', () => {
    const still = stepRun(startRun(), { type: 'stills', stills: true });
    expect(still.driver.reduceMotion).toBe(true);
    const thinking = stepRun(still, event({ type: 'send' }));
    expect(showing(thinking)).toBe('thinking');
    expect(thinking.run).toBe(still.run + 1);
  });

  it('the same answer twice is the same object', () => {
    const run = startRun();
    expect(stepRun(run, { type: 'stills', stills: false })).toBe(run);
  });

  it('clips back on: the target plays its clip again', () => {
    const run = steps(startRun(), [
      { type: 'stills', stills: true },
      { type: 'stills', stills: false },
    ]);
    expect(run.driver.reduceMotion).toBe(false);
    expect(showing(run)).toBe('idle');
  });
});

describe('chat frames', () => {
  it("a tool's start is the reducer's event", () => {
    const run = steps(startRun(), [event({ type: 'send' }), SEARCH_START]);
    expect(run.driver.mascot.mascot).toBe('searching');
    expect(run.driver.mascot.openTools).toHaveLength(1);
  });

  it('words while a tool is open are nothing (toolRunning from the open tools)', () => {
    const searching = steps(startRun(), [event({ type: 'send' }), SEARCH_START]);
    const words: RunInput = { type: 'frame', frame: parseLine('0:"Hello"') };
    expect(stepRun(searching, words)).toBe(searching);
  });
});

describe('poses', () => {
  it('the same state is the same object', () => {
    const run = startRun('sleeping');
    expect(stepRun(run, { type: 'pose', state: 'sleeping' })).toBe(run);
  });

  it('a new state shows at once on a new run, keeping the stills', () => {
    const run = stepRun(startRun('sleeping', true), { type: 'pose', state: 'lost' });
    expect(run.driver.mascot.mascot).toBe('lost');
    expect(showing(run)).toBe('lost');
    expect(run.driver.reduceMotion).toBe(true);
    expect(run.run).toBe(1);
  });
});
