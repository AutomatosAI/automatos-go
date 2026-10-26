// What Play's Companion pieces are painted with, pure: Ember's colours as the look's variables
// (the kit's mapping: cream → groundText, #B7ADA4 → groundText2, #8A8077 → text3, the look's faded
// meta text --fg-3; molten → accent, #FF8A3D / #FFB070 → accentText, hearth → groundSurface) and
// the lines tokens/companion-colours.ts derives. No colour is written here: each is a token.

import type { LineTone } from '../../../core/frozen/components/play/chat/labels';
import type { CompanionColours } from '../../tokens/companion-colours';
import type { PlayVars } from '../../tokens/play';
import type { BadgeTone, ComposerView } from './model';

/** Everything a Companion piece paints from: the look's variables, its lines and its text-3. */
export type CompanionColourSource = {
  readonly vars: PlayVars;
  readonly lines: CompanionColours;
  /** Ember's text-3: the look's faded meta text. */
  readonly text3: string;
};

export type ChipPaint = {
  readonly fill: string;
  /** The 1 pt line; null where Ember draws none (done, muted). */
  readonly line: string | null;
  readonly ink: string;
  /** The mark's own colour (failed's ✕ in the error). */
  readonly markInk: string;
  readonly spinner: boolean;
};

/**
 * running: the accent fill, a 1 pt accent line at 0.4 and the spinner; waiting the same tint with
 * its '…'; done the ground's chip with text2; failed the error at 0.1 with its line at 0.45 and
 * '✕' in the error; muted (skipped, stopped) the chip with text-3.
 */
export function chipPaint(kind: LineTone, source: CompanionColourSource): ChipPaint {
  const { vars, lines, text3 } = source;
  switch (kind) {
    case 'running':
    case 'waiting':
      return {
        fill: vars.accentFill,
        line: lines.accentLine,
        ink: vars.accentText,
        markInk: vars.accentText,
        spinner: kind === 'running',
      };
    case 'failed':
      return {
        fill: lines.failedFill,
        line: lines.failedLine,
        ink: vars.errorText,
        markInk: vars.error,
        spinner: false,
      };
    case 'done':
      return {
        fill: vars.groundChip,
        line: null,
        ink: vars.groundText2,
        markInk: vars.groundText2,
        spinner: false,
      };
    case 'muted':
      return { fill: vars.groundChip, line: null, ink: text3, markInk: text3, spinner: false };
  }
}

/** A receipt's badge: Done in the accent text, Not done in the error text, Skipped faded. */
export function badgeInk(tone: BadgeTone, source: CompanionColourSource): string {
  if (tone === 'accent') return source.vars.accentText;
  if (tone === 'error') return source.vars.errorText;
  return source.text3;
}

export type ComposerButtonPaint = { readonly fill: string; readonly ink: string };

/** Send and Stop: the ground's text with the ground as ink; the accent with its ink on First open. */
export function composerButtonPaint(
  view: Pick<ComposerView, 'fill'>,
  source: CompanionColourSource,
): ComposerButtonPaint {
  const { vars } = source;
  return view.fill === 'accent'
    ? { fill: vars.accent, ink: vars.accentInk }
    : { fill: vars.groundText, ink: vars.groundBg };
}
