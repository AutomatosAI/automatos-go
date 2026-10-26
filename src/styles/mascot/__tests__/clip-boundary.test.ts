// The tinted clip's boundary on Skia's clock (clip-boundary.ts) agrees with the vendored
// atClipBoundary (player.ts) everywhere: the same answer in milliseconds as in seconds. A tinted
// clip that never gets a duration has failed at CLIP_LOAD_DEADLINE_MS (clipLoad). An untinted
// clip's timeUpdate or playToEnd ends a run only for the clip the player has loaded, once
// (clipEndRun): the old clip's late end never ends the next run.

import { describe, expect, it } from 'vitest';

import { atClipBoundary, BOUNDARY_MS, CLIP_MS } from '../../../core/frozen/lib/mascot/player';
import {
  CLIP_BACKSTOP_MS,
  CLIP_LOAD_DEADLINE_MS,
  clipEndRun,
  clipLoad,
  nearClipEnd,
  type ClipEvent,
} from '../clip-boundary';
import type { MascotFile } from '../media';

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

describe('clipEndRun', () => {
  const IDLE: MascotFile = 11;
  const CELEBRATE: MascotFile = 12;
  const THEME_IDLE: MascotFile = 'file:///themes/ember/idle.mp4';
  const SECONDS = CLIP_MS / MS_PER_SECOND;
  const AT_END = SECONDS - BOUNDARY_MS / MS_PER_SECOND / 2;

  /** What the player says and what MascotClip holds when it says it; reported is carried along. */
  type Heard = Omit<ClipEvent, 'reported'>;

  /** Feeds events in order as MascotClip does, keeping the last run reported; the runs reported. */
  function feed(events: readonly Heard[]): readonly number[] {
    type Fed = { readonly reported: number | null; readonly ended: readonly number[] };
    const fed = events.reduce<Fed>(
      (was, heard) => {
        const run = clipEndRun({ ...heard, reported: was.reported });
        return run === null ? was : { reported: run, ended: [...was.ended, run] };
      },
      { reported: null, ended: [] },
    );
    return fed.ended;
  }

  const end = (loaded: MascotFile, clip: MascotFile, run: number, seconds = AT_END): Heard => ({
    loaded,
    clip,
    run,
    seconds,
    duration: SECONDS,
  });

  it("the old clip's end after the run moved to another file reports nothing", () => {
    expect(clipEndRun({ ...end(IDLE, CELEBRATE, 1), reported: 0 })).toBeNull();
    expect(clipEndRun({ ...end(IDLE, CELEBRATE, 1, SECONDS), reported: 0 })).toBeNull();
    expect(clipEndRun({ ...end(THEME_IDLE, CELEBRATE, 4, SECONDS + 1), reported: 3 })).toBeNull();
  });

  it("the new clip's own end reports its run once", () => {
    expect(clipEndRun({ ...end(CELEBRATE, CELEBRATE, 1), reported: 0 })).toBe(1);
    expect(clipEndRun({ ...end(CELEBRATE, CELEBRATE, 1, SECONDS), reported: 1 })).toBeNull();
  });

  it('a swap at a boundary: the old late end is dropped, the new clip ends its own run once', () => {
    const heard: readonly Heard[] = [
      end(IDLE, IDLE, 0), // idle's timeUpdate in the window ends run 0: the driver swaps
      end(IDLE, CELEBRATE, 1, SECONDS), // idle's playToEnd, React on run 1 before replaceAsync
      end(IDLE, CELEBRATE, 1), // a late idle timeUpdate
      end(CELEBRATE, CELEBRATE, 1, 1), // replaceAsync resolved: celebrate plays from its start
      end(CELEBRATE, CELEBRATE, 1), // celebrate reaches its end
      end(CELEBRATE, CELEBRATE, 1, SECONDS), // and its playToEnd lands too
    ];
    expect(feed(heard)).toEqual([0, 1]);
  });

  it('a replay of the same file reports each run once', () => {
    const heard: readonly Heard[] = [
      end(IDLE, IDLE, 0),
      end(IDLE, IDLE, 0, SECONDS),
      end(IDLE, IDLE, 1, 0.5),
      end(IDLE, IDLE, 1),
      end(IDLE, IDLE, 1, SECONDS),
      end(THEME_IDLE, THEME_IDLE, 2, 0.5),
      end(THEME_IDLE, THEME_IDLE, 2),
      end(THEME_IDLE, THEME_IDLE, 3),
    ];
    expect(feed(heard)).toEqual([0, 1, 2, 3]);
  });

  it('a reported run is never reported twice, at its end or past it', () => {
    for (const seconds of [AT_END, SECONDS, SECONDS + 1]) {
      expect(clipEndRun({ ...end(IDLE, IDLE, 7, seconds), reported: 7 })).toBeNull();
    }
    expect(feed([end(IDLE, IDLE, 7), end(IDLE, IDLE, 7, SECONDS), end(IDLE, IDLE, 7)])).toEqual([
      7,
    ]);
  });

  it('the loaded clip away from its end, or with no duration yet, reports nothing', () => {
    expect(clipEndRun({ ...end(IDLE, IDLE, 0, 1), reported: null })).toBeNull();
    for (const duration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(clipEndRun({ ...end(IDLE, IDLE, 0), duration, reported: null })).toBeNull();
    }
  });

  it('the first run reports with nothing reported before it', () => {
    expect(clipEndRun({ ...end(IDLE, IDLE, 0), reported: null })).toBe(0);
  });
});
