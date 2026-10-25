// Auto's stage against Mascot.dc.html's numbers (w = round(0.9s), ringW = round(0.8s), ringH =
// round(0.18s), bodyW = round(0.62s), bodyH = round(0.74s), bodyB = round(0.13s); the ring at the
// bottom, centred, a 2 pt border, shadows of 22 and 14) at every size the app draws him, and Ember's
// ring pulse (auto-mascot.module.css @ 630fc1c85: scale 1.06, opacity .8, 2.4 s ease-in-out).

import { describe, expect, it } from 'vitest';

import {
  MASCOT_SIZES,
  RING_INNER_BLUR,
  RING_OUTER_BLUR,
  RING_PULSE,
  RING_STROKE,
  blurSigma,
  mascotGeometry,
  type MascotGeometry,
} from '../geometry';

/** Mascot.dc.html renderVals() for size s. */
function drawn(s: number) {
  return {
    w: Math.round(s * 0.9),
    h: s,
    ringW: Math.round(s * 0.8),
    ringH: Math.round(s * 0.18),
    bodyW: Math.round(s * 0.62),
    bodyH: Math.round(s * 0.74),
    bodyB: Math.round(s * 0.13),
  };
}

const SIZES = Object.values(MASCOT_SIZES);

/** The ring's ellipse in the stage's coordinates. */
function ringInStage(g: MascotGeometry) {
  const { canvas, oval } = g.ring;
  return {
    left: canvas.x + oval.x,
    top: canvas.y + oval.y,
    width: oval.width,
    height: oval.height,
  };
}

describe('the sizes the app draws Auto at', () => {
  it('are the six screens the kit names', () => {
    expect(MASCOT_SIZES).toEqual({
      autoRow: 84,
      hudCore: 104,
      lost: 140,
      notRunning: 150,
      firstOpen: 170,
      lookPreview: 220,
    });
    expect(Object.isFrozen(MASCOT_SIZES)).toBe(true);
  });
});

describe.each(SIZES)("Auto's stage at %i pt", (size) => {
  const g = mascotGeometry(size);
  const dc = drawn(size);

  it('is 0.9s x s', () => {
    expect(g.size).toBe(size);
    expect(g.stage).toEqual({ width: dc.w, height: dc.h });
  });

  it('draws the ring 0.8s x 0.18s, centred, standing on the bottom', () => {
    const ring = ringInStage(g);
    expect(ring.width).toBe(dc.ringW);
    expect(ring.height).toBe(dc.ringH);
    expect(ring.left + ring.width / 2).toBeCloseTo(dc.w / 2, 9);
    expect(ring.top + ring.height).toBeCloseTo(size, 9);
  });

  it('strokes the ring at 2 pt inside its box, and clips the inset glow inside the border', () => {
    const { oval, stroke, inner } = g.ring;
    expect(RING_STROKE).toBe(2);
    expect(stroke).toEqual({
      x: oval.x + 1,
      y: oval.y + 1,
      width: oval.width - 2,
      height: oval.height - 2,
    });
    expect(inner).toEqual({
      x: oval.x + 2,
      y: oval.y + 2,
      width: oval.width - 4,
      height: oval.height - 4,
    });
  });

  it('fills the ellipse with a closest-side radial: radius rx, squeezed to ry on y', () => {
    const { oval, centre, fill } = g.ring;
    expect(centre).toEqual({ x: oval.x + oval.width / 2, y: oval.y + oval.height / 2 });
    expect(fill.r).toBe(dc.ringW / 2);
    expect(fill.r * fill.scaleY).toBeCloseTo(dc.ringH / 2, 9);
  });

  it('blurs the glow as CSS does: sigma is half of 22 outside and of 14 inside', () => {
    expect(g.ring.outerSigma).toBe(11);
    expect(g.ring.innerSigma).toBe(7);
  });

  it('gives the outer glow and the pulse room on every side of the canvas', () => {
    const { canvas, oval } = g.ring;
    const reach = 3 * g.ring.outerSigma;
    const growthX = ((RING_PULSE.scale - 1) * oval.width) / 2;
    const growthY = ((RING_PULSE.scale - 1) * oval.height) / 2;
    expect(oval.x).toBeGreaterThanOrEqual(reach + growthX);
    expect(oval.y).toBeGreaterThanOrEqual(reach + growthY);
    expect(canvas.width - oval.x - oval.width).toBe(oval.x);
    expect(canvas.height - oval.y - oval.height).toBe(oval.y);
  });

  it('stands the figure 0.62s x 0.74s, centred, 0.13s above the bottom', () => {
    expect(g.figure).toEqual({
      x: (dc.w - dc.bodyW) / 2,
      y: size - dc.bodyB - dc.bodyH,
      width: dc.bodyW,
      height: dc.bodyH,
    });
  });

  it("puts the square clip where the figure's 'center bottom / contain' leaves it", () => {
    const side = Math.min(dc.bodyW, dc.bodyH);
    expect(g.media).toEqual({
      x: (dc.w - side) / 2,
      y: size - dc.bodyB - side,
      width: side,
      height: side,
    });
    expect(g.media.y + g.media.height).toBe(g.figure.y + g.figure.height);
  });

  it('freezes what it returns', () => {
    expect(Object.isFrozen(g)).toBe(true);
    expect(Object.isFrozen(g.ring)).toBe(true);
    expect(Object.isFrozen(g.media)).toBe(true);
  });
});

describe('the numbers behind the ring', () => {
  it("is Mascot.dc.html's box-shadow: 0 0 22px and inset 0 0 14px", () => {
    expect(RING_OUTER_BLUR).toBe(22);
    expect(RING_INNER_BLUR).toBe(14);
    expect(blurSigma(22)).toBe(11);
  });

  it("pulses as Ember's ring-pulse: 1 → 1.06, opacity .8 → 1, 2.4 s ease-in-out", () => {
    expect(RING_PULSE).toEqual({
      scale: 1.06,
      opacity: 0.8,
      periodMs: 2400,
      easing: [0.42, 0, 0.58, 1],
    });
  });

  it('84 pt (the Auto row) in whole points', () => {
    const g = mascotGeometry(84);
    expect(g.stage).toEqual({ width: 76, height: 84 });
    expect(ringInStage(g)).toMatchObject({ width: 67, height: 15 });
    expect(g.figure).toMatchObject({ width: 52, height: 62 });
    expect(g.media).toEqual({ x: 12, y: 21, width: 52, height: 52 });
  });

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])('refuses size %s', (size) => {
    expect(() => mascotGeometry(size)).toThrow(/positive/);
  });
});
