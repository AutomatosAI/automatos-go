// PRD-268 §6.12.2's colour roles for its states, on Studio's token names: PIP_TOKENS' companion
// (variants.ts) for the vocabulary's states (dress/status-glyphs.ts StatusState), pure. Studio, an
// installed theme and Play paint a state's glyph in its role's token and its word muted, as every
// status word is, except Needs you's, in warn-ink. HUD paints by the glyph's role instead
// (status-glyphs.ts GLYPH_ROLE_TOKENS: the accent, text2, the error), never by these.
//   Two roles fail 3:1 as a mark on a light ground, so there they paint in their light stand-in:
// warning (1.58:1 on Studio Light) in warn-ink, as §6.12.2 says, and running in muted-foreground.
// Go's --running is the web's literal, hsl(40 20% 65%) (1.93:1 on Studio Light); §6.12.2 makes the
// real light token hsl(40 20% 36%), a warm grey, and muted-foreground (36 12% 36%) is the nearest
// one Go has until that value reaches Go's source (studio-source.ts is copied, never retuned).
//   Status colours are the status tokens only (US-T01 asks US-G05 to choose): olive and navy, which
// TEXT_TONES' success and info read, are never a state's colour.

import type { StatusState } from '../styles/dress/status-glyphs';
import type { ColourName, ColourScheme } from '../styles/tokens/types';

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

/** A state's word: muted, except the one the person must act on. */
const WORD_TOKENS: Readonly<Partial<Record<StatusState, ColourName>>> = Object.freeze({
  needs_you: 'warnInk',
});

export const STATE_WORD_TOKEN: ColourName = 'mutedForeground';

export type StatePaint = { readonly glyph: ColourName; readonly word: ColourName };

/** The tokens a state's glyph and word paint in, on a ground of this scheme. */
export function statePaint(state: StatusState, scheme: ColourScheme): StatePaint {
  const role = STATE_TOKENS[state];
  const glyph = scheme === 'light' ? (LIGHT_STAND_INS[role] ?? role) : role;
  return Object.freeze({ glyph, word: WORD_TOKENS[state] ?? STATE_WORD_TOKEN });
}
