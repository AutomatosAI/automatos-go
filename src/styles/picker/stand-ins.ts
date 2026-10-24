// The previews' stand-ins for Auto and HUD's ring core, until their components exist: the picker
// runs before Auto's files and Mascot (US-017a, US-017b) and before RingCore (US-018b), so Play's
// card draws Auto as Mascot.dc.html draws him with no image (a dashed shell, a visor with two eyes,
// the light ring under him) and HUD's card draws the core's outer ring, its dashed ring and the
// pulse disc from the core() specs. Both are replaced by the real components, which take the same
// size and the preview's animate flag. Pure: sizes and colours only; the colours come from the
// style's own variables and the vendored ring rule, never from a literal.

import { rgba } from '../../core/web/lib/look-kit/css';
import { ringColour } from '../../core/web/lib/mascot/ring';
import type { Look } from '../../core/web/lib/looks/types';
import type { HudVars } from '../tokens/hud';
import type { PlayVars } from '../tokens/play';

/** Mascot.dc.html's proportions for a mascot of size s. */
const AUTO = Object.freeze({
  boxWidth: 0.9,
  ringWidth: 0.8,
  ringHeight: 0.18,
  ringStroke: 2,
  bodyWidth: 0.62,
  bodyHeight: 0.74,
  bodyBottom: 0.13,
  bodyEdge: 1.5,
  visorWidth: 0.56,
  visorHeight: 0.22,
  eye: 0.12,
  /** The ring's glow: its colour at 0.35. */
  glowAlpha: 0.35,
});

export type AutoStandIn = {
  readonly box: { readonly width: number; readonly height: number };
  readonly ring: { readonly width: number; readonly height: number; readonly stroke: number };
  readonly body: {
    readonly width: number;
    readonly height: number;
    readonly bottom: number;
    readonly edge: number;
  };
  readonly visor: { readonly width: number; readonly height: number };
  readonly eye: number;
};

export function autoStandIn(size: number): AutoStandIn {
  const bodyWidth = size * AUTO.bodyWidth;
  return Object.freeze({
    box: { width: size * AUTO.boxWidth, height: size },
    ring: { width: size * AUTO.ringWidth, height: size * AUTO.ringHeight, stroke: AUTO.ringStroke },
    body: {
      width: bodyWidth,
      height: size * AUTO.bodyHeight,
      bottom: size * AUTO.bodyBottom,
      edge: AUTO.bodyEdge,
    },
    visor: {
      width: bodyWidth * AUTO.visorWidth,
      height: size * AUTO.bodyHeight * AUTO.visorHeight,
    },
    eye: bodyWidth * AUTO.eye,
  });
}

export type AutoStandInPaint = {
  readonly ring: string;
  readonly ringGlow: string;
  readonly body: string;
  readonly bodyEdge: string;
  readonly visor: string;
  readonly eye: string;
};

/** Auto at rest under a Play look: the ring in the vendored idle colour (his light). */
export function autoStandInPaint(look: Look, vars: PlayVars): AutoStandInPaint {
  const ring = ringColour('idle', look);
  return Object.freeze({
    ring,
    ringGlow: rgba(ring, AUTO.glowAlpha),
    body: vars.accentFill,
    bodyEdge: vars.accentLine,
    visor: vars.groundBg,
    eye: vars.autoLight,
  });
}

/** The page glow behind Play's preview: the look's capped glow, fading to its accent at 0. */
export function playGlowStops(vars: PlayVars): readonly [string, string] {
  return Object.freeze([rgba(vars.accent, 0), vars.glow] as const);
}

/** core()'s rings for a core of size s: the outer 1 pt ring, the dashed ring and the pulse disc. */
const CORE = Object.freeze({
  outerAlpha: 0.22,
  dashedInset: 0.22,
  dashedAlpha: 0.4,
  discInset: 0.3,
  discAlpha: 0.28,
  stroke: 1,
});

export type RingStandIn = {
  readonly outer: number;
  readonly dashed: number;
  readonly disc: number;
  readonly stroke: number;
};

/** A ring at an inset of the core's side, as a diameter. */
function inset(size: number, fraction: number): number {
  return size * (1 - 2 * fraction);
}

export function ringStandIn(size: number): RingStandIn {
  return Object.freeze({
    outer: size,
    dashed: inset(size, CORE.dashedInset),
    disc: inset(size, CORE.discInset),
    stroke: CORE.stroke,
  });
}

export type RingStandInPaint = {
  readonly outer: string;
  readonly dashed: string;
  readonly disc: string;
};

/** The rings in the look's accent (D-ONE-VOICE: the colour is the resolved style's). */
export function ringStandInPaint(vars: HudVars): RingStandInPaint {
  return Object.freeze({
    outer: rgba(vars.accent, CORE.outerAlpha),
    dashed: rgba(vars.accent, CORE.dashedAlpha),
    disc: rgba(vars.accent, CORE.discAlpha),
  });
}
