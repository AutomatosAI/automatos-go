// Candy's corners, glow and gradients (CANDY-LAYOUT §3, the kit's spec.ts, prepaint.ts and
// orb.module.css at 3920359d5): the Roundness and Glow rules (every Roundness key's corners as
// boot/prepaint.json paints them), the shadow, and every branch of the card, band, orb and aura
// models for Soft, Rich and Vivid, Mixed and One colour, in each palette's order, against the
// values prepaint.json paints for the band and the card's layers.

import { describe, expect, it } from 'vitest';

import {
  CANDY_DEFAULT_PICKS,
  candyGlowAlpha,
  candyRadii,
  candyShadow,
  innerRadius,
  nearestRadius,
  type CandyPaintPicks,
} from '../candy';
import { CARD_SETS, LAYER_COLOURS, PALETTES, SHARED_COLOURS } from '../candy-catalogue';
import {
  AURA_BLUR,
  ORB_SWEEP_ROTATE,
  auraCircles,
  bandGradient,
  cardGradient,
  orbPaint,
  type LinearPaint,
} from '../candy-paint';
import { PREPAINT_BANDS, PREPAINT_LAYERS, PREPAINT_ROUNDNESS } from './candy-prepaint';

const look = (over: Partial<CandyPaintPicks>): CandyPaintPicks => ({
  ...CANDY_DEFAULT_PICKS,
  ...over,
});
const CARD = { w: 200, h: 100 };

/** The unit direction a CSS angle runs in (x right, y down). */
const cssDirection = (degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return [Math.sin(radians), -Math.cos(radians)];
};

function directionOf(paint: LinearPaint): number[] {
  const dx = paint.end.x - paint.start.x;
  const dy = paint.end.y - paint.start.y;
  const length = Math.hypot(dx, dy);
  return [dx / length, dy / length];
}

/** A prepaint.json length or share ('28px', '52%') as a number of points or a fraction. */
const pxOf = (value: string) => Number(value.replace('px', ''));
const shareOf = (value: string) => Number(value.replace('%', '')) / 100;

describe('Roundness and Glow', () => {
  it('reads the Roundness key as the number it names, clamped to 16-40, 28 when it names none', () => {
    expect(nearestRadius('16')).toBe(16);
    expect(nearestRadius('40')).toBe(40);
    expect(nearestRadius('28')).toBe(28);
    expect(nearestRadius('12')).toBe(16);
    expect(nearestRadius('41')).toBe(40);
    expect(nearestRadius('27.6')).toBe(28);
    expect(nearestRadius('')).toBe(28);
    expect(nearestRadius('round')).toBe(28);
  });

  it('clamps a number the same way, 28 when it is not a finite number (spec.ts clampKnob)', () => {
    expect(nearestRadius(16)).toBe(16);
    expect(nearestRadius(40)).toBe(40);
    expect(nearestRadius(10)).toBe(16);
    expect(nearestRadius(52)).toBe(40);
    expect(nearestRadius(27.6)).toBe(28);
    expect(nearestRadius(Number.NaN)).toBe(28);
    expect(nearestRadius(Number.POSITIVE_INFINITY)).toBe(28);
  });

  it("takes r × 0.72 for the phone's cards and windows (spec.ts innerRadius)", () => {
    expect(innerRadius('28')).toBe(20);
    expect(innerRadius(28)).toBe(20);
    expect(innerRadius(16)).toBe(12);
    expect(innerRadius(40)).toBe(29);
    expect(innerRadius(32)).toBe(23);
    expect(innerRadius(Number.NaN)).toBe(20);
  });

  it("paints every Roundness key's corners as prepaint.json does: r and rs", () => {
    const keys = Object.keys(PREPAINT_ROUNDNESS);
    expect(keys).toHaveLength(25);
    for (const key of keys) {
      const [r, rs] = PREPAINT_ROUNDNESS[key];
      expect(nearestRadius(key), key).toBe(pxOf(r));
      expect(innerRadius(key), key).toBe(pxOf(rs));
    }
  });

  it('rounds cards, windows, sheets and the field to rs, and the rest fully', () => {
    expect(candyRadii({ roundness: '32' })).toEqual({
      tag: 999,
      chip: 999,
      segment: 999,
      control: 999,
      input: 23,
      card: 23,
      panel: 23,
      pill: 999,
      sheet: 23,
      full: 999,
    });
    expect(Object.isFrozen(candyRadii({ roundness: '32' }))).toBe(true);
  });

  it("lays the knob's glow over the fixed .04 layer: 0.04 + glow / 33", () => {
    expect(candyGlowAlpha(0)).toBe(0.04);
    expect(candyGlowAlpha(6)).toBeCloseTo(0.04 + 6 / 33, 12);
    expect(candyGlowAlpha(10)).toBeCloseTo(0.04 + 10 / 33, 12);
    expect(candyGlowAlpha(14)).toBe(candyGlowAlpha(10));
    expect(candyGlowAlpha(Number.NaN)).toBe(candyGlowAlpha(6));
  });

  it("tints the shadow with the palette's tint at the glow (CANDY-LAYOUT §3)", () => {
    expect(candyShadow(CANDY_DEFAULT_PICKS)).toEqual({
      shadowColor: '#D62F7A',
      shadowOpacity: 0.04 + 6 / 33,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 14 },
      elevation: 8,
    });
    expect(candyShadow(look({ palette: 'lilac', glow: 0 }))).toMatchObject({
      shadowColor: '#5B35D5',
      shadowOpacity: 0.04,
    });
    expect(candyShadow(look({ palette: 'nightbloom' })).shadowColor).toBe('#FF50AA');
  });
});

describe('cardGradient', () => {
  it('runs Soft from a to b at 155°, under the highlight at 88% 8%', () => {
    const paint = cardGradient(look({ gradient: 'soft' }), 1, CARD);
    expect(paint.linear).toEqual({
      kind: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 84, y: 100 },
      colours: ['#D73178', '#B01E5F'],
      positions: [0, 1],
    });
    expect(paint.glows).toEqual([]);
    expect(paint.highlight).toEqual({
      kind: 'radial',
      c: { x: 176, y: 8 },
      r: 92,
      colours: [LAYER_COLOURS.highlight, 'rgba(255,255,255,0)'],
      positions: [0, 1],
    });
  });

  it('runs Rich through c with b at 55 %, under the same highlight', () => {
    const paint = cardGradient(look({ gradient: 'rich' }), 2, CARD);
    expect(paint.linear.colours).toEqual(['#8E4AE8', '#5B2BCB', '#3557D8']);
    expect(paint.linear.positions).toEqual([0, 0.55, 1]);
    expect(paint.glows).toEqual([]);
    expect(paint.highlight.c).toEqual({ x: 176, y: 8 });
  });

  it("lays Vivid's brighter highlight at 92% 0% and its pink and cyan glows at the lower corners", () => {
    const paint = cardGradient(look({ gradient: 'vivid' }), 3, { w: 100, h: 160 });
    expect(paint.linear.colours).toEqual(['#2675D3', '#0F5DAE', '#0B8FB0']);
    expect(paint.linear.positions).toEqual([0, 0.55, 1]);
    expect(paint.highlight).toEqual({
      kind: 'radial',
      c: { x: 92, y: 0 },
      r: 80,
      colours: [LAYER_COLOURS.highlightVivid, 'rgba(255,255,255,0)'],
      positions: [0, 1],
    });
    expect(paint.glows).toEqual([
      {
        kind: 'radial',
        c: { x: 0, y: 160 },
        r: 88,
        colours: [LAYER_COLOURS.glowPink, 'rgba(255,170,210,0)'],
        positions: [0, 1],
      },
      {
        kind: 'radial',
        c: { x: 100, y: 160 },
        r: 80,
        colours: [LAYER_COLOURS.glowCyan, 'rgba(90,230,255,0)'],
        positions: [0, 1],
      },
    ]);
  });

  it.each(PALETTES)(
    "takes the sets in $id's order with Mixed cards, the first with One colour",
    (palette) => {
      const mix = look({ palette: palette.id, cards: 'mix' });
      const single = look({ palette: palette.id, cards: 'single' });
      ([1, 2, 3] as const).forEach((set) => {
        const own = CARD_SETS[palette.order[set - 1]];
        expect(cardGradient(mix, set, CARD).linear.colours).toEqual([own.a, own.b, own.c]);
        const first = CARD_SETS[palette.order[0]];
        expect(cardGradient(single, set, CARD).linear.colours).toEqual([first.a, first.b, first.c]);
      });
    },
  );
});

describe("the card's layers as prepaint.json paints them", () => {
  it.each(['soft', 'rich', 'vivid'] as const)(
    '%s: the highlight, the glows and the middle stop',
    (gradient) => {
      const layers = PREPAINT_LAYERS[gradient];
      const paint = cardGradient(look({ gradient }), 1, CARD);
      expect(paint.highlight.c).toEqual({
        x: CARD.w * shareOf(layers['--candy-hi-x']),
        y: CARD.h * shareOf(layers['--candy-hi-y']),
      });
      expect(paint.highlight.colours[0]).toBe(layers['--candy-hi-colour']);
      const glows = paint.glows.map((glow) => glow.colours[0]);
      const painted = [layers['--candy-glow-pink'], layers['--candy-glow-cyan']];
      expect(glows).toEqual(painted.filter((colour) => colour !== 'transparent'));
      const mid = shareOf(layers['--candy-card-mid']);
      expect(paint.linear.positions).toEqual(mid === 1 ? [0, 1] : [0, mid, 1]);
    },
  );
});

describe('bandGradient', () => {
  it.each(PALETTES)(
    "paints $id's band stops as prepaint.json does, for each Gradient",
    (palette) => {
      for (const gradient of ['soft', 'rich', 'vivid'] as const) {
        const band = PREPAINT_BANDS[palette.id][gradient];
        const paint = bandGradient(look({ palette: palette.id, gradient }), { w: 390, h: 300 });
        const viaAt = shareOf(band.viaAt);
        // Soft's via sits at the end, so its gradient is from and via alone
        expect(paint.colours, gradient).toEqual(
          viaAt === 1 ? [band.from, band.via] : [band.from, band.via, band.to],
        );
        expect(paint.positions, gradient).toEqual(viaAt === 1 ? [0, 1] : [0, viaAt, 1]);
        const [dx, dy] = directionOf(paint);
        const [ex, ey] = cssDirection(Number(band.angle.replace('deg', '')));
        expect(dx).toBeCloseTo(ex, 12);
        expect(dy).toBeCloseTo(ey, 12);
      }
    },
  );

  it('runs Soft at 160° from bandA to bandB, corner to corner through the centre', () => {
    const paint = bandGradient(look({ gradient: 'soft' }), { w: 390, h: 300 });
    expect(paint.colours).toEqual(['#FFD9E8', '#FFC2DA']);
    expect(paint.positions).toEqual([0, 1]);
    const [dx, dy] = directionOf(paint);
    const [ex, ey] = cssDirection(160);
    expect(dx).toBeCloseTo(ex, 12);
    expect(dy).toBeCloseTo(ey, 12);
    expect((paint.start.x + paint.end.x) / 2).toBeCloseTo(195, 9);
    expect((paint.start.y + paint.end.y) / 2).toBeCloseTo(150, 9);
    const length = Math.hypot(paint.end.x - paint.start.x, paint.end.y - paint.start.y);
    expect(length).toBeCloseTo(390 * Math.abs(ex) + 300 * Math.abs(ey), 9);
  });

  it.each(['rich', 'vivid'] as const)(
    'runs %s at 120° through band1, band2 at 52 % and band3',
    (gradient) => {
      const paint = bandGradient(look({ palette: 'lilac', gradient }), { w: 390, h: 300 });
      expect(paint.colours).toEqual(['#D9CCFF', '#C9DBFF', '#F6D2F0']);
      expect(paint.positions).toEqual([0, 0.52, 1]);
      const [dx, dy] = directionOf(paint);
      const [ex, ey] = cssDirection(120);
      expect(dx).toBeCloseTo(ex, 12);
      expect(dy).toBeCloseTo(ey, 12);
    },
  );
});

describe('orbPaint', () => {
  it('sweeps from 210° through the three starts, the orb pink and back', () => {
    const paint = orbPaint(look({ palette: 'lilac' }), 200);
    expect(paint.sweep).toEqual({
      kind: 'sweep',
      c: { x: 100, y: 100 },
      rotate: ORB_SWEEP_ROTATE,
      colours: ['#8E4AE8', '#2675D3', '#D73178', SHARED_COLOURS.orbPink, '#8E4AE8'],
      positions: [0, 0.25, 0.5, 0.75, 1],
    });
    // CSS's conic starts at 12 o'clock, Skia's sweep at 3: 210° − 90° = 120°
    expect(ORB_SWEEP_ROTATE).toBeCloseTo((120 * Math.PI) / 180, 12);
    expect(orbPaint(look({ palette: 'lilac', cards: 'single' }), 200).sweep.colours).toEqual([
      '#8E4AE8',
      '#8E4AE8',
      '#8E4AE8',
      SHARED_COLOURS.orbPink,
      '#8E4AE8',
    ]);
  });

  it('lays the gloss at 34% 26% and the blush at 62% 78%, each to the farthest corner', () => {
    const paint = orbPaint(CANDY_DEFAULT_PICKS, 200);
    expect(paint.gloss).toMatchObject({
      c: { x: 68, y: 52 },
      colours: [SHARED_COLOURS.white85, SHARED_COLOURS.white12, 'rgba(255,255,255,0)'],
      positions: [0, 0.32, 0.6],
    });
    expect(paint.gloss.r).toBeCloseTo(200 * Math.hypot(0.66, 0.74), 9);
    expect(paint.blush).toMatchObject({
      c: { x: 124, y: 156 },
      colours: [SHARED_COLOURS.orbBlush, 'rgba(255,190,220,0)'],
      positions: [0, 0.45],
    });
    expect(paint.blush.r).toBeCloseTo(200 * Math.hypot(0.62, 0.78), 9);
  });

  it('strokes the 4 pt arc on the right and lower edges turned −20°, and the ring round the ball', () => {
    const paint = orbPaint(CANDY_DEFAULT_PICKS, 250);
    expect(paint.arc).toEqual({
      rect: { x: 12, y: 12, width: 226, height: 226 },
      start: -65,
      sweep: 180,
      strokeWidth: 4,
      colour: SHARED_COLOURS.white92,
    });
    expect(paint.halo).toEqual({
      c: { x: 125, y: 125 },
      r: 125 + 26 - 0.75,
      strokeWidth: 1.5,
      colour: SHARED_COLOURS.white55,
    });
  });
});

describe('auraCircles', () => {
  it.each(['soft', 'rich'] as const)('draws none on %s', (gradient) => {
    expect(auraCircles(look({ gradient }), { w: 390, h: 844 })).toEqual([]);
  });

  it.each(PALETTES)("draws $id's three blobs on Vivid, half the width, blurred 40", (palette) => {
    const circles = auraCircles(look({ palette: palette.id, gradient: 'vivid' }), {
      w: 400,
      h: 800,
    });
    expect(circles).toEqual([
      { c: { x: 352, y: 0 }, r: 200, colour: palette.colours.blobs[0], blur: AURA_BLUR },
      { c: { x: 400, y: 360 }, r: 200, colour: palette.colours.blobs[1], blur: AURA_BLUR },
      { c: { x: 40, y: 800 }, r: 200, colour: palette.colours.blobs[2], blur: AURA_BLUR },
    ]);
    expect(AURA_BLUR).toBe(40);
  });
});
