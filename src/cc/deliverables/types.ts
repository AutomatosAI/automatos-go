// A Deliverable's type as a person reads it, pure: the web's artwork labels (deliverable-icon.tsx
// DELIVERABLE_ACCENTS) plus the server's other artifact types (audio, archive), one word for a card
// and one for a filter, and the kind of icon a card draws. A type this version does not know keeps
// its own words ('slide_deck' → 'Slide deck') and the plain file icon; a blank one is a File.

import { DELIVERABLES_COPY } from '../strings';

/** The web's order (DELIVERABLE_TYPES), then the server's other two: how the filters line up. */
export const KNOWN_TYPES = [
  'report',
  'image',
  'document',
  'code',
  'slide',
  'spreadsheet',
  'blog_post',
  'video',
  'audio',
  'archive',
] as const;

export type KnownType = (typeof KNOWN_TYPES)[number];

/** What a card's icon shows: a known type's own, or the plain file. */
export type DeliverableKind = KnownType | 'file';

const KNOWN: ReadonlySet<string> = new Set(KNOWN_TYPES);

function isKnownType(type: string): type is KnownType {
  return KNOWN.has(type);
}

function clean(type: string | null | undefined): string {
  return (type ?? '').trim();
}

/** 'slide_deck' → 'Slide deck': an unknown type's own words. */
function ownWords(type: string): string {
  const words = type.replace(/[_-]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : '';
}

export function kindOf(type: string | null | undefined): DeliverableKind {
  const value = clean(type);
  return isKnownType(value) ? value : 'file';
}

/** The type on a card: 'Report', 'Spreadsheet'; null when the server sent none. */
export function typeWord(type: string | null | undefined): string | null {
  const value = clean(type);
  if (!value) return null;
  return isKnownType(value) ? DELIVERABLES_COPY.types[value].one : ownWords(value) || null;
}

/** The type on its filter: 'Reports', 'Spreadsheets'; a blank one is 'File'. */
export function typePlural(type: string): string {
  const value = clean(type);
  if (isKnownType(value)) return DELIVERABLES_COPY.types[value].other;
  return ownWords(value) || DELIVERABLES_COPY.file;
}

function rank(type: string): number {
  const index = (KNOWN_TYPES as readonly string[]).indexOf(type);
  return index === -1 ? KNOWN_TYPES.length : index;
}

/** Each type once, blanks dropped: the known ones in the web's order, then the rest A to Z. */
export function sortTypes(types: Iterable<string>): string[] {
  const unique = [...new Set([...types].map(clean).filter(Boolean))];
  return unique.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
