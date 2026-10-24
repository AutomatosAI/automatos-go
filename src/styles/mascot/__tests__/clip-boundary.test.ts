// The tinted clip's boundary on Skia's clock (clip-boundary.ts) agrees with the vendored
// atClipBoundary (player.ts) everywhere: the same answer in milliseconds as in seconds. A tinted
// clip that never gets a duration has failed at CLIP_LOAD_DEADLINE_MS (clipLoad).

import { describe, expect, it } from 'vitest';

import { atClipBoundary, BOUNDARY_MS, CLIP_MS } from '../../../core/web/lib/mascot/player';
import { CLIP_BACKSTOP_MS, CLIP_LOAD_DEADLINE_MS, clipLoad, nearClipEnd } from '../clip-boundary';

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

describe('clipLoad', () => {
  it('no duration before the deadline: waiting, for the time left', () => {
    expect(clipLoad(0, 0)).toEqual({ kind: 'waiting', leftMs: CLIP_LOAD_DEADLINE_MS });
    expect(clipLoad(0, 1200)).toEqual({ kind: 'waiting', leftMs: CLIP_LOAD_DEADLINE_MS - 1200 });
    expect(clipLoad(0, CLIP_LOAD_DEADLINE_MS - 1)).toEqual({ kind: 'waiting', leftMs: 1 });
  });

  it('no duration at the deadline or after it: failed', () => {
    expect(clipLoad(0, CLIP_LOAD_DEADLINE_MS)).toEqual({ kind: 'failed' });
    expect(clipLoad(0, CLIP_LOAD_DEADLINE_MS + 5000)).toEqual({ kind: 'failed' });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'a duration of %s is no duration',
    (duration) => {
      expect(clipLoad(duration, 0).kind).toBe('waiting');
      expect(clipLoad(duration, CLIP_LOAD_DEADLINE_MS).kind).toBe('failed');
    },
  );

  it('a duration: loaded, before the deadline or after it', () => {
    expect(clipLoad(CLIP_MS, 0)).toEqual({ kind: 'loaded' });
    expect(clipLoad(5040, CLIP_LOAD_DEADLINE_MS + 1)).toEqual({ kind: 'loaded' });
  });

  it('a clock that went back waits no longer than the deadline', () => {
    expect(clipLoad(0, -60_000)).toEqual({ kind: 'waiting', leftMs: CLIP_LOAD_DEADLINE_MS });
    expect(clipLoad(0, Number.NaN)).toEqual({ kind: 'waiting', leftMs: CLIP_LOAD_DEADLINE_MS });
  });

  it('gives a clip as long as one run of it', () => {
    expect(CLIP_LOAD_DEADLINE_MS).toBe(CLIP_MS);
  });
});
