// Auto's stage at a size s (D-MASCOT), pure: the numbers Mascot.dc.html draws him with, rounded to
// whole points as it rounds them, for the Mascot (Mascot.tsx) and its ring (MascotRing.tsx).
//
//   stage    0.9s x s
//   ring     an ellipse 0.8s x 0.18s centred at the bottom: a 2 pt stroke in the ring colour, a glow
//            of the ring colour at 0.35 (box-shadow 0 0 22px outside, inset 0 0 14px inside) over a
//            radial fill (radial-gradient(closest-side, glow, transparent))
//   figure   0.62s x 0.74s, centred, standing 0.13s above the bottom; the clip or still is the
//            square 'center bottom / contain' leaves in it (the files are 512 x 512)
//   pulse    Ember's ring-pulse (auto-mascot.module.css): scale 1 → 1.06 and opacity 0.8 → 1 and
//            back, 2.4 s ease-in-out, forever; none under Reduce Motion
//
// The ring's glow reaches past the stage (CSS draws a shadow outside its box), so the ring's canvas
// is the ring's box grown by GLOW_REACH sigmas of the outer blur and the pulse's growth.

/** The sizes the app draws Auto at, in points. */
export const MASCOT_SIZES = Object.freeze({
  /** Play's Auto row (Ember 01-02). */
  autoRow: 84,
  /** HUD's core. */
  hudCore: 104,
  /** Lost (Ember 09). */
  lost: 140,
  /** Not running (Ember 07). */
  notRunning: 150,
  /** First open (Ember 06). */
  firstOpen: 170,
  /** The look page's preview. */
  lookPreview: 220,
});

const STAGE_WIDTH = 0.9;
const RING_WIDTH = 0.8;
const RING_HEIGHT = 0.18;
const FIGURE_WIDTH = 0.62;
const FIGURE_HEIGHT = 0.74;
const FIGURE_BOTTOM = 0.13;

/** The ring's border, in points. */
export const RING_STROKE = 2;
/** box-shadow 0 0 22px: the glow outside the ring. */
export const RING_OUTER_BLUR = 22;
/** box-shadow inset 0 0 14px: the glow inside it. */
export const RING_INNER_BLUR = 14;

/** Ember's ring pulse: CSS ease-in-out is cubic-bezier(.42, 0, .58, 1). */
export const RING_PULSE = Object.freeze({
  scale: 1.06,
  opacity: 0.8,
  periodMs: 2400,
  easing: Object.freeze([0.42, 0, 0.58, 1] as const),
});

/** A Gaussian is spent this many sigmas out: the canvas ends there. */
const GLOW_REACH = 3;

/** A CSS blur radius as Skia's sigma: the spec's shadow is a Gaussian of half the blur radius. */
export function blurSigma(blurRadius: number): number {
  return blurRadius / 2;
}

export type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type RingGeometry = {
  /** The canvas, in the stage's coordinates (it reaches past the stage on every side). */
  readonly canvas: Box;
  /** The ring's ellipse box (its border box), in the canvas's coordinates. */
  readonly oval: Box;
  /** Inside the border (the padding box): where the inset glow is clipped. */
  readonly inner: Box;
  /** The stroke's path: the border box inset by half the stroke. */
  readonly stroke: Box;
  readonly centre: { readonly x: number; readonly y: number };
  /** The fill's radial gradient: radius rx, scaled by ry / rx on y (closest-side of an ellipse). */
  readonly fill: { readonly r: number; readonly scaleY: number };
  readonly outerSigma: number;
  readonly innerSigma: number;
};

export type MascotGeometry = {
  readonly size: number;
  readonly stage: { readonly width: number; readonly height: number };
  readonly ring: RingGeometry;
  /** The figure's box in the stage (y from the top). */
  readonly figure: Box;
  /** The clip or still: the square the figure's 'center bottom / contain' gives it. */
  readonly media: Box;
};

function inset(box: Box, by: number): Box {
  return Object.freeze({
    x: box.x + by,
    y: box.y + by,
    width: box.width - 2 * by,
    height: box.height - 2 * by,
  });
}

function ringGeometry(size: number, stageWidth: number): RingGeometry {
  const width = Math.round(size * RING_WIDTH);
  const height = Math.round(size * RING_HEIGHT);
  const outerSigma = blurSigma(RING_OUTER_BLUR);
  const growth = ((RING_PULSE.scale - 1) * width) / 2;
  const margin = Math.ceil(GLOW_REACH * outerSigma + growth);
  const oval = Object.freeze({ x: margin, y: margin, width, height });
  return Object.freeze({
    canvas: Object.freeze({
      x: (stageWidth - width) / 2 - margin,
      y: size - height - margin,
      width: width + 2 * margin,
      height: height + 2 * margin,
    }),
    oval,
    inner: inset(oval, RING_STROKE),
    stroke: inset(oval, RING_STROKE / 2),
    centre: Object.freeze({ x: margin + width / 2, y: margin + height / 2 }),
    fill: Object.freeze({ r: width / 2, scaleY: height / width }),
    outerSigma,
    innerSigma: blurSigma(RING_INNER_BLUR),
  });
}

/** Auto's stage at size s, in points. */
export function mascotGeometry(size: number): MascotGeometry {
  if (!Number.isFinite(size) || size <= 0) throw new Error(`Auto's size must be positive: ${size}`);
  const stageWidth = Math.round(size * STAGE_WIDTH);
  const width = Math.round(size * FIGURE_WIDTH);
  const height = Math.round(size * FIGURE_HEIGHT);
  const bottom = Math.round(size * FIGURE_BOTTOM);
  const figure = Object.freeze({ x: (stageWidth - width) / 2, y: size - bottom - height, width, height });
  const side = Math.min(width, height);
  return Object.freeze({
    size,
    stage: Object.freeze({ width: stageWidth, height: size }),
    ring: ringGeometry(size, stageWidth),
    figure,
    media: Object.freeze({
      x: (stageWidth - side) / 2,
      y: size - bottom - side,
      width: side,
      height: side,
    }),
  });
}
