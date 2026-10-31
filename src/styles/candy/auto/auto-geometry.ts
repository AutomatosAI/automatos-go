// Candy's Auto as data (PRD-001 §4.6.2, D-CAN-5, KA3-VENDOR-PIN): the design's glossy concept as
// shapes and paints in one 104-unit square, so every drawing of him comes from here. CandyAuto.tsx
// draws it with Skia (each shape through auto-path.ts, each paint a solid or a gradient, every
// colour through tokens/mascot-colours.ts candyAutoColour); the twelve states differ only in the
// eyes (EYE_FORMS, the app's vendored mascot names). Pure: no React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/candy/src/art/auto-geometry.ts at 3920359d5
// (3920359d5350960471aca1b7111f6243be537cc0), sha256
// 426afa07133d616446fb5b39091197fc0574233897e90804e6c6efdbab14971d. Copied; only the imports
// (MascotName from the app's frozen mascot types, AutoColour from tokens/candy-catalogue.ts) and
// the layout (semicolons, line width) are the repo's.

import type { MascotName } from '../../../core/frozen/lib/mascot/types';
import type { AutoColour } from '../../tokens/candy-catalogue';

/**
 * Candy's Auto as data: the design's glossy concept (design/Candy Auto.dc.html) as shapes and paints in one square
 * box, so every drawing of him comes from here. The web draws it as SVG (auto.tsx), the tests rasterise it into the
 * phone's stills (test/support/raster.ts), and Automatos Go vendors this file and draws it with Skia.
 *
 * The concept is CSS boxes in percent of Auto's size: an antenna stalk and a glossy ball, a body with corners of
 * 47% / 42% under three layers (a white gloss, a cyan glow, the pink-to-violet body gradient), a dark visor pill with
 * a shine, two glowing eyes and two blush cheeks. Here each is a shape in box units (the concept's percent, with the
 * box widened so the ball above the body fits) and a stack of paints, bottom first, each a CSS gradient resolved to
 * points: a linear gradient's ends from its angle and the shape's box, a radial one's centre and its radius to the
 * farthest corner. The twelve states differ only in the eyes, the concept's five shapes and five more in its spirit.
 * Pure: no trigonometry at run time (each angle's direction is written out), so every renderer draws the same pixels.
 */

/** The drawing's square: the concept's 0..100 box, widened to hold the antenna's ball (top -3) and centred. */
export const AUTO_BOX = { x: -2, y: -4, size: 104 } as const;

export interface Stop {
  /** 0..1 along the gradient. */
  readonly at: number;
  readonly colour: AutoColour;
  readonly alpha: number;
}

export type Paint =
  | { readonly kind: 'solid'; readonly colour: AutoColour; readonly alpha: number }
  | {
      readonly kind: 'linear';
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly stops: readonly Stop[];
    }
  | {
      readonly kind: 'radial';
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
      readonly stops: readonly Stop[];
    };

/** A box with elliptical corners (CSS border-radius as px pairs): top-left, top-right, bottom-right, bottom-left. */
export interface RoundRect {
  readonly kind: 'rrect';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rx: readonly [number, number, number, number];
  readonly ry: readonly [number, number, number, number];
}

/** An arch: the top half of an ellipse and its straight sides, drawn as a stroke (the celebrating eyes). */
export interface Arch {
  readonly kind: 'arch';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly stroke: number;
}

export type Shape = RoundRect | Arch;

export interface Part {
  readonly name: string;
  readonly shape: Shape;
  /** Bottom first, as CSS lists backgrounds top first. */
  readonly paints: readonly Paint[];
  /** A soft glow behind the part (the eyes, the ball): its colour and blur in box units. */
  readonly glow?: { readonly colour: AutoColour; readonly alpha: number; readonly blur: number };
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** CSS angles the concept uses, as the direction a gradient runs (x right, y down): sin θ and -cos θ, written out. */
const DIRECTIONS = {
  140: [0.6427876096865394, 0.766044443118978],
  150: [0.5, 0.8660254037844386],
  180: [0, 1],
} as const;

type Angle = keyof typeof DIRECTIONS;

const stop = (at: number, colour: AutoColour, alpha = 1): Stop => ({ at, colour, alpha });

/** A CSS linear-gradient(angle, stops) over `box`: its line runs through the centre, long enough to reach the corners. */
export function linear(box: Box, angle: Angle, stops: readonly Stop[]): Paint {
  const [dx, dy] = DIRECTIONS[angle];
  const half = (Math.abs(box.w * dx) + Math.abs(box.h * dy)) / 2;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return {
    kind: 'linear',
    x1: cx - dx * half,
    y1: cy - dy * half,
    x2: cx + dx * half,
    y2: cy + dy * half,
    stops,
  };
}

/** A CSS radial-gradient(circle at px% py%, stops) over `box`: its radius reaches the farthest corner. */
export function radial(box: Box, px: number, py: number, stops: readonly Stop[]): Paint {
  const cx = box.x + box.w * px;
  const cy = box.y + box.h * py;
  const far = (x: number, y: number) => Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  const r = Math.max(
    far(box.x, box.y),
    far(box.x + box.w, box.y),
    far(box.x, box.y + box.h),
    far(box.x + box.w, box.y + box.h),
  );
  return { kind: 'radial', cx, cy, r, stops };
}

const solid = (colour: AutoColour, alpha = 1): Paint => ({ kind: 'solid', colour, alpha });

function pill(box: Box): RoundRect {
  const r = Math.min(box.w, box.h) / 2;
  return { kind: 'rrect', ...box, rx: [r, r, r, r], ry: [r, r, r, r] };
}

function oval(box: Box): RoundRect {
  const rx = box.w / 2;
  const ry = box.h / 2;
  return { kind: 'rrect', ...box, rx: [rx, rx, rx, rx], ry: [ry, ry, ry, ry] };
}

/** The body: left and right 6%, top 12%, bottom 3%, corners 47% at the top and 42% at the bottom. */
export const BODY: Box = { x: 6, y: 12, w: 88, h: 85 };
/** The visor inside the body: 15% in from each side, from 24% down, 40% tall. */
export const VISOR: Box = {
  x: BODY.x + BODY.w * 0.15,
  y: BODY.y + BODY.h * 0.24,
  w: BODY.w * 0.7,
  h: BODY.h * 0.4,
};

function bodyPart(): Part {
  const shape: RoundRect = {
    kind: 'rrect',
    ...BODY,
    rx: [BODY.w * 0.47, BODY.w * 0.47, BODY.w * 0.42, BODY.w * 0.42],
    ry: [BODY.h * 0.47, BODY.h * 0.47, BODY.h * 0.42, BODY.h * 0.42],
  };
  return {
    name: 'body',
    shape,
    paints: [
      linear(BODY, 150, [stop(0, 'bodyA'), stop(0.45, 'bodyB'), stop(1, 'bodyC')]),
      linear(BODY, 180, [stop(0.7, 'shade', 0), stop(1, 'shade', 0.25)]),
      radial(BODY, 0.8, 0.84, [stop(0, 'cyan', 0.8), stop(0.46, 'cyan', 0)]),
      radial(BODY, 0.3, 0.2, [stop(0, 'gloss', 0.95), stop(0.26, 'gloss', 0)]),
    ],
  };
}

function antennaParts(): readonly Part[] {
  const stalk: Box = { x: 48, y: 2, w: 4, h: 14 };
  const ball: Box = { x: 43, y: -3, w: 14, h: 14 };
  return [
    { name: 'stalk', shape: pill({ ...stalk, h: stalk.h }), paints: [solid('stalk')] },
    {
      name: 'ball',
      shape: oval(ball),
      paints: [
        linear(ball, 140, [stop(0, 'ballA'), stop(1, 'ballB')]),
        radial(ball, 0.35, 0.3, [stop(0, 'gloss'), stop(0.18, 'gloss'), stop(0.5, 'gloss', 0)]),
      ],
      glow: { colour: 'ballGlow', alpha: 0.55, blur: 6 },
    },
  ];
}

function visorParts(): readonly Part[] {
  const shine: Box = {
    x: VISOR.x + VISOR.w * 0.12,
    y: VISOR.y + VISOR.h * 0.08,
    w: VISOR.w * 0.46,
    h: VISOR.h * 0.22,
  };
  return [
    {
      name: 'visor',
      shape: pill(VISOR),
      paints: [linear(VISOR, 180, [stop(0, 'visorA'), stop(1, 'visorB')])],
    },
    { name: 'shine', shape: pill(shine), paints: [solid('gloss', 0.14)] },
  ];
}

function cheekParts(): readonly Part[] {
  const y = BODY.y + BODY.h * 0.64;
  const w = BODY.w * 0.16;
  const h = BODY.h * 0.11;
  return [
    {
      name: 'cheek-left',
      shape: oval({ x: BODY.x + BODY.w * 0.11, y, w, h }),
      paints: [solid('cheek', 0.55)],
    },
    {
      name: 'cheek-right',
      shape: oval({ x: BODY.x + BODY.w * (1 - 0.11 - 0.16), y, w, h }),
      paints: [solid('cheek', 0.55)],
    },
  ];
}

/** An eye's form, in fractions of the visor: width, height (or a stroke's fixed height), offsets and its kind. */
export interface EyeForm {
  readonly kind: 'pill' | 'oval' | 'arch' | 'line';
  /** Fractions of the visor's width and height. */
  readonly w: number;
  readonly h: number;
  /** Moves the pair: dx in visor widths, dy in the eye's own heights (CSS translateY of the eye). */
  readonly dx: number;
  readonly dy: number;
}

/** The stroke of a celebrating eye and a sleeping one: the concept's max(2, round(size × 0.035)) at 100. */
export const EYE_STROKE = 3.5;
const GAP = 0.24;

export const EYE_FORMS: Readonly<Record<MascotName, EyeForm>> = {
  idle: { kind: 'pill', w: 0.13, h: 0.52, dx: 0, dy: 0 },
  listening: { kind: 'oval', w: 0.17, h: 0.64, dx: 0, dy: 0 },
  thinking: { kind: 'pill', w: 0.12, h: 0.34, dx: 0, dy: -0.38 },
  celebrate: { kind: 'arch', w: 0.17, h: 0.42, dx: 0, dy: 0.18 },
  hello: { kind: 'arch', w: 0.17, h: 0.42, dx: 0, dy: 0.18 },
  sleeping: { kind: 'line', w: 0.18, h: 0, dx: 0, dy: 0 },
  loading: { kind: 'pill', w: 0.15, h: 0.16, dx: 0, dy: 0 },
  working: { kind: 'pill', w: 0.13, h: 0.36, dx: 0, dy: 0.42 },
  reading: { kind: 'pill', w: 0.14, h: 0.3, dx: 0, dy: 0.62 },
  searching: { kind: 'pill', w: 0.12, h: 0.44, dx: 0.1, dy: 0 },
  oops: { kind: 'oval', w: 0.12, h: 0.3, dx: 0, dy: 0 },
  lost: { kind: 'oval', w: 0.12, h: 0.3, dx: -0.1, dy: 0.2 },
};

function eyeBox(form: EyeForm, side: -1 | 1): Box {
  const w = VISOR.w * form.w;
  const h = form.kind === 'line' ? EYE_STROKE : VISOR.h * form.h;
  const cx = VISOR.x + VISOR.w / 2 + VISOR.w * form.dx + side * ((VISOR.w * GAP) / 2 + w / 2);
  const cy = VISOR.y + VISOR.h / 2 + h * form.dy;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function eyePart(form: EyeForm, side: -1 | 1): Part {
  const box = eyeBox(form, side);
  const name = side < 0 ? 'eye-left' : 'eye-right';
  const glow = form.kind === 'line' ? undefined : { colour: 'eyeGlow' as const, alpha: 1, blur: 6 };
  if (form.kind === 'arch')
    return { name, shape: { kind: 'arch', ...box, stroke: EYE_STROKE }, paints: [solid('eye')] };
  return {
    name,
    shape: form.kind === 'oval' ? oval(box) : pill(box),
    paints: [solid('eye')],
    glow,
  };
}

/** Auto in `state`, every part bottom first: antenna, body, visor, eyes, cheeks. */
export function autoParts(state: MascotName): readonly Part[] {
  const form = EYE_FORMS[state];
  return [
    ...antennaParts(),
    bodyPart(),
    ...visorParts(),
    eyePart(form, -1),
    eyePart(form, 1),
    ...cheekParts(),
  ];
}

/** The eyes' names: the parts the blink closes. */
export const EYE_PARTS: ReadonlySet<string> = new Set(['eye-left', 'eye-right']);
