// The colours Play's Companion components (src/styles/play/companion, Ember 01-03) derive from the
// look's variables beyond the ones they carry, built with the vendored rgba and mixHex as
// tokens/dress-colours.ts builds its own, so every colour the chat, the conversations and the bar
// paint comes from this directory (D-TOKENS). Ember draws them on Graphite in its own hexes; each
// is the look's variable at Ember's alpha, so every look paints them: the ground's text for lines,
// the accent for the running tool chip, the report card and the Shelf's newest piece (Ember 04), the
// error for a failed chip, and the sheet's ink for the report's paper.

import { mixHex } from '../../core/web/lib/look-kit/contrast';
import { rgba } from '../../core/web/lib/look-kit/css';
import type { PlayVars } from './play';
import { oncePerObject } from './style-tokens';

/** Ember's alphas, each named for what it paints. */
export const COMPANION_ALPHAS = Object.freeze({
  /** The header's bottom line and the bottom bar's top line: the ground's text at 8 %. */
  headerLine: 0.08,
  /** The user's outlined bubble: the ground's text at 16 %. */
  bubbleLine: 0.16,
  /** The composer's field: the ground's text at 14 %. */
  fieldLine: 0.14,
  /** Conversations' dividers: the ground's text at 7 %. */
  divider: 0.07,
  /** A running tool chip's and the report card's 1 pt line: the accent at 40 %. */
  accentLine: 0.4,
  /** The running chip's spinner track: the accent at 30 % under its solid top. */
  spinnerTrack: 0.3,
  /** A failed chip: the error at 10 % with a 1 pt error line at 45 %. */
  failedFill: 0.1,
  failedLine: 0.45,
  /** The report card's 135° gradient: the accent from 16 % to 3 %. */
  reportFrom: 0.16,
  reportTo: 0.03,
  /** The paper's rule and chart bars: the sheet's ink mixed into it (Ember's #CFC5BB, #B7ADA4). */
  paperRule: 0.16,
  paperBar: 0.27,
  /** The Shelf's newest piece (Ember 04): a 160° gradient, the accent from 28 % to 4 %. */
  shelfFrom: 0.28,
  shelfTo: 0.04,
  /** A Shelf tile's 1 pt line: the ground's text at 10 %. */
  tileLine: 0.1,
});

export type CompanionColours = {
  readonly headerLine: string;
  readonly bubbleLine: string;
  readonly fieldLine: string;
  readonly divider: string;
  readonly accentLine: string;
  readonly spinnerTrack: string;
  readonly failedFill: string;
  readonly failedLine: string;
  readonly reportGradient: readonly [string, string];
  readonly paperRule: string;
  readonly paperBar: string;
  readonly shelfGradient: readonly [string, string];
  readonly tileLine: string;
};

type CompanionSource = Pick<PlayVars, 'groundText' | 'accent' | 'error' | 'sheetBg' | 'sheetText'>;

function build(vars: CompanionSource): CompanionColours {
  const a = COMPANION_ALPHAS;
  return Object.freeze({
    headerLine: rgba(vars.groundText, a.headerLine),
    bubbleLine: rgba(vars.groundText, a.bubbleLine),
    fieldLine: rgba(vars.groundText, a.fieldLine),
    divider: rgba(vars.groundText, a.divider),
    accentLine: rgba(vars.accent, a.accentLine),
    spinnerTrack: rgba(vars.accent, a.spinnerTrack),
    failedFill: rgba(vars.error, a.failedFill),
    failedLine: rgba(vars.error, a.failedLine),
    reportGradient: Object.freeze([
      rgba(vars.accent, a.reportFrom),
      rgba(vars.accent, a.reportTo),
    ] as const),
    paperRule: mixHex(vars.sheetBg, vars.sheetText, a.paperRule),
    paperBar: mixHex(vars.sheetBg, vars.sheetText, a.paperBar),
    shelfGradient: Object.freeze([
      rgba(vars.accent, a.shelfFrom),
      rgba(vars.accent, a.shelfTo),
    ] as const),
    tileLine: rgba(vars.groundText, a.tileLine),
  });
}

/** The Companion's derived colours for a look's variables, once per variables object. */
export const companionColours: (vars: CompanionSource) => CompanionColours = oncePerObject(build);
