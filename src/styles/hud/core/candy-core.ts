// Candy's voice core (US-023l, D-ONE-VOICE, CANDY-LAYOUT §7), pure: Candy's orb at the core's
// centre, 240 in the drawn 290 core (in step as a short screen shrinks the core, coreSizeIn), and
// Candy's Auto in the orb, half its side, both centred on whole points. The rings outside the orb
// stay the core's (ring-specs.ts): the outer ring, the ticks and the arc show round it. Pure: no
// React, React Native, Expo or Skia.

import { CORE_SIZE } from './ring-specs';

/** In the drawn 290 core: the orb's side, and Auto's as a share of the orb's. */
export const CANDY_CORE = Object.freeze({ orb: 240, autoShare: 0.5 });

/** A square centred in the core: its side and its offset from the core's top and left. */
export type CorePiece = { readonly side: number; readonly offset: number };

export type CandyCorePlace = { readonly orb: CorePiece; readonly auto: CorePiece };

function centred(coreSize: number, side: number): CorePiece {
  return Object.freeze({ side, offset: Math.round((coreSize - side) / 2) });
}

/** The orb and Auto in a core of this side: 240 and 120 in 290, in step on a smaller core. */
export function candyCorePlace(coreSize: number): CandyCorePlace {
  const core = Number.isFinite(coreSize) && coreSize > 0 ? coreSize : CORE_SIZE.phone;
  const orb = Math.max(1, Math.round((CANDY_CORE.orb * core) / CORE_SIZE.phone));
  const auto = Math.max(1, Math.round(orb * CANDY_CORE.autoShare));
  return Object.freeze({ orb: centred(core, orb), auto: centred(core, auto) });
}
