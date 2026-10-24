// The voice core's rings (US-018b): core() in 'Automatos Command HUD.dc.html' at the phone's 290 —
// each ring's box, band or border, alpha, period and way round, the pulse and the crosshair.

import { describe, expect, it } from 'vitest';

import {
  CORE_SIZE,
  arcGroups,
  bandRadii,
  boxRadius,
  evenDash,
  ringSpecs,
  skiaAngle,
  type RingStroke,
} from '../ring-specs';

const S = CORE_SIZE.phone;
const specs = ringSpecs(S);

function strokeOf(key: string): RingStroke {
  const found = specs.strokes.find((stroke) => stroke.key === key);
  if (!found) throw new Error(`no ${key} ring`);
  return found;
}

describe('the core', () => {
  it('is 290 on the phone and 420 on the desktop, centred', () => {
    expect(CORE_SIZE).toEqual({ phone: 290, desktop: 420 });
    expect(ringSpecs().size).toBe(290);
    expect(specs.centre).toBe(145);
  });

  it('stacks the rings outermost first, as the drawing does', () => {
    expect(specs.strokes.map((stroke) => stroke.key)).toEqual([
      'outer',
      'ticks',
      'arc',
      'segments',
      'dashed',
      'innerArc',
    ]);
    const radii = specs.strokes.map((stroke) => stroke.radius);
    expect([...radii].sort((a, b) => b - a)).toEqual(radii);
  });

  it('measures a box at an inset of the side, and a band along the ray to its corner', () => {
    expect(boxRadius(S, 0)).toBe(145);
    expect(boxRadius(S, 3)).toBeCloseTo(136.3, 6);
    const [inner, outer] = bandRadii(100, [66, 69]);
    expect(inner).toBeCloseTo(100 * Math.SQRT2 * 0.66, 6);
    expect(outer).toBeCloseTo(100 * Math.SQRT2 * 0.69, 6);
    // 71 % of the ray is past the box's circle: border-radius 50 % clips the band there
    expect(bandRadii(100, [68, 71])[1]).toBe(100);
  });
});

describe('each ring', () => {
  it('outer: a 1 pt border at the edge, the accent at 0.22, still', () => {
    expect(strokeOf('outer')).toMatchObject({
      radius: 144.5,
      width: 1,
      arcs: [{ start: 0, sweep: 360, alpha: 0.22 }],
      spin: null,
      glow: 0,
    });
  });

  it('ticks: 1° every 5° at 0.7 in the 66-69 % band at inset 3 %, a turn a minute', () => {
    const ticks = strokeOf('ticks');
    const [inner, outer] = bandRadii(boxRadius(S, 3), [66, 69]);
    expect(ticks.radius).toBeCloseTo((inner + outer) / 2, 6);
    expect(ticks.width).toBeCloseTo(outer - inner, 6);
    expect(ticks.arcs).toHaveLength(72);
    expect(ticks.arcs[0]).toEqual({ start: 0, sweep: 1, alpha: 0.7 });
    expect(ticks.arcs[1]).toEqual({ start: 5, sweep: 1, alpha: 0.7 });
    expect(ticks.arcs[71]).toEqual({ start: 355, sweep: 1, alpha: 0.7 });
    expect(ticks.spin).toEqual({ periodMs: 60_000, direction: 1 });
  });

  it('arc: 2 pt at inset 8 %, the top quarter the accent, the right at 0.35, a 6 pt glow, 7 s', () => {
    expect(strokeOf('arc')).toMatchObject({
      radius: boxRadius(S, 8) - 1,
      width: 2,
      arcs: [
        { start: -45, sweep: 90, alpha: 1 },
        { start: 45, sweep: 90, alpha: 0.35 },
      ],
      glow: 6,
      spin: { periodMs: 7000, direction: 1 },
    });
  });

  it('segments: the 68-71 % band at inset 15 %, 0-64° · 96-210° at 0.5 · 236-300°, 16 s back', () => {
    const segments = strokeOf('segments');
    const [inner, outer] = bandRadii(boxRadius(S, 15), [68, 71]);
    expect(outer).toBe(boxRadius(S, 15));
    expect(segments.radius).toBeCloseTo((inner + outer) / 2, 6);
    expect(segments.width).toBeCloseTo(outer - inner, 6);
    expect(segments.arcs).toEqual([
      { start: 0, sweep: 64, alpha: 1 },
      { start: 96, sweep: 114, alpha: 0.5 },
      { start: 236, sweep: 64, alpha: 1 },
    ]);
    expect(segments.spin).toEqual({ periodMs: 16_000, direction: -1 });
  });

  it('dashed: 1 pt at inset 22 %, the accent at 0.4, even dashes, 30 s', () => {
    const dashed = strokeOf('dashed');
    expect(dashed).toMatchObject({
      radius: boxRadius(S, 22) - 0.5,
      width: 1,
      arcs: [{ start: 0, sweep: 360, alpha: 0.4 }],
      spin: { periodMs: 30_000, direction: 1 },
    });
    expect(dashed.dash).toEqual(evenDash(dashed.radius, 1));
  });

  it('inner arc: 1.5 pt at inset 27 %, the bottom quarter the accent, the left at 0.3, 5 s back', () => {
    expect(strokeOf('innerArc')).toMatchObject({
      radius: boxRadius(S, 27) - 0.75,
      width: 1.5,
      arcs: [
        { start: 135, sweep: 90, alpha: 1 },
        { start: 225, sweep: 90, alpha: 0.3 },
      ],
      glow: 0,
      spin: { periodMs: 5000, direction: -1 },
    });
  });

  it('pulse: a disc at inset 30 %, the accent at 0.28 gone by 70 % of its ray, 2.4 s', () => {
    expect(specs.pulse).toEqual({
      radius: boxRadius(S, 30),
      ray: boxRadius(S, 30) * Math.SQRT2,
      alpha: 0.28,
      fadeEnd: 0.7,
      opacity: [0.55, 1],
      scale: [0.96, 1.04],
      periodMs: 2400,
    });
  });

  it('crosshair: 1 pt lines through the centre from 4 % to 96 %, 0 → 0.25 → 0', () => {
    expect(specs.crosshair.alphas).toEqual([0, 0.25, 0]);
    expect(specs.crosshair.lines).toEqual([
      { key: 'vertical', x: 145, y: 11.6, width: 1, height: 290 - 2 * 11.6 },
      { key: 'horizontal', x: 11.6, y: 145, width: 290 - 2 * 11.6, height: 1 },
    ]);
  });
});

describe('drawing helpers', () => {
  it('turns CSS angles (from twelve) into Skia angles (from three)', () => {
    expect(skiaAngle(0)).toBe(-90);
    expect(skiaAngle(90)).toBe(0);
    expect(skiaAngle(-45)).toBe(-135);
  });

  it('groups arcs by alpha, one path each, in first-seen order', () => {
    const groups = arcGroups(strokeOf('segments').arcs);
    expect(groups.map((group) => group.alpha)).toEqual([1, 0.5]);
    expect(groups[0].arcs.map((arc) => arc.start)).toEqual([0, 236]);
    expect(arcGroups(strokeOf('ticks').arcs)).toHaveLength(1);
  });

  it('evens the dashes to a whole number of 3 pt pairs round the circle', () => {
    const dash = evenDash(80.7, 1);
    const pairs = (2 * Math.PI * 80.7) / (dash.on + dash.off);
    expect(pairs).toBeCloseTo(Math.round(pairs), 6);
    expect(dash.on).toBe(dash.off);
    expect(dash.on).toBeCloseTo(3, 0);
  });

  it('scales with the core: the desktop core has the same rings at 420', () => {
    const desktop = ringSpecs(CORE_SIZE.desktop);
    expect(desktop.strokes[0].radius).toBe(209.5);
    expect(desktop.pulse.radius).toBeCloseTo(boxRadius(420, 30), 6);
  });
});
