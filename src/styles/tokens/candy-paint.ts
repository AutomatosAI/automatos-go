// Candy's gradients as Skia-ready models (PRD-001 §4.6.2, D-CAN-9, CANDY-LAYOUT §3): a card's
// linear gradient with its highlight and Vivid's corner glows, the band behind the top of a view,
// the orb and the aura behind the home on Vivid, each in points for a given size, with every colour
// from the catalogue (D-TOKENS). The parts (US-023f) hand these to Skia's LinearGradient,
// RadialGradient and SweepGradient as they are. Pure: no React, React Native, Expo or Skia.
//
// Sources: AutomatosAI/automatos-design-kit themes/candy at 3920359d5 — src/looks/prepaint.ts
// (GRADIENT_LAYERS: the highlight's place, colour and reach, Vivid's glows, the middle stop; bandOf
// and auraOf: the band's and the aura's stops), src/app/theme.css (how --candy-card-1…3, the band,
// the aura, --candy-user and --candy-orb compose them) and src/art/orb.module.css (the arc and the
// ring). CANDY-LAYOUT §3 turns them into Skia's terms: the card's 155° runs from (0, 0) to
// (0.42w, h), a highlight's radius is 0.46 × the longer side, the orb's conic is a sweep from 210°,
// the aura is three circles of half the width under a blur of 40. A see-through stop fades to its
// own colour at 0, never 'transparent' (Skia blends a gradient unpremultiplied, so that would grey
// the fade).

import { rgba } from '../../core/web/lib/look-kit/css';
import { candyCardOrder, candyPalette, type CandyPaintPicks } from './candy';
import { CARD_SETS, LAYER_COLOURS, SHARED_COLOURS } from './candy-catalogue';

export type PaintSize = { readonly w: number; readonly h: number };
export type Point = { readonly x: number; readonly y: number };

/** A gradient's colours and where each sits, 0 to 1 along it. */
type Stops = { readonly colours: readonly string[]; readonly positions: readonly number[] };

export type LinearPaint = Stops & {
  readonly kind: 'linear';
  readonly start: Point;
  readonly end: Point;
};
export type RadialPaint = Stops & {
  readonly kind: 'radial';
  readonly c: Point;
  readonly r: number;
};
/** A sweep about c, turned by rotate radians (Skia's 0 is 3 o'clock, CSS's conic 0 is 12). */
export type SweepPaint = Stops & {
  readonly kind: 'sweep';
  readonly c: Point;
  readonly rotate: number;
};

/** Which of the look's three card gradients: 1, 2 or 3 in the palette's order (sets.ts CardSet). */
export type CandySetIndex = 1 | 2 | 3;

/** The card's 155° as CANDY-LAYOUT draws it: from the top-left to this share of the width, at the foot. */
const CARD_END_X = 0.42;
/** Rich and Vivid's middle stop (GRADIENT_LAYERS --candy-card-mid 55%); Soft runs a to b. */
const CARD_MID = 0.55;
/** A highlight's or a glow's radius as a share of the card's longer side. */
const SPOTS = Object.freeze({
  highlight: Object.freeze({ x: 0.88, y: 0.08, r: 0.46 }),
  highlightVivid: Object.freeze({ x: 0.92, y: 0, r: 0.5 }),
  glowPink: Object.freeze({ x: 0, y: 1, r: 0.55 }),
  glowCyan: Object.freeze({ x: 1, y: 1, r: 0.5 }),
});

/** The band's angles (bandOf) as the direction each runs, x right and y down: sin θ and −cos θ, written out. */
const DIRECTIONS = Object.freeze({
  120: Object.freeze([0.8660254037844386, 0.5] as const),
  150: Object.freeze([0.5, 0.8660254037844386] as const),
  160: Object.freeze([0.3420201433256687, 0.9396926207859084] as const),
});
/** Rich and Vivid's band: its middle stop at 52 %. */
const BAND_MID = 0.52;

/** The orb's conic: from 210° in CSS (0 at 12 o'clock), 120° in Skia's terms, as radians. */
export const ORB_SWEEP_ROTATE = (2 * Math.PI) / 3;
/** orb.module.css: the arc 4 % in from the ball's edge, 4 pt wide, its right and lower edges turned −20°. */
const ORB_ARC = Object.freeze({ inset: 0.04, width: 4, start: -65, sweep: 180 });
/** orb.module.css: the 1.5 pt ring 26 pt out from a 250 pt ball. */
const ORB_HALO = Object.freeze({ outset: 0.104, width: 1.5 });

/** Vivid's aura (auraOf): the blobs at top-right, right-middle and bottom-left, half the width, blur 40. */
const AURA_SPOTS = Object.freeze([
  Object.freeze({ x: 0.88, y: 0 }),
  Object.freeze({ x: 1, y: 0.45 }),
  Object.freeze({ x: 0.1, y: 1 }),
]);
const AURA_RADIUS = 0.5;
export const AURA_BLUR = 40;

const RGBA = /^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),[\d.]+\)$/;

/** A colour at alpha 0, where a fade of it ends. */
function clear(colour: string): string {
  const match = RGBA.exec(colour);
  return match ? `rgba(${match[1]},${match[2]},${match[3]},0)` : rgba(colour, 0);
}

/** A see-through colour from its own value at the centre to clear at r. */
function fade(colour: string, c: Point, r: number): RadialPaint {
  return Object.freeze({
    kind: 'radial',
    c,
    r,
    colours: [colour, clear(colour)],
    positions: [0, 1],
  });
}

function spotOf(
  spot: { x: number; y: number; r: number },
  size: PaintSize,
  colour: string,
): RadialPaint {
  const longer = Math.max(size.w, size.h);
  return fade(colour, { x: size.w * spot.x, y: size.h * spot.y }, longer * spot.r);
}

// ── Cards ──────────────────────────────────────────────────────────────────────────────────

/** A card's paint, drawn in this order: the linear gradient, Vivid's glows, the highlight. */
export type CardGradient = {
  readonly linear: LinearPaint;
  readonly glows: readonly RadialPaint[];
  readonly highlight: RadialPaint;
};

type CardLook = Pick<CandyPaintPicks, 'palette' | 'cards' | 'gradient'>;

/** The look's card gradient `set` over a card of this size. */
export function cardGradient(look: CardLook, set: CandySetIndex, size: PaintSize): CardGradient {
  const { a, b, c } = CARD_SETS[candyCardOrder(look)[set - 1]];
  const stops: Stops =
    look.gradient === 'soft'
      ? { colours: [a, b], positions: [0, 1] }
      : { colours: [a, b, c], positions: [0, CARD_MID, 1] };
  const linear: LinearPaint = Object.freeze({
    kind: 'linear',
    start: { x: 0, y: 0 },
    end: { x: size.w * CARD_END_X, y: size.h },
    ...stops,
  });
  if (look.gradient !== 'vivid') {
    const highlight = spotOf(SPOTS.highlight, size, LAYER_COLOURS.highlight);
    return Object.freeze({ linear, glows: [], highlight });
  }
  return Object.freeze({
    linear,
    glows: [
      spotOf(SPOTS.glowPink, size, LAYER_COLOURS.glowPink),
      spotOf(SPOTS.glowCyan, size, LAYER_COLOURS.glowCyan),
    ],
    highlight: spotOf(SPOTS.highlightVivid, size, LAYER_COLOURS.highlightVivid),
  });
}

// ── The band ───────────────────────────────────────────────────────────────────────────────

/** A CSS linear-gradient(angle) over a box: its line through the centre, long enough to reach the corners. */
function across(
  size: PaintSize,
  angle: keyof typeof DIRECTIONS,
): Pick<LinearPaint, 'start' | 'end'> {
  const [dx, dy] = DIRECTIONS[angle];
  const half = (Math.abs(size.w * dx) + Math.abs(size.h * dy)) / 2;
  const cx = size.w / 2;
  const cy = size.h / 2;
  return {
    start: { x: cx - dx * half, y: cy - dy * half },
    end: { x: cx + dx * half, y: cy + dy * half },
  };
}

/** The band behind the top of a view: bandA to bandB at 160° on Soft, three stops at 120° on Rich and Vivid. */
export function bandGradient(
  look: Pick<CandyPaintPicks, 'palette' | 'gradient'>,
  size: PaintSize,
): LinearPaint {
  const c = candyPalette(look.palette).colours;
  if (look.gradient === 'soft') {
    return Object.freeze({
      kind: 'linear',
      ...across(size, 160),
      colours: [c.bandA, c.bandB],
      positions: [0, 1],
    });
  }
  return Object.freeze({
    kind: 'linear',
    ...across(size, 120),
    colours: [c.band1, c.band2, c.band3],
    positions: [0, BAND_MID, 1],
  });
}

// ── The user's bubble ──────────────────────────────────────────────────────────────────────

/** The user's bubble in the Chat view (theme.css --candy-user): userA to userB at 150°. */
export function userGradient(look: Pick<CandyPaintPicks, 'palette'>, size: PaintSize): LinearPaint {
  const c = candyPalette(look.palette).colours;
  return Object.freeze({
    kind: 'linear',
    ...across(size, 150),
    colours: [c.userA, c.userB],
    positions: [0, 1],
  });
}

// ── The orb ────────────────────────────────────────────────────────────────────────────────

/** A stroke along an oval: Skia's addArc(rect, start, sweep), degrees clockwise from 3 o'clock. */
export type ArcPaint = {
  readonly rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly start: number;
  readonly sweep: number;
  readonly strokeWidth: number;
  readonly colour: string;
};

export type RingPaint = {
  readonly c: Point;
  readonly r: number;
  readonly strokeWidth: number;
  readonly colour: string;
};

/** The orb's paint, drawn in this order: the sweep, the pink blush, the gloss, the arc; the ring round it. */
export type OrbPaint = {
  readonly sweep: SweepPaint;
  readonly blush: RadialPaint;
  readonly gloss: RadialPaint;
  readonly arc: ArcPaint;
  readonly halo: RingPaint;
};

/** A CSS radial-gradient(circle at x% y%) over a square: its radius reaches the farthest corner. */
function farthestCorner(size: number, x: number, y: number): number {
  return size * Math.hypot(Math.max(x, 1 - x), Math.max(y, 1 - y));
}

function orbArc(size: number): ArcPaint {
  const edge = size * ORB_ARC.inset + ORB_ARC.width / 2;
  return Object.freeze({
    rect: Object.freeze({ x: edge, y: edge, width: size - 2 * edge, height: size - 2 * edge }),
    start: ORB_ARC.start,
    sweep: ORB_ARC.sweep,
    strokeWidth: ORB_ARC.width,
    colour: SHARED_COLOURS.white92,
  });
}

/** The orb at this diameter: the conic of the three cards' starts and a pink, its blush, gloss and arc. */
export function orbPaint(look: Pick<CandyPaintPicks, 'palette' | 'cards'>, size: number): OrbPaint {
  const [one, two, three] = candyCardOrder(look).map((id) => CARD_SETS[id].a);
  const c = { x: size / 2, y: size / 2 };
  const { white85, white12, white55, orbBlush, orbPink } = SHARED_COLOURS;
  return Object.freeze({
    sweep: Object.freeze({
      kind: 'sweep',
      c,
      rotate: ORB_SWEEP_ROTATE,
      colours: [one, two, three, orbPink, one],
      positions: [0, 0.25, 0.5, 0.75, 1],
    }),
    blush: Object.freeze({
      kind: 'radial',
      c: { x: size * 0.62, y: size * 0.78 },
      r: farthestCorner(size, 0.62, 0.78),
      colours: [orbBlush, clear(orbBlush)],
      positions: [0, 0.45],
    }),
    gloss: Object.freeze({
      kind: 'radial',
      c: { x: size * 0.34, y: size * 0.26 },
      r: farthestCorner(size, 0.34, 0.26),
      colours: [white85, white12, clear(white12)],
      positions: [0, 0.32, 0.6],
    }),
    arc: orbArc(size),
    halo: Object.freeze({
      c,
      r: size / 2 + size * ORB_HALO.outset - ORB_HALO.width / 2,
      strokeWidth: ORB_HALO.width,
      colour: white55,
    }),
  });
}

// ── The aura ───────────────────────────────────────────────────────────────────────────────

export type AuraCircle = {
  readonly c: Point;
  readonly r: number;
  readonly colour: string;
  readonly blur: number;
};

/** Vivid's aura behind the home over an area this size: the palette's three blobs; none otherwise. */
export function auraCircles(
  look: Pick<CandyPaintPicks, 'palette' | 'gradient'>,
  size: PaintSize,
): readonly AuraCircle[] {
  if (look.gradient !== 'vivid') return Object.freeze([]);
  const { blobs } = candyPalette(look.palette).colours;
  return Object.freeze(
    AURA_SPOTS.map((spot, index) =>
      Object.freeze({
        c: { x: size.w * spot.x, y: size.h * spot.y },
        r: size.w * AURA_RADIUS,
        colour: blobs[index],
        blur: AURA_BLUR,
      }),
    ),
  );
}
