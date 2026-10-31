// The voice core's colours in every style (D-ONE-VOICE, D60): HUD's core is the voice screen in
// every style from A6, so its rings, waveform, state chip, transcript and buttons take their
// colours from the resolved style, never from HUD's constants. Built with the vendored rgba as
// tokens/hud.ts builds its own, so every colour the core paints comes from this directory
// (D-TOKENS).
//
//   HUD     its README's variables: the accent, accent line and fill, the capped glow, text,
//           text2 and the line
//   Play    the look's --pl-* variables: the accent, its line and fill, the capped glow, the
//           ground's text, text2 and line
//   Arcade  the palette's: the rings in ac at the vendored line and fill alphas, the core filled
//           with the window (win) for the sprite to sit in, tx and tx2, the window border bd; no
//           glow (Arcade draws none)
//   Candy   the palette's: the accent and its ink, the accent at the vendored line and fill
//           alphas, the text, the quiet text and the hairline; the rings and the waveform
//           stroked in a gradient of the three card sets' starts (gradient); no glow (Candy's
//           is its shadow, tokens/candy.ts candyShadow), the core clear for the orb
//   Studio  ink and orange (D60): the accent (--accent) at the vendored line and fill alphas, the
//   themes  foreground, the muted foreground and the border; no glow (Studio draws none)
//
// Only Arcade fills the core; every other style leaves it clear (the accent at 0). Only Candy
// strokes in a gradient; every other style leaves gradient out and strokes in the accent. Candy's
// waveform takes the gradient bar by bar (gradientRun: the stops mixed with the vendored mixHex where
// each bar stands), so the colours stay in this directory (D-TOKENS).

import { mixHex } from '../../core/web/lib/look-kit/contrast';
import { ACCENT_FILL_ALPHA, ACCENT_LINE_ALPHA, rgba } from '../../core/web/lib/look-kit/css';
import type { ResolvedStyle } from '../provider/resolve';
import type { ArcadeVars } from './arcade';
import type { CandyVars } from './candy';
import type { HudVars } from './hud';
import type { PlayVars } from './play';
import { oncePerObject } from './style-tokens';
import type { Colours } from './types';

export type VoicePaint = {
  /** The rings, the waveform, the chip's words, the cursor and HOLD TO TALK's border. */
  readonly accent: string;
  /** The text on a solid accent. */
  readonly accentInk: string;
  /** The chip's 1 pt border: the accent at 45 %. */
  readonly accentLine: string;
  /** HOLD TO TALK's fill: the accent at 12 %. */
  readonly accentFill: string;
  /** HOLD TO TALK's 30 pt glow; the accent at 0 where the style has none. */
  readonly glow: string;
  /** Auto's words and STOP's label. */
  readonly text: string;
  /** The user's words, the status row, MIC OFF and TYPE's label. */
  readonly text2: string;
  /** TYPE's and STOP's 1 pt borders. */
  readonly line: string;
  /** The disc inside the rings: Arcade's window; the accent at 0 where the style fills none. */
  readonly coreFill: string;
  /** Candy only: the rings' and the waveform's gradient, the three card sets' starts in order. */
  readonly gradient?: readonly [string, string, string];
};

/** What the paint reads of the resolved style. */
export type VoiceStyle = Pick<ResolvedStyle, 'tokens' | 'hud' | 'play' | 'arcade' | 'candy'>;

function fromHud(vars: HudVars): VoicePaint {
  return Object.freeze({
    accent: vars.accent,
    accentInk: vars.accentInk,
    accentLine: vars.accentLine,
    accentFill: vars.accentFill,
    glow: vars.glow,
    text: vars.text,
    text2: vars.text2,
    line: vars.line,
    coreFill: clearOf(vars.accent),
  });
}

function fromPlay(vars: PlayVars): VoicePaint {
  return Object.freeze({
    accent: vars.accent,
    accentInk: vars.accentInk,
    accentLine: vars.accentLine,
    accentFill: vars.accentFill,
    glow: vars.glow,
    text: vars.groundText,
    text2: vars.groundText2,
    line: vars.groundLine,
    coreFill: clearOf(vars.accent),
  });
}

function fromArcade(vars: ArcadeVars): VoicePaint {
  return Object.freeze({
    accent: vars.ac,
    accentInk: vars.aci,
    accentLine: rgba(vars.ac, ACCENT_LINE_ALPHA),
    accentFill: rgba(vars.ac, ACCENT_FILL_ALPHA),
    glow: clearOf(vars.ac),
    text: vars.tx,
    text2: vars.tx2,
    line: vars.bd,
    coreFill: vars.win,
  });
}

function fromCandy(vars: CandyVars): VoicePaint {
  return Object.freeze({
    accent: vars.accent,
    accentInk: vars.accentInk,
    accentLine: rgba(vars.accent, ACCENT_LINE_ALPHA),
    accentFill: rgba(vars.accent, ACCENT_FILL_ALPHA),
    glow: clearOf(vars.accent),
    text: vars.text,
    text2: vars.quiet,
    line: vars.line,
    coreFill: clearOf(vars.accent),
    gradient: Object.freeze([vars.g1a, vars.g2a, vars.g3a] as const),
  });
}

function fromStudio(colours: Colours): VoicePaint {
  return Object.freeze({
    accent: colours.accent,
    accentInk: colours.accentForeground,
    accentLine: rgba(colours.accent, ACCENT_LINE_ALPHA),
    accentFill: rgba(colours.accent, ACCENT_FILL_ALPHA),
    glow: clearOf(colours.accent),
    text: colours.foreground,
    text2: colours.mutedForeground,
    line: colours.border,
    coreFill: clearOf(colours.accent),
  });
}

/** A colour at 0, where a gradient of it fades out (Skia blends unpremultiplied: never grey). */
export function clearOf(colour: string): string {
  return rgba(colour, 0);
}

const hudPaint = oncePerObject(fromHud);
const playPaint = oncePerObject(fromPlay);
const arcadePaint = oncePerObject(fromArcade);
const candyPaint = oncePerObject(fromCandy);
const studioPaint = oncePerObject(fromStudio);

/** The core's colours under the resolved style (once per variables object). */
export function voicePaint(style: VoiceStyle): VoicePaint {
  if (style.hud) return hudPaint(style.hud);
  if (style.play) return playPaint(style.play);
  if (style.arcade) return arcadePaint(style.arcade);
  if (style.candy) return candyPaint(style.candy);
  return studioPaint(style.tokens.colours);
}

/** Where bar `index` of `count` stands along stops `0 … last`: the first at 0, the last at `last`. */
function standing(index: number, count: number, last: number): number {
  return count > 1 ? (index / (count - 1)) * last : 0;
}

/**
 * Candy's waveform: the gradient's stops spread across `count` bars, first to last, each bar the
 * two stops it stands between mixed where it stands (#RRGGBB). No stops or no bars: none.
 */
export function gradientRun(stops: readonly string[], count: number): readonly string[] {
  const bars = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const last = stops.length - 1;
  if (last < 0 || bars === 0) return Object.freeze([]);
  const run = Array.from({ length: bars }, (_, index) => {
    const at = standing(index, bars, last);
    const from = Math.min(Math.floor(at), last);
    const to = Math.min(from + 1, last);
    return mixHex(stops[from], stops[to], at - from);
  });
  return Object.freeze(run);
}
