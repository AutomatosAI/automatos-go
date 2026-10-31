// The voice screen's dress (KV9, D-ONE-VOICE, US-019i): how each style paints A5's HUD core, the
// voice screen in every style. Pure: no React, React Native or Expo; every colour is the resolved
// style's own (A5's resolveStyle, read through the core's voicePaint), never a literal here.
//   Studio, and an installed theme (the Studio layout): ink and orange. The rings' structure (outer
//   ring, ticks, dashed ring, crosshair) in --foreground (tokens.colours.foreground), their motion
//   (arcs, segments, pulse) in --accent (tokens.colours.accent); no HUD overlay; Auto in the core
//   only when the theme brings its own mascot.
//   Play: the look's accent for both, Auto (A5's Mascot) in the centre always.
//   HUD: hud.accent for both, its overlay, Auto when the look's auto is 'on'.
//   Arcade (US-022i, D-ONE-VOICE): the palette's accent (ac) for both, the core filled with the
//   window (win), Auto always, as Arcade's pixel sprite in place of the bundled mascot; no HUD
//   overlay.
//   Candy (US-023l, D-ONE-VOICE, D-CAN-5): the palette's accent for both under the card sets'
//   gradient (voicePaint's: the three starts, which the rings and the waveform are stroked in), the
//   core clear, Auto always, as Candy's own Auto inside Candy's orb (240 in the 290 core) in place
//   of the bundled mascot; no HUD overlay.
//   The waveform, the chip's words and the cursor take the accent; the chip's line the accent line.
//   motion is the resolved style's loops: Reduce Motion, or HUD's motion off, stills them all.
//   Arcade's pause and Candy's, kept in the style store, still them too: the core reads them live
//   (src/styles/hud/core/use-voice-core.ts), so they are not part of this pure dress.

import type { ResolvedStyle } from '../../styles/provider/resolve';
import { voicePaint } from '../../styles/tokens/voice-colours';

/** What the dress reads of the resolved style. */
export type DressStyle = Pick<
  ResolvedStyle,
  'layout' | 'tokens' | 'play' | 'hud' | 'hudLook' | 'arcade' | 'candy' | 'mascot' | 'motion'
>;

export type VoiceDress = {
  /** The rings' structure: ink in Studio, the accent elsewhere. */
  readonly ringLine: string;
  /** The rings' motion: the accent. */
  readonly ringAccent: string;
  readonly waveform: string;
  /** The state chip's 1 pt border. */
  readonly chipLine: string;
  readonly chipText: string;
  /** Auto's streaming cursor in the transcript. */
  readonly cursor: string;
  /** HUD's ground and scanlines over the screen. */
  readonly overlay: boolean;
  /** Auto (A5's Mascot) sits in the centre of the rings. */
  readonly mascotInCore: boolean;
  /** Auto in the core is Arcade's pixel sprite, never the bundled mascot. */
  readonly sprite: boolean;
  /** The disc inside the rings: Arcade's window; the accent at 0 where the style fills none. */
  readonly coreFill: string;
  /** Auto in the core is Candy's own, inside Candy's orb, never the bundled mascot. */
  readonly candy: boolean;
  /** The rings and the waveform stroked in these colours (Candy's card sets); absent, the accent. */
  readonly gradient?: readonly [string, string, string];
  /** Loops may run: rings, waveform shimmer, cursor blink, pulse. */
  readonly motion: boolean;
};

/** The styles whose Auto is always in the core: Play's Mascot, Arcade's sprite, Candy's own. */
const AUTO_ALWAYS: ReadonlySet<DressStyle['layout']> = new Set(['play', 'arcade', 'candy'] as const);

function mascotInCore(style: DressStyle): boolean {
  if (AUTO_ALWAYS.has(style.layout)) return true;
  if (style.layout === 'hud') return style.hudLook?.auto === 'on';
  return style.mascot === 'theme';
}

export function voiceDress(style: DressStyle): VoiceDress {
  const paint = voicePaint(style);
  return Object.freeze({
    ringLine: style.layout === 'studio' ? style.tokens.colours.foreground : paint.accent,
    ringAccent: paint.accent,
    waveform: paint.accent,
    chipLine: paint.accentLine,
    chipText: paint.accent,
    cursor: paint.accent,
    overlay: style.layout === 'hud',
    mascotInCore: mascotInCore(style),
    sprite: style.layout === 'arcade',
    coreFill: paint.coreFill,
    candy: style.layout === 'candy',
    ...(style.layout === 'candy' && paint.gradient ? { gradient: paint.gradient } : {}),
    motion: style.motion.loops,
  });
}
