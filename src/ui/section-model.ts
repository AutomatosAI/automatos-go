// The settings Section's logic, pure: a titled group of rows is its title as an eyebrow header,
// then its card and lines, 12 pt apart (space3); a section that counts its rows ('3 of 5 ready')
// shows the count beside the title, the title wrapping first. The muted line under a section
// (whose switches these are, which time zone) is Body 6, and a section without one draws nothing.

import type { SpaceName } from '../styles/tokens';
import type { TextLevel } from './variants';

/** Between the head, the card and the lines under it. */
export const SECTION_GAP: SpaceName = 'space3';
/** Between the title and the word beside it, across and, once it wraps, down. */
export const SECTION_ASIDE_GAP = Object.freeze({
  column: 'space3',
  row: 'space1',
} satisfies Record<string, SpaceName>);
export const SECTION_NOTE_LEVEL: TextLevel = 6;

/** A section's note, or null where it has no words (nothing is drawn). */
export function sectionNote(text: string | null | undefined): string | null {
  return text ? text : null;
}

/** Whether the head is the title alone or the title with a word beside it. */
export function sectionHead(aside: string | undefined): 'title' | 'title-and-aside' {
  return aside ? 'title-and-aside' : 'title';
}
