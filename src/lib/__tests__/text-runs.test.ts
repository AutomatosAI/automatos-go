import { describe, expect, it } from 'vitest';

import { runEnd, runStart, trimRuns } from '../text-runs';
import { LINEAR_GROWTH_LIMIT, growth } from './growth';

const isDot = (char: string) => char === '.';

describe('runs of like characters, read once', () => {
  it('finds where a run ends and where one starts', () => {
    expect(runEnd('..a.', 0, isDot)).toBe(2);
    expect(runEnd('..a.', 2, isDot)).toBe(2);
    expect(runEnd('..', 0, isDot)).toBe(2);
    expect(runStart('a...', 4, isDot)).toBe(1);
    expect(runStart('a...', 1, isDot)).toBe(1);
    expect(runStart('...', 3, isDot)).toBe(0);
  });

  it('trims the run at each end, and the whole text when it is one run', () => {
    expect(trimRuns('..a.b..', isDot)).toBe('a.b');
    expect(trimRuns('a', isDot)).toBe('a');
    expect(trimRuns('....', isDot)).toBe('');
    expect(trimRuns('', isDot)).toBe('');
  });

  it('grows with the text, not with its square', () => {
    const hostile = (size: number) => () => trimRuns(`a${'.'.repeat(size)}a`, isDot);
    expect(growth(hostile, 20_000)).toBeLessThan(LINEAR_GROWTH_LIMIT);
  });

  it('tells a pattern that reads a run again from each of its characters from a single pass', () => {
    // the measure itself: the pattern this module replaced grows near the square, so it fails
    const pattern = (size: number) => () => `a${'.'.repeat(size)}a`.replace(/[.-]+$/, '');
    expect(growth(pattern, 1_500)).toBeGreaterThan(LINEAR_GROWTH_LIMIT);
  });
});
