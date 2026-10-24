// Not running's quiet re-check (US-017f) on an injected clock: the first check 5 s after the start,
// the next 5 s after each one settles (a timeout chain: a slow check never stacks a second), a
// check that throws or rejects keeps the chain going, and stop() ends it for good — the pending
// timer is cleared and a check in flight schedules nothing after it.

import { describe, expect, it, vi } from 'vitest';

import { NOT_RUNNING_RECHECK_MS, startRecheck, type RecheckClock } from '../recheck';

vi.mock('../../../lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type Timer = { readonly id: number; readonly run: () => void; readonly ms: number };

function fakeClock() {
  const pending = new Map<number, Timer>();
  const counter = { next: 1 };
  const clock: RecheckClock = {
    setTimeout: (run, ms) => {
      const id = counter.next++;
      pending.set(id, { id, run, ms });
      return id;
    },
    clearTimeout: (handle) => {
      pending.delete(handle as number);
    },
  };
  /** Fires the one pending timer and lets the check's promise settle. */
  const fire = async () => {
    const [timer] = [...pending.values()];
    if (!timer) throw new Error('no timer pending');
    pending.delete(timer.id);
    timer.run();
    await flush();
  };
  return { clock, pending, fire };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('startRecheck', () => {
  it('checks every 5 s, each wait starting once the last check settled', async () => {
    const { clock, pending, fire } = fakeClock();
    const check = vi.fn();
    startRecheck(check, { clock });
    expect(check).not.toHaveBeenCalled();
    expect([...pending.values()].map((timer) => timer.ms)).toEqual([NOT_RUNNING_RECHECK_MS]);
    await fire();
    expect(check).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(1);
    await fire();
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('waits for a slow check before setting the next', async () => {
    const { clock, pending, fire } = fakeClock();
    const gate = { open: () => {} };
    const check = vi.fn(() => new Promise<void>((resolve) => (gate.open = resolve)));
    startRecheck(check, { clock });
    await fire();
    expect(check).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(0);
    gate.open();
    await flush();
    expect(pending.size).toBe(1);
  });

  it('goes on after a check that throws or rejects', async () => {
    const { clock, pending, fire } = fakeClock();
    const check = vi
      .fn<() => void | Promise<unknown>>()
      .mockImplementationOnce(() => {
        throw new Error('offline');
      })
      .mockImplementationOnce(() => Promise.reject(new Error('still offline')));
    startRecheck(check, { clock });
    await fire();
    await fire();
    expect(check).toHaveBeenCalledTimes(2);
    expect(pending.size).toBe(1);
  });

  it('stops for good: the pending timer goes and a check in flight sets no other', async () => {
    const { clock, pending, fire } = fakeClock();
    const first = startRecheck(vi.fn(), { clock });
    first.stop();
    expect(pending.size).toBe(0);

    const gate = { open: () => {} };
    const slow = vi.fn(() => new Promise<void>((resolve) => (gate.open = resolve)));
    const second = startRecheck(slow, { clock });
    await fire();
    second.stop();
    gate.open();
    await flush();
    expect(pending.size).toBe(0);
    second.stop();
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it('takes its own interval', () => {
    const { clock, pending } = fakeClock();
    startRecheck(vi.fn(), { clock, every: 1200 });
    expect([...pending.values()][0].ms).toBe(1200);
  });
});
