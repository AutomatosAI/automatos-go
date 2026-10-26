// Not running's quiet re-check on the gate (US-016j): the server is asked aside, and the gate's
// Retry runs only once it has something to say (an answer, or an error that is no longer Not
// running's), so the gate never shows loading for a check that finds it still asleep. Driven
// through startRecheck on a fake clock, as recheck.test.ts drives the chain.

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../../api/errors';
import { quietRecheck } from '../gate-recheck';
import { NOT_RUNNING_RECHECK_MS, startRecheck, type RecheckClock } from '../recheck';

const BAD_GATEWAY = 502;
const SERVER_ERROR = 500;
const UNAUTHORISED = 401;

/** A probe that answers each call with the next outcome: a value resolves, an Error rejects. */
function probeOf(outcomes: readonly unknown[]) {
  const calls = { count: 0 };
  const probe = () => {
    const outcome = outcomes[calls.count];
    calls.count += 1;
    return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
  };
  return { probe, calls };
}

function retrySpy() {
  const retries = { count: 0 };
  return { retries, onRetry: () => void (retries.count += 1) };
}

describe('quietRecheck', () => {
  it("runs the gate's Retry once the server answers", async () => {
    const { probe } = probeOf([{ schema: 'automatos-discovery/v1' }]);
    const { retries, onRetry } = retrySpy();
    await quietRecheck(probe, onRetry)();
    expect(retries.count).toBe(1);
  });

  it('leaves the gate alone while the server still does not answer', async () => {
    const { probe } = probeOf([new ApiError('network'), new ApiError('network')]);
    const { retries, onRetry } = retrySpy();
    const check = quietRecheck(probe, onRetry);
    await check();
    await check();
    expect(retries.count).toBe(0);
  });

  it('a gateway that cannot reach it is still Not running', async () => {
    const { probe } = probeOf([new ApiError('server', { status: BAD_GATEWAY })]);
    const { retries, onRetry } = retrySpy();
    await quietRecheck(probe, onRetry)();
    expect(retries.count).toBe(0);
  });

  it('an answer that is an error tries the step again, so the gate shows what it says', async () => {
    for (const error of [
      new ApiError('server', { status: SERVER_ERROR }),
      new ApiError('invalid_response'),
      new ApiError('auth', { status: UNAUTHORISED }),
    ]) {
      const { probe } = probeOf([error]);
      const { retries, onRetry } = retrySpy();
      await quietRecheck(probe, onRetry)();
      expect({ kind: error.kind, retries: retries.count }).toEqual({
        kind: error.kind,
        retries: 1,
      });
    }
  });

  it('never rejects, so the 5 s chain never logs a failed check for a server still asleep', async () => {
    const { probe } = probeOf([new ApiError('network')]);
    const { onRetry } = retrySpy();
    await expect(quietRecheck(probe, onRetry)()).resolves.toBeUndefined();
  });

  it('every 5 s on the chain: asleep, asleep, then awake runs Retry once', async () => {
    const timers: (() => void)[] = [];
    const clock: RecheckClock = {
      setTimeout: (run, ms) => {
        expect(ms).toBe(NOT_RUNNING_RECHECK_MS);
        timers.push(run);
        return timers.length;
      },
      clearTimeout: () => undefined,
    };
    const { probe, calls } = probeOf([new ApiError('network'), new ApiError('network'), {}]);
    const { retries, onRetry } = retrySpy();
    const chain = startRecheck(quietRecheck(probe, onRetry), { clock });
    for (let tick = 0; tick < 3; tick += 1) {
      timers[tick]?.();
      await new Promise((settle) => setImmediate(settle));
    }
    chain.stop();
    expect(calls.count).toBe(3);
    expect(retries.count).toBe(1);
  });
});
