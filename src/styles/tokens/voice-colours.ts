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
//   Studio  ink and orange (D60): the accent (--accent) at the vendored line and fill alphas, the
//   themes  foreground, the muted foreground and the border; no glow (Studio draws none)

import { ACCENT_FILL_ALPHA, ACCENT_LINE_ALPHA, rgba } from '../../core/web/lib/look-kit/css';
import type { ResolvedStyle } from '../provider/resolve';
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
};

/** What the paint reads of the resolved style. */
export type VoiceStyle = Pick<ResolvedStyle, 'tokens' | 'hud' | 'play'>;

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
  });
}

/** A colour at 0, where a gradient of it fades out (Skia blends unpremultiplied: never grey). */
export function clearOf(colour: string): string {
  return rgba(colour, 0);
}

const hudPaint = oncePerObject(fromHud);
const playPaint = oncePerObject(fromPlay);
const studioPaint = oncePerObject(fromStudio);

/** The core's colours under the resolved style (once per variables object). */
export function voicePaint(style: VoiceStyle): VoicePaint {
  if (style.hud) return hudPaint(style.hud);
  if (style.play) return playPaint(style.play);
  return studioPaint(style.tokens.colours);
}
