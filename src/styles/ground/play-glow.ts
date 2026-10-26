// Play's page glow on the phone (D54), pure: what PlayGlow.tsx draws behind a screen. The web's
// two fixed layers (app/play-theme.css body::before and body::after), because a gradient cannot
// be crossfaded: the look's glow at the page-glow level for Auto's state (tokens/play.ts
// pageGlowLayers: calm 0.45, busy 0.7, bright 1, snag and asleep 0) and the coral snag layer at
// 1 while he needs help, each crossfading over --pl-duration-glow on --pl-ease-out, at once under
// Reduce Motion. The edge screens that bring their own light (Not running's dusk, Something went
// wrong's coral) hold it whatever Auto's state, with no snag layer.

import type { Look } from '../../core/frozen/lib/looks/types';
import type { MascotName } from '../../core/frozen/lib/mascot/types';
import { playLightStops, playSnagStops, type RadialStops } from '../tokens/ground-colours';
import { PLAY_GLOW_CROSSFADE_MS, pageGlowLayers, type PlayVars } from '../tokens/play';
import { PLAY_SPOTS, type PlaySpot, type ScreenKind } from './spots';

/** --pl-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1). */
export const PLAY_GLOW_EASING = Object.freeze([0.2, 0.8, 0.2, 1] as const);

/** Auto's state when a screen names none: idle, the calm level. */
export const RESTING_STATE: MascotName = 'idle';

/** One layer: its two stops and the opacity it fades to. */
export type LightLayer = { readonly stops: RadialStops; readonly opacity: number };

export type PlayGlowPlan = {
  readonly spot: PlaySpot;
  readonly light: LightLayer;
  /** The coral layer for 'snag'; null on a screen with its own light. */
  readonly snag: LightLayer | null;
  /** How long a change of level fades: 600 ms, 0 under Reduce Motion. */
  readonly fadeMs: number;
};

export type PlayGlowInput = {
  readonly look: Look;
  readonly vars: PlayVars;
  readonly kind: ScreenKind;
  readonly state: MascotName;
  /** The style's motion.loops: false under Reduce Motion. */
  readonly loops: boolean;
};

/** What PlayGlow draws for this screen and Auto's state; null where Ember draws no light. */
export function playGlowPlan({ look, vars, kind, state, loops }: PlayGlowInput): PlayGlowPlan | null {
  const spot = PLAY_SPOTS[kind];
  if (!spot) return null;
  const fadeMs = loops ? PLAY_GLOW_CROSSFADE_MS : 0;
  const stops = playLightStops(look, vars, spot.light, spot.alpha);
  if (spot.light !== 'glow') {
    return Object.freeze({ spot, light: { stops, opacity: 1 }, snag: null, fadeMs });
  }
  const levels = pageGlowLayers(state);
  return Object.freeze({
    spot,
    light: { stops, opacity: levels.accent },
    snag: { stops: playSnagStops(look, vars), opacity: levels.snag },
    fadeMs,
  });
}
