// The segmented control's touch, read from source (vitest runs in node with no React renderer, and
// the control loads React Native): each segment is at least SEGMENT_MIN_HEIGHT tall, so with the
// track's inset as its slop (a slop past the track is lost) it takes the 44 pt touch in every style.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MIN_TOUCH } from '../paint';
import { SEGMENT_MIN_HEIGHT, SEGMENT_TRACK_INSET } from '../variants';

const control = readFileSync(path.resolve(__dirname, '..', 'SegmentedControl.tsx'), 'utf8');

describe('a segment', () => {
  it('is at least 38 tall, 44 with the track’s 3 pt inset as its slop', () => {
    expect(SEGMENT_MIN_HEIGHT).toBe(38);
    expect(SEGMENT_MIN_HEIGHT + 2 * SEGMENT_TRACK_INSET).toBe(MIN_TOUCH);
  });

  it('sets that least height, and the inset as its slop', () => {
    expect(control).toMatch(/minHeight: SEGMENT_MIN_HEIGHT,/);
    expect(control).toMatch(
      /const SEGMENT_SLOP = Object\.freeze\(\{ top: SEGMENT_TRACK_INSET, bottom: SEGMENT_TRACK_INSET \}\);/,
    );
    expect(control).toMatch(/hitSlop=\{SEGMENT_SLOP\}/);
  });
});
