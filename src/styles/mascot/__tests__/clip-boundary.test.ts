// The tinted clip's boundary on Skia's clock (clip-boundary.ts) agrees with the vendored
// atClipBoundary (player.ts) everywhere: the same answer in milliseconds as in seconds.

import { describe, expect, it } from 'vitest';

import { atClipBoundary, BOUNDARY_MS, CLIP_MS } from '../../../core/web/lib/mascot/player';
import { CLIP_BACKSTOP_MS, nearClipEnd } from '../clip-boundary';

const MS_PER_SECOND = 1000;
const DURATIONS = [0, -1, CLIP_MS, 5040, Number.NaN, Number.POSITIVE_INFINITY];
const OFFSETS = [-20, 0, 1, 40, BOUNDARY_MS - 1, BOUNDARY_MS, BOUNDARY_MS + 1, 250, 5040];

describe('nearClipEnd', () => {
  const cases = DURATIONS.flatMap((duration) =>
    [...OFFSETS.map((offset) => duration - offset), 0, Number.NaN].map(
      (current) => [current, duration] as const,
    ),
  );

  it.each(cases)('%s ms of %s ms answers as the vendored check does', (current, duration) => {
    expect(nearClipEnd(current, duration)).toBe(
      atClipBoundary(current / MS_PER_SECOND, duration / MS_PER_SECOND),
    );
  });

  it('is inside the window just under BOUNDARY_MS from the end and outside it past that', () => {
    expect(nearClipEnd(5040 - BOUNDARY_MS + 1, 5040)).toBe(true);
    expect(nearClipEnd(5040 - BOUNDARY_MS - 1, 5040)).toBe(false);
    expect(nearClipEnd(5100, 5040)).toBe(true);
  });

  it('waits a quarter second past the clip before the backstop', () => {
    expect(CLIP_BACKSTOP_MS).toBe(250);
  });
});
