// Candy's avatar (avatar-model.ts; P1 and P4): the face inside the 3 pt ring and gap, the initial
// at 0.4 of it (the frames' 22 on 66, 16 on 40, 15 on 38), the ring's sweep from 12 o'clock, and
// the active and resting paints; Avatar.tsx draws the initial from initialOf and caps the scale
// only with a reason (D38).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { AVATAR, AVATAR_RING, avatarMetrics, avatarPaint } from '../avatar-model';

const AVATAR_SOURCE = readFileSync(path.resolve(__dirname, '../Avatar.tsx'), 'utf8');

describe('avatarMetrics', () => {
  it("gives Team's ringed 66 a 54 pt face and a 22 pt initial", () => {
    expect(avatarMetrics(66, true)).toEqual({ face: 54, ring: 3, gap: 3, initial: 22 });
  });

  it("gives the list's 40 and the needs rows' 38 their face whole: 16 and 15", () => {
    expect(avatarMetrics(40, false)).toEqual({ face: 40, ring: 0, gap: 0, initial: 16 });
    expect(avatarMetrics(38, false).initial).toBe(15);
  });

  it("never sets an initial under Candy's 12, nor a face under nothing", () => {
    expect(avatarMetrics(20, false).initial).toBe(12);
    expect(avatarMetrics(8, true).face).toBe(0);
    expect(AVATAR).toEqual({ ring: 3, gap: 3, initialShare: 0.4 });
  });
});

describe('avatarPaint', () => {
  it("paints an active face in its card gradient, the initial in the card's ink, a sweep ring", () => {
    expect(avatarPaint('active')).toEqual({
      gradient: true,
      face: 'chip',
      ink: 'cardInk',
      sweep: ['g1a', 'g2a', 'g3a', 'g1a'],
      ringFill: 'line',
    });
  });

  it('paints a resting one in the chip fill, quiet, with a grey line ring', () => {
    expect(avatarPaint('resting')).toEqual({
      gradient: false,
      face: 'chip',
      ink: 'quiet',
      sweep: null,
      ringFill: 'line',
    });
  });

  it("runs the ring's sweep pink → violet → blue and back, from 12 o'clock", () => {
    expect(AVATAR_RING.stops).toEqual(['g1a', 'g2a', 'g3a', 'g1a']);
    expect(AVATAR_RING.positions).toEqual([0, 1 / 3, 2 / 3, 1]);
    expect(AVATAR_RING.rotate).toBeCloseTo(-Math.PI / 2);
  });
});

describe('Avatar.tsx', () => {
  it('shows initialOf the name, hidden from VoiceOver (the name beside it is the words)', () => {
    expect(AVATAR_SOURCE).toMatch(/\{initialOf\(name\)\}/);
    expect(AVATAR_SOURCE).toMatch(/accessibilityElementsHidden/);
  });

  it('caps the initial at 2× with a one-line reason directly above (D38)', () => {
    expect(AVATAR_SOURCE).toMatch(/\/\/ D38: [^\n]+\n\s+maxFontSizeMultiplier: 2,/);
  });

  it('draws the ring as a Skia sweep and the face with the card gradient', () => {
    expect(AVATAR_SOURCE).toMatch(/<SweepGradient/);
    expect(AVATAR_SOURCE).toMatch(/cardGradient\(look, set, faceSize\)/);
  });
});
