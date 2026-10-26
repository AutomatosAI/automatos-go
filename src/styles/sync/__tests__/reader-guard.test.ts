// StyleSync's single-instance guard (US-016j): the shell's StyleSync and the ones A5's screens
// still mount never read side by side. The first mounted reads, the rest wait; when it goes the
// next takes over, and the holder changing is the only thing that tells the subscribers.

import { describe, expect, it, vi } from 'vitest';

import { STYLE_SYNC_READER, createReaderGuard } from '../reader-guard';

function instances(count: number): symbol[] {
  return Array.from({ length: count }, (_, index) => Symbol(`StyleSync-${index}`));
}

function holders(guard: ReturnType<typeof createReaderGuard>, ids: readonly symbol[]): number {
  return ids.filter((id) => guard.holds(id)).length;
}

describe('the StyleSync reader guard', () => {
  it('lets the first instance read and no other', () => {
    const guard = createReaderGuard();
    const [shell, picker, lookPage] = instances(3);
    guard.join(shell);
    guard.join(picker);
    guard.join(lookPage);
    expect(guard.holds(shell)).toBe(true);
    expect(guard.holds(picker)).toBe(false);
    expect(guard.holds(lookPage)).toBe(false);
  });

  it('has no reader before anything mounts', () => {
    const guard = createReaderGuard();
    const [shell] = instances(1);
    expect(guard.holds(shell)).toBe(false);
  });

  it('keeps the shell reading while a screen opens and closes', () => {
    const guard = createReaderGuard();
    const [shell, picker] = instances(2);
    guard.join(shell);
    const leavePicker = guard.join(picker);
    leavePicker();
    expect(guard.holds(shell)).toBe(true);
    expect(guard.holds(picker)).toBe(false);
  });

  it('hands the reader to the next instance when the holder goes', () => {
    const guard = createReaderGuard();
    const [shell, picker, lookPage] = instances(3);
    const leaveShell = guard.join(shell);
    guard.join(picker);
    guard.join(lookPage);
    leaveShell();
    expect(guard.holds(picker)).toBe(true);
    expect(holders(guard, [shell, picker, lookPage])).toBe(1);
  });

  it('never has two readers, whatever the order of mounts and unmounts', () => {
    const guard = createReaderGuard();
    const ids = instances(4);
    const leaves = ids.map((id) => guard.join(id));
    expect(holders(guard, ids)).toBe(1);
    [2, 0, 3].forEach((index) => {
      leaves[index]?.();
      expect(holders(guard, ids)).toBe(1);
    });
    leaves[1]?.();
    expect(holders(guard, ids)).toBe(0);
  });

  it('counts a second join of the same instance once (a remount in place)', () => {
    const guard = createReaderGuard();
    const [shell, picker] = instances(2);
    const leaveShell = guard.join(shell);
    guard.join(shell);
    guard.join(picker);
    leaveShell();
    expect(guard.holds(shell)).toBe(false);
    expect(guard.holds(picker)).toBe(true);
  });

  it('takes a leave called twice as one', () => {
    const guard = createReaderGuard();
    const [shell, picker] = instances(2);
    const leaveShell = guard.join(shell);
    guard.join(picker);
    leaveShell();
    leaveShell();
    expect(guard.holds(picker)).toBe(true);
  });

  it('tells its subscribers only when the holder changes', () => {
    const guard = createReaderGuard();
    const listener = vi.fn();
    const unsubscribe = guard.subscribe(listener);
    const [shell, picker] = instances(2);
    const leaveShell = guard.join(shell);
    expect(listener).toHaveBeenCalledTimes(1);
    guard.join(picker)();
    expect(listener).toHaveBeenCalledTimes(1);
    const leavePicker = guard.join(picker);
    leaveShell();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    leavePicker();
    expect(guard.holds(picker)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('is one guard for the whole process', async () => {
    const again = await import('../reader-guard');
    expect(again.STYLE_SYNC_READER).toBe(STYLE_SYNC_READER);
    expect(Object.isFrozen(STYLE_SYNC_READER)).toBe(true);
  });
});
