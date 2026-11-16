// PRD-268 §6.12.2's colour roles for its states, on Studio's token names: PIP_TOKENS' companion
// (variants.ts) for the vocabulary's states (dress/status-glyphs.ts StatusState), pure. Studio, an
// installed theme and Play paint a state's glyph in its role's token (a mark, drawn by StateGlyph)
// and its word in a Text tone: muted, as every status word is, except Needs you's, in warning
// (warn-ink). HUD paints by the glyph's role instead
// (status-glyphs.ts GLYPH_ROLE_TOKENS: the accent, text2, the error), never by these.
//   Two roles fail 3:1 as a mark on a light ground, so there they paint in their light stand-in:
// warning (1.58:1 on Studio Light) in warn-ink, as §6.12.2 says, and running in muted-foreground.
// Go's --running is the web's literal, hsl(40 20% 65%) (1.93:1 on Studio Light); §6.12.2 makes the
// real light token hsl(40 20% 36%), a warm grey, and muted-foreground (36 12% 36%) is the nearest
// one Go has until that value reaches Go's source (studio-source.ts is copied, never retuned).
//   Status colours are the status tokens only (US-T01 asks US-G05 to choose): olive and navy, which
// TEXT_TONES' success and info read, are never a state's colour.
//   Arcade draws HUD's glyph + WORD but paints the glyph by these roles (glyphToken, its dress's
// glyphPaint 'state-role', D-ARC-7): its role tokens are tuned on each palette to read on its own
// grounds (tokens/arcade.ts), so no light stand-in applies, and none of them is the accent.

import {
  GLYPH_ROLE_TOKENS,
  glyphState,
  statusGlyph,
  type GlyphPaint,
  type StatusState,
} from '../styles/dress/status-glyphs';
import type { ColourName, ColourScheme } from '../styles/tokens/types';
import type { TextTone } from './variants';

/** Each state's role (§6.12.2), on any ground. */
export const STATE_TOKENS: Readonly<Record<StatusState, ColourName>> = Object.freeze({
  needs_you: 'warning',
  working: 'running',
  ready: 'success',
  done: 'success',
  failed: 'destructive',
  needs_setup: 'info',
  not_checked: 'mutedForeground',
});

/** On a light ground: the token a role that fails 3:1 there paints in instead. */
// PRD-268 §6.12.2: a real light --running comes later, through core's token and skin contract.
export const LIGHT_STAND_INS: Readonly<Partial<Record<ColourName, ColourName>>> = Object.freeze({
  warning: 'warnInk',
  running: 'mutedForeground',
});

/** A state's word, as a Text tone: muted, except the one the person must act on (warn-ink). */
const WORD_TONES: Readonly<Partial<Record<StatusState, TextTone>>> = Object.freeze({
  needs_you: 'warning',
});

export const STATE_WORD_TONE: TextTone = 'muted';

export type StatePaint = { readonly glyph: ColourName; readonly word: TextTone };

/** The token a state's glyph paints in on a ground of this scheme, and its word's tone. */
export function statePaint(state: StatusState, scheme: ColourScheme): StatePaint {
  const role = STATE_TOKENS[state];
  const glyph = scheme === 'light' ? (LIGHT_STAND_INS[role] ?? role) : role;
  return Object.freeze({ glyph, word: WORD_TONES[state] ?? STATE_WORD_TONE });
}

/**
 * The token a glyph status's glyph paints in: HUD's glyph role ('glyph-role'), or the role of the
 * state it reads as ('state-role', Arcade: glyphState, then STATE_TOKENS).
 */
export function glyphToken(status: string, paint: GlyphPaint): ColourName {
  if (paint === 'glyph-role') return GLYPH_ROLE_TOKENS[statusGlyph(status).role];
  return STATE_TOKENS[glyphState(status)];
}
