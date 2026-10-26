// The paint and touch helpers every primitive shares, pure: a token key to its colour, a token at
// an alpha (the web's var(--x) with an alpha, which React Native has no syntax for), the 44 pt
// touch target as hitSlop, and accessibility labels joined from their parts. A touch never lands
// outside the parent's box, hitSlop or not (React Native's own note), and a ScrollView clips: where
// a control's slop would cross its parent's edge, touchRoom makes the room, and where controls
// stack a few points apart, stackedSlop keeps two slops from overlapping.

import type { ColourName, Colours } from '../styles/tokens';

/** A colour token, or no paint at all. */
export type ColourKey = ColourName | 'transparent';

export function paint(colours: Colours, key: ColourKey): string {
  return key === 'transparent' ? 'transparent' : colours[key];
}

const HEX = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/;
const ALPHA_MAX = 255;

/** A token colour at an alpha (the web's var(--x) / a); an alpha the token has multiplies. */
export function tint(hex: string, alpha: number): string {
  const match = HEX.exec(hex);
  if (!match) throw new RangeError(`${hex} isn't a #RRGGBB or #RRGGBBAA token colour`);
  if (!(alpha >= 0 && alpha <= 1)) throw new RangeError(`${alpha} isn't an alpha from 0 to 1`);
  const own = match[2] === undefined ? 1 : parseInt(match[2], 16) / ALPHA_MAX;
  const byte = Math.round(alpha * own * ALPHA_MAX)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `#${match[1]}${byte}`;
}

/** Apple's minimum touch target, in points; smaller controls make it up with hitSlop. */
export const MIN_TOUCH = 44;
export const DISABLED_OPACITY = 0.5;
export const ICON_STROKE = 2;

export type HitSlop = {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
};

/** The slop that grows a control of this size to MIN_TOUCH each way (none when it is already). */
export function hitSlopFor(height: number, width: number = MIN_TOUCH): HitSlop {
  const vertical = Math.max(0, Math.ceil((MIN_TOUCH - height) / 2));
  const horizontal = Math.max(0, Math.ceil((MIN_TOUCH - width) / 2));
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
}

export type TouchRoom = { readonly paddingVertical: number; readonly marginVertical: number };

/**
 * Room for a row of controls this tall to take the 44 pt touch inside a parent that would cut
 * their slop off: padding that makes the row 44 tall (its slop now inside it) and the same margin
 * taken back, so the row still takes its drawn height and nothing moves.
 */
export function touchRoom(height: number): TouchRoom {
  const { top } = hitSlopFor(height);
  return { paddingVertical: top, marginVertical: 0 - top };
}

/** Whether the control above and the one below are controls too. */
export type StackedNeighbours = { readonly above: boolean; readonly below: boolean };

/**
 * The slop for one of a column of small controls `gap` apart: toward 44 pt, but only half the gap
 * toward a neighbour that is a control too, so a touch between two never reaches the wrong one.
 */
export function stackedSlop(height: number, gap: number, neighbours: StackedNeighbours): HitSlop {
  const { top } = hitSlopFor(height);
  const shared = Math.min(top, Math.max(0, Math.floor(gap / 2)));
  return {
    top: neighbours.above ? shared : top,
    bottom: neighbours.below ? shared : top,
    left: 0,
    right: 0,
  };
}

/** Parts of an accessibility label, empty ones dropped: 'Blocked, 3'. */
export function joinLabel(...parts: readonly (string | number | null | undefined)[]): string {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== '')
    .join(', ');
}
