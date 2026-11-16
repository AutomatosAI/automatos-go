// The segmented control's touch, read from source (vitest runs in node with no React renderer, and
// the control loads React Native): each segment is at least its style's segment.minHeight tall, so
// with the track's inset as its slop (a slop past the track is lost) it takes the 44 pt touch in
// every style.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { STYLE_CONTROLS } from '../../styles/tokens/controls';
import { MIN_TOUCH } from '../paint';
import { segmentSlop } from '../variants';

const control = readFileSync(path.resolve(__dirname, '..', 'SegmentedControl.tsx'), 'utf8');

describe('a segment', () => {
  it('is at least 38 tall, 44 with the track’s 3 pt inset as its slop, in every style', () => {
    for (const { segment } of Object.values(STYLE_CONTROLS)) {
      expect(segment).toEqual({ minHeight: 38, trackInset: 3, paddingY: 5, gap: 2 });
      expect(segment.minHeight + 2 * segment.trackInset).toBe(MIN_TOUCH);
      expect(segmentSlop(segment)).toEqual({ top: 3, bottom: 3 });
    }
  });

  it('sets its style’s least height, and the inset as its slop', () => {
    expect(control).toMatch(/const sizes = style\.controls\.segment;/);
    expect(control).toMatch(/minHeight: sizes\.minHeight,/);
    expect(control).toMatch(/const slop = segmentSlop\(sizes\);/);
    expect(control).toMatch(/hitSlop=\{slop\}/);
    expect(control).toMatch(/padding: sizes\.trackInset,/);
  });
});
