// The colours the edge screens (src/styles/edges, Ember 07-09, US-017f) derive beyond the ones a
// style carries, built with the vendored rgba and mixHex as tokens/companion-colours.ts builds its
// own, so every colour Not running, Something went wrong and Lost paint comes from this directory
// (D-TOKENS): the snag card's 1 pt error line at 0.4, Lost's '404' (the ground mixed toward the
// text at 0.1) and Not running's command box — Ember's #080706 on Graphite, the ground shaded
// toward black on Play's and HUD's dark grounds and the raised surface everywhere else, under a
// 1 pt line of the text at 0.16.

import { mixHex } from '../../core/web/lib/look-kit/contrast';
import { rgba } from '../../core/web/lib/look-kit/css';

/** Ember's alphas and mixes, each named for what it paints. */
export const EDGE_ALPHAS = Object.freeze({
  /** The snag card's 1 pt line: the error at 40 %. */
  snagLine: 0.4,
  /** Lost's '404': the ground mixed 10 % toward the text (Ember's #2A2420 on Graphite). */
  lostNumber: 0.1,
  /** The command box's 1 pt line: the text at 16 %. */
  commandLine: 0.16,
  /** The command box on a dark ground: the ground this far toward black (Ember's #080706). */
  commandShade: 0.58,
});

/** What the command box shades a dark ground toward. */
const SHADE = '#000000';

export type EdgeColourSource = {
  /** The screen's ground and its text, as #RRGGBB. */
  readonly ground: string;
  readonly text: string;
  /** A raised surface: the command box where the ground is not shaded. */
  readonly surface: string;
  readonly error: string;
  /** Shade the command box below the ground (Play's and HUD's dark grounds), else the surface. */
  readonly shade: boolean;
};

export type EdgeColours = {
  readonly snagLine: string;
  readonly lostNumber: string;
  readonly commandFill: string;
  readonly commandLine: string;
};

/** The edge screens' derived colours for a style's ground (edges/paint.ts keeps one per style). */
export function edgeColours(source: EdgeColourSource): EdgeColours {
  const a = EDGE_ALPHAS;
  return Object.freeze({
    snagLine: rgba(source.error, a.snagLine),
    lostNumber: mixHex(source.ground, source.text, a.lostNumber),
    commandFill: source.shade ? mixHex(source.ground, SHADE, a.commandShade) : source.surface,
    commandLine: rgba(source.text, a.commandLine),
  });
}
