// HUD's voice core (D54, D-ONE-VOICE), pure: the rings core() draws in 'Automatos Command HUD.dc.html'
// for a core of side S (290 on the phone, 420 on the desktop), as numbers RingCore.tsx paints in
// the colour it is given. Each ring is a square box at an inset of S, made round, and either a
// border (its stroke inside the box's edge) or a band a CSS mask cuts from a conic gradient:
// radial-gradient(circle, …) measures its stops along the ray to the box's farthest corner, half
// the box's diagonal, so a band at a-b % lies between a % and b % of side / √2 (and inside the
// box's circle, which clips it).
//
//   outer       inset 0: a 1 pt border, the accent at 0.22
//   ticks       inset 3 %: 1° ticks every 5° in the accent at 0.7, the 66-69 % band; 60 s a turn
//   arc         inset 8 %: a 2 pt border, the top quarter the accent and the right at 0.35, a
//               6 pt glow (drop-shadow 0 0 6px); 7 s
//   segments    inset 15 %, the 68-71 % band: the accent 0-64°, a gap to 96°, the accent at 0.5 to
//               210°, a gap to 236°, the accent to 300°; 16 s the other way
//   dashed      inset 22 %: a 1 pt dashed border, the accent at 0.4; 30 s
//   inner arc   inset 27 %: a 1.5 pt border, the bottom quarter the accent and the left at 0.3;
//               5 s the other way
//   pulse       inset 30 %: a radial of the accent at 0.28, gone by 70 %; opacity 0.55 ↔ 1 and
//               scale 0.96 ↔ 1.04 over 2.4 s, ease-in-out
//   crosshair   1 pt lines through the centre from 4 % to 96 %, the accent 0 → 0.25 → 0
//
// Angles are CSS's: degrees clockwise from twelve o'clock (conic-gradient's 0deg). A border's
// quarters meet on the diagonals, so its top quarter runs -45° to 45°.

/** The core's side on the phone and on the desktop (README 'Core (voice)'). */
export const CORE_SIZE = Object.freeze({ phone: 290, desktop: 420 });

/** CSS's ease-in-out, cubic-bezier(.42, 0, .58, 1): the pulse's and the waveform's breath. */
export const CSS_EASE_IN_OUT = Object.freeze([0.42, 0, 0.58, 1] as const);

/** 1 turns clockwise (hudSpin), -1 the other way (hudSpinRev); every spin is linear. */
export type SpinDirection = 1 | -1;

export type RingSpin = { readonly periodMs: number; readonly direction: SpinDirection };

/** A piece of a ring: from start for sweep degrees, the colour at alpha. */
export type RingArc = { readonly start: number; readonly sweep: number; readonly alpha: number };

/** A dash pattern along the stroke's centre line, in points. */
export type RingDash = { readonly on: number; readonly off: number };

export type RingStroke = {
  readonly key: string;
  /** The stroke's centre line from the core's centre. */
  readonly radius: number;
  readonly width: number;
  readonly arcs: readonly RingArc[];
  readonly dash: RingDash | null;
  /** The drop-shadow's blur radius in points (Skia's sigma is half); 0: none. */
  readonly glow: number;
  readonly spin: RingSpin | null;
};

export type RingPulse = {
  /** The disc's round clip. */
  readonly radius: number;
  /** The gradient's ray (radial-gradient(circle) to the farthest corner). */
  readonly ray: number;
  readonly alpha: number;
  /** Where along the ray the accent is gone. */
  readonly fadeEnd: number;
  readonly opacity: readonly [number, number];
  readonly scale: readonly [number, number];
  readonly periodMs: number;
};

export type CrosshairLine = {
  readonly key: 'vertical' | 'horizontal';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type Crosshair = {
  readonly lines: readonly CrosshairLine[];
  /** The accent's alpha at the line's ends, middle and other end. */
  readonly alphas: readonly [number, number, number];
};

export type RingSpecs = {
  readonly size: number;
  readonly centre: number;
  /** Outermost first, as the drawing stacks them. */
  readonly strokes: readonly RingStroke[];
  readonly pulse: RingPulse;
  readonly crosshair: Crosshair;
};

const FULL_TURN = 360;
const MS = 1000;
const QUARTER = 90;
const HALF_QUARTER = 45;
/** Six o'clock: the inner arc's coloured quarter is centred there. */
const BOTTOM = 180;
const PERCENT = 100;
const CLOCKWISE: SpinDirection = 1;
const COUNTER: SpinDirection = -1;

/** core()'s numbers, as written there. */
export const CORE_RINGS = Object.freeze({
  outer: Object.freeze({ inset: 0, width: 1, alpha: 0.22 }),
  ticks: Object.freeze({
    inset: 3,
    band: Object.freeze([66, 69] as const),
    every: 5,
    tick: 1,
    alpha: 0.7,
    seconds: 60,
  }),
  arc: Object.freeze({ inset: 8, width: 2, side: 0.35, glow: 6, seconds: 7 }),
  segments: Object.freeze({
    inset: 15,
    band: Object.freeze([68, 71] as const),
    pieces: Object.freeze([
      Object.freeze({ from: 0, to: 64, alpha: 1 }),
      Object.freeze({ from: 96, to: 210, alpha: 0.5 }),
      Object.freeze({ from: 236, to: 300, alpha: 1 }),
    ]),
    seconds: 16,
  }),
  dashed: Object.freeze({ inset: 22, width: 1, alpha: 0.4, seconds: 30 }),
  innerArc: Object.freeze({ inset: 27, width: 1.5, side: 0.3, seconds: 5 }),
  pulse: Object.freeze({
    inset: 30,
    alpha: 0.28,
    fadeEnd: 0.7,
    opacity: Object.freeze([0.55, 1] as const),
    scale: Object.freeze([0.96, 1.04] as const),
    seconds: 2.4,
  }),
  crosshair: Object.freeze({
    from: 4,
    width: 1,
    alphas: Object.freeze([0, 0.25, 0] as const),
  }),
});

/** CSS draws a dashed border in dashes and gaps three times its width. */
const DASH_PER_WIDTH = 3;

/** The radius of the round box at inset (a percentage of the side) in a core of this side. */
export function boxRadius(size: number, inset: number): number {
  return (size * (1 - (2 * inset) / PERCENT)) / 2;
}

/**
 * A band's inner and outer radius: its stops along the ray to the box's farthest corner, the
 * outer one held to the box's circle (border-radius 50 % clips the band; the segments' 71 % of
 * the ray reaches past it).
 */
export function bandRadii(boxR: number, band: readonly [number, number]): readonly [number, number] {
  const ray = boxR * Math.SQRT2;
  return [(ray * band[0]) / PERCENT, Math.min((ray * band[1]) / PERCENT, boxR)] as const;
}

function spin(seconds: number, direction: SpinDirection): RingSpin {
  return Object.freeze({ periodMs: seconds * MS, direction });
}

function stroke(
  key: string,
  radius: number,
  width: number,
  arcs: readonly RingArc[],
  extra: Partial<Pick<RingStroke, 'dash' | 'glow' | 'spin'>> = {},
): RingStroke {
  return Object.freeze({
    key,
    radius,
    width,
    arcs: Object.freeze(arcs.map((arc) => Object.freeze(arc))),
    dash: extra.dash ?? null,
    glow: extra.glow ?? 0,
    spin: extra.spin ?? null,
  });
}

/** A border on the round box at inset: its stroke's centre line is half its width inside. */
function border(size: number, inset: number, width: number) {
  return { radius: boxRadius(size, inset) - width / 2, width };
}

/** A band as a stroke along its middle, as wide as the band. */
function band(size: number, inset: number, stops: readonly [number, number]) {
  const [inner, outer] = bandRadii(boxRadius(size, inset), stops);
  return { radius: (inner + outer) / 2, width: outer - inner };
}

const whole = (alpha: number): RingArc => ({ start: 0, sweep: FULL_TURN, alpha });

/** A border's two coloured quarters: the first centred on `at`, the next clockwise after it. */
function quarters(at: number, alpha: number, nextAlpha: number): readonly RingArc[] {
  const start = at - HALF_QUARTER;
  return [
    { start, sweep: QUARTER, alpha },
    { start: start + QUARTER, sweep: QUARTER, alpha: nextAlpha },
  ];
}

function tickArcs(): readonly RingArc[] {
  const { every, tick, alpha } = CORE_RINGS.ticks;
  return Array.from({ length: FULL_TURN / every }, (_, index) => ({
    start: index * every,
    sweep: tick,
    alpha,
  }));
}

/** CSS's dashes, evened out so a whole number of dash-and-gap pairs goes round the circle. */
export function evenDash(radius: number, width: number): RingDash {
  const circumference = 2 * Math.PI * radius;
  const pairs = Math.max(1, Math.round(circumference / (2 * DASH_PER_WIDTH * width)));
  const half = circumference / pairs / 2;
  return Object.freeze({ on: half, off: half });
}

function strokes(size: number): readonly RingStroke[] {
  const { outer, ticks, arc, segments, dashed, innerArc } = CORE_RINGS;
  const outerLine = border(size, outer.inset, outer.width);
  const tickBand = band(size, ticks.inset, ticks.band);
  const arcLine = border(size, arc.inset, arc.width);
  const segmentBand = band(size, segments.inset, segments.band);
  const dashedLine = border(size, dashed.inset, dashed.width);
  const innerLine = border(size, innerArc.inset, innerArc.width);
  const pieces = segments.pieces.map(({ from, to, alpha }) => ({
    start: from,
    sweep: to - from,
    alpha,
  }));
  return [
    stroke('outer', outerLine.radius, outerLine.width, [whole(outer.alpha)]),
    stroke('ticks', tickBand.radius, tickBand.width, tickArcs(), {
      spin: spin(ticks.seconds, CLOCKWISE),
    }),
    stroke('arc', arcLine.radius, arcLine.width, quarters(0, 1, arc.side), {
      glow: arc.glow,
      spin: spin(arc.seconds, CLOCKWISE),
    }),
    stroke('segments', segmentBand.radius, segmentBand.width, pieces, {
      spin: spin(segments.seconds, COUNTER),
    }),
    stroke('dashed', dashedLine.radius, dashedLine.width, [whole(dashed.alpha)], {
      dash: evenDash(dashedLine.radius, dashedLine.width),
      spin: spin(dashed.seconds, CLOCKWISE),
    }),
    stroke('innerArc', innerLine.radius, innerLine.width, quarters(BOTTOM, 1, innerArc.side), {
      spin: spin(innerArc.seconds, COUNTER),
    }),
  ];
}

function pulse(size: number): RingPulse {
  const { inset, alpha, fadeEnd, opacity, scale, seconds } = CORE_RINGS.pulse;
  const radius = boxRadius(size, inset);
  return Object.freeze({
    radius,
    ray: radius * Math.SQRT2,
    alpha,
    fadeEnd,
    opacity,
    scale,
    periodMs: seconds * MS,
  });
}

function crosshair(size: number): Crosshair {
  const { from, width, alphas } = CORE_RINGS.crosshair;
  const start = (size * from) / PERCENT;
  const length = size - 2 * start;
  const middle = size / 2;
  return Object.freeze({
    lines: Object.freeze([
      Object.freeze({ key: 'vertical' as const, x: middle, y: start, width, height: length }),
      Object.freeze({ key: 'horizontal' as const, x: start, y: middle, width: length, height: width }),
    ]),
    alphas,
  });
}

/** Every ring of a core this many points across. */
export function ringSpecs(size: number = CORE_SIZE.phone): RingSpecs {
  return Object.freeze({
    size,
    centre: size / 2,
    strokes: Object.freeze(strokes(size)),
    pulse: pulse(size),
    crosshair: crosshair(size),
  });
}

export type ArcGroup = { readonly alpha: number; readonly arcs: readonly RingArc[] };

/** A stroke's arcs by alpha, in the order each alpha first appears: one path per group. */
export function arcGroups(arcs: readonly RingArc[]): readonly ArcGroup[] {
  const alphas = [...new Set(arcs.map((arc) => arc.alpha))];
  return Object.freeze(
    alphas.map((alpha) => Object.freeze({ alpha, arcs: arcs.filter((arc) => arc.alpha === alpha) })),
  );
}

/** A CSS angle (clockwise from twelve) as Skia's (clockwise from three). */
export function skiaAngle(cssDegrees: number): number {
  return cssDegrees - QUARTER;
}
