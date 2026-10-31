// The orb's model (orb-model.ts; CANDY-LAYOUT §4 P1, the kit's orb.module.css at 3920359d5): the
// arc turns once every 20 s, linearly, and rests where the web draws it; the ball grows with every
// iOS text size up to the room it has, never under its size; the ring's reach past the square is
// the paint's own; and Orb.tsx turns only while Candy moves and says '3 need you' to VoiceOver.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CANDY_DEFAULT_PICKS } from '../../../tokens/candy';
import { orbPaint } from '../../../tokens/candy-paint';
import { CANDY_COPY } from '../../strings';
import { ORB, PAGE_GUTTER, orbReach, orbSide, orbTurnAt, turnedArc } from '../orb-model';

const IOS_MULTIPLIERS = [
  0.823, 0.882, 0.941, 1, 1.118, 1.235, 1.353, 1.786, 2.143, 2.643, 3.143, 3.571,
] as const;
const ORB_SOURCE = readFileSync(path.resolve(__dirname, '../Orb.tsx'), 'utf8');

describe('orbTurnAt', () => {
  it('turns the arc once round every 20 s, linearly', () => {
    expect(ORB.turnMs).toBe(20000);
    expect([0, 5000, 10000, 15000, 20000, 25000].map(orbTurnAt)).toEqual([0, 90, 180, 270, 0, 90]);
  });

  it('reads a time before the clock started, or not a number, as at rest', () => {
    expect(orbTurnAt(-500)).toBe(0);
    expect(orbTurnAt(Number.NaN)).toBe(0);
  });
});

describe('turnedArc', () => {
  it("turns the arc on from where orb.module.css rests it, its rect, sweep and stroke kept", () => {
    const { arc } = orbPaint(CANDY_DEFAULT_PICKS, ORB.size);
    expect(arc.start).toBe(-65);
    const turned = turnedArc(arc, 90);
    expect(turned).toEqual({ ...arc, start: 25 });
    expect(arc.start).toBe(-65);
  });
});

describe('orbSide', () => {
  it("is Today's 200 at the default size and under it", () => {
    expect(ORB.size).toBe(200);
    for (const scale of [0.823, 0.882, 0.941, 1, Number.NaN]) {
      expect(orbSide(200, scale, 350)).toBe(200);
    }
  });

  for (const width of [375, 430]) {
    const room = width - PAGE_GUTTER * 2;
    it(`grows with the text up to the page's width on a ${width} pt phone, never under 200`, () => {
      const sides = IOS_MULTIPLIERS.map((scale) => orbSide(200, scale, room));
      sides.forEach((side) => {
        expect(side).toBeGreaterThanOrEqual(200);
        expect(side).toBeLessThanOrEqual(room);
      });
      sides.slice(1).forEach((side, index) => expect(side).toBeGreaterThanOrEqual(sides[index]!));
      expect(orbSide(200, 1.353, room)).toBe(271);
      expect(sides.at(-1)).toBe(room);
    });
  }

  it('keeps its size in room narrower than it, and grows uncapped without a room', () => {
    expect(orbSide(200, 2, 120)).toBe(200);
    expect(orbSide(200, 2, Number.NaN)).toBe(400);
  });
});

describe('orbReach', () => {
  it("reaches the ring's outer edge past the ball: 104 ‰ of the side and the stroke's half, rounded up", () => {
    expect(orbReach(orbPaint(CANDY_DEFAULT_PICKS, 200), 200)).toBe(21);
    expect(orbReach(orbPaint(CANDY_DEFAULT_PICKS, 250), 250)).toBe(26);
  });
});

describe('Orb.tsx', () => {
  it('turns only while Candy moves and the orb is not still', () => {
    expect(ORB_SOURCE).toMatch(/useCandyMotion\(\)/);
    expect(ORB_SOURCE).toMatch(/useOrbTurn\(moving && !still\)/);
    expect(ORB_SOURCE).toMatch(/moving \? orbTurnAt\(clockMs\(tick\)\) : 0/);
  });

  it('draws with Skia, a sweep for the conic, and names its words for VoiceOver', () => {
    expect(ORB_SOURCE).toMatch(/from '@shopify\/react-native-skia'/);
    expect(ORB_SOURCE).toMatch(/<SweepGradient/);
    expect(ORB_SOURCE).toMatch(/accessibilityLabel=\{CANDY_COPY\.orbLabel\(figure, caption\)\}/);
    expect(CANDY_COPY.orbLabel('3', 'need you')).toBe('3 need you');
  });

  it("sets the figure in candyOrbFigure and the words in the card's ink with the figure's shadow", () => {
    expect(ORB_SOURCE).toMatch(/candyOrbFigure\(\)/);
    expect(ORB_SOURCE).toMatch(/textShadowColor: SHARED_COLOURS\.figureShadow/);
    expect(ORB_SOURCE).toMatch(/color: vars\.cardInk/);
  });
});
