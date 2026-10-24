// The driver (behaviour reference: the web's hooks/use-mascot-player.ts @ 630fc1c85): the
// reducer and the player in one step, the boundary's swap / restart / finish, urgent swaps, and
// Reduce Motion (every target jumps, a one-shot still ends on the CLIP_MS timer).

import { describe, expect, it } from 'vitest';

import { CLIP_MS } from '../../../core/web/lib/mascot/player';
import { INITIAL_MASCOT } from '../../../core/web/lib/mascot/reducer';
import { RANK, type MascotEvent } from '../../../core/web/lib/mascot/types';
import {
  startDriver,
  stepMascot,
  stillBoundaryMs,
  type DriverInput,
  type DriverStep,
  type MascotDriver,
} from '../driver';

const SEND: MascotEvent = { type: 'send' };
const BOUNDARY: DriverInput = { type: 'boundary' };
const toolStart = (id: string, toolName: string): MascotEvent => ({
  type: 'tool-start',
  toolCallId: id,
  toolName,
  input: {},
});

function steps(driver: MascotDriver, inputs: readonly DriverInput[]): DriverStep {
  return inputs.reduce<DriverStep>((at, input) => stepMascot(at, input), {
    ...driver,
    action: 'none',
  });
}

describe('with motion', () => {
  const start = startDriver(false);

  it('starts idle, showing idle', () => {
    expect(start.mascot).toBe(INITIAL_MASCOT);
    expect(start.player).toEqual({ showing: 'idle', queued: null, finished: false });
    expect(stillBoundaryMs(start)).toBeNull();
  });

  it('a calm change waits for the boundary, then swaps', () => {
    const sent = stepMascot(start, SEND);
    expect(sent.mascot.mascot).toBe('thinking');
    expect(sent.player).toEqual({ showing: 'idle', queued: 'thinking', finished: false });
    expect(sent.action).toBe('none');
    const swapped = stepMascot(sent, BOUNDARY);
    expect(swapped.player.showing).toBe('thinking');
    expect(swapped.action).toBe('swap');
  });

  it('a loop restarts at its boundary', () => {
    const step = stepMascot(start, BOUNDARY);
    expect(step.action).toBe('restart');
    expect(step.player).toBe(start.player);
  });

  it('urgent states swap at once', () => {
    const oops = stepMascot(start, { type: 'request-failed' });
    expect(oops.mascot.mascot).toBe('oops');
    expect(oops.player.showing).toBe('oops');
    expect(oops.action).toBe('swap');
    const hello = stepMascot(start, { type: 'app-open' });
    expect(hello.player.showing).toBe('hello');
    expect(hello.action).toBe('swap');
  });

  it('a one-shot finishing: clip-ended reaches the reducer and the player swaps to what follows', () => {
    const hello = stepMascot(start, { type: 'app-open' });
    const ended = stepMascot(hello, BOUNDARY);
    expect(ended.mascot.mascot).toBe('idle');
    expect(ended.player).toEqual({ showing: 'idle', queued: null, finished: false });
    expect(ended.action).toBe('swap');
  });

  it('a one-shot plays out before the queued pose shows', () => {
    const hello = stepMascot(start, { type: 'app-open' });
    const busy = steps(hello, [SEND, toolStart('c1', 'platform_web_search')]);
    expect(busy.player.showing).toBe('hello');
    expect(busy.mascot.queued).toEqual({ mascot: 'searching', rank: RANK.tool });
    const after = stepMascot(busy, BOUNDARY);
    expect(after.mascot.mascot).toBe('searching');
    expect(after.player.showing).toBe('searching');
    expect(after.action).toBe('swap');
  });

  it('an urgent oops cuts a playing one-shot short', () => {
    const hello = stepMascot(start, { type: 'app-open' });
    const oops = stepMascot(hello, { type: 'request-failed' });
    expect(oops.player.showing).toBe('oops');
    expect(oops.action).toBe('swap');
  });

  it('going back to the clip on screen cancels the queue, so a short tool call never shows', () => {
    const tool = steps(start, [SEND, toolStart('c1', 'platform_read_document')]);
    expect(tool.player).toMatchObject({ showing: 'idle', queued: 'reading' });
    const settled = stepMascot(tool, {
      type: 'tool-end',
      toolCallId: 'c1',
      toolName: 'platform_read_document',
      success: true,
      error: null,
      durationMs: 200,
      summary: null,
      skipped: false,
      waiting: false,
    });
    expect(settled.mascot.mascot).toBe('idle');
    expect(settled.player).toEqual({ showing: 'idle', queued: null, finished: false });
    expect(settled.action).toBe('none');
  });

  it('an event that changes nothing returns the same values', () => {
    const step = stepMascot(start, { type: 'unknown', eventType: 'x' });
    expect(step.mascot).toBe(start.mascot);
    expect(step.player).toBe(start.player);
    expect(step.action).toBe('none');
  });
});

describe('under Reduce Motion', () => {
  const start = startDriver(true);

  it('every target jumps', () => {
    const sent = stepMascot(start, SEND);
    expect(sent.player).toEqual({ showing: 'thinking', queued: null, finished: false });
    expect(sent.action).toBe('swap');
    const tool = stepMascot(sent, toolStart('c1', 'platform_web_search'));
    expect(tool.player.showing).toBe('searching');
    expect(tool.action).toBe('swap');
  });

  it('a one-shot still ends on the CLIP_MS timer', () => {
    const hello = stepMascot(start, { type: 'app-open' });
    expect(hello.player.showing).toBe('hello');
    expect(stillBoundaryMs(hello)).toBe(CLIP_MS);
    const ended = stepMascot(hello, BOUNDARY);
    expect(ended.mascot.mascot).toBe('idle');
    expect(ended.player.showing).toBe('idle');
    expect(ended.action).toBe('swap');
    expect(stillBoundaryMs(ended)).toBeNull();
  });

  it('a loop has no boundary', () => {
    const sent = stepMascot(start, SEND);
    expect(stillBoundaryMs(sent)).toBeNull();
    const step = stepMascot(sent, BOUNDARY);
    expect(step.action).toBe('none');
    expect(step.player).toBe(sent.player);
  });
});

describe('Reduce Motion changing', () => {
  it('turning on shows the target at once, the queue dropped', () => {
    const queued = stepMascot(startDriver(false), SEND);
    const still = stepMascot(queued, { type: 'motion', reduce: true });
    expect(still.reduceMotion).toBe(true);
    expect(still.player).toEqual({ showing: 'thinking', queued: null, finished: false });
    expect(still.action).toBe('swap');
  });

  it('turning off plays the target’s clip', () => {
    const still = stepMascot(startDriver(true), SEND);
    const moving = stepMascot(still, { type: 'motion', reduce: false });
    expect(moving.reduceMotion).toBe(false);
    expect(moving.player.showing).toBe('thinking');
    expect(moving.action).toBe('swap');
  });

  it('the same setting again changes nothing', () => {
    const start = startDriver(false);
    expect(stepMascot(start, { type: 'motion', reduce: false })).toMatchObject({
      ...start,
      action: 'none',
    });
  });
});
