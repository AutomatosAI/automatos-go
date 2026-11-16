// The settings Section and its note, pure and from source: the gaps and levels every copy of a
// titled group drew before it moved here (Settings → Notifications, Voice, Account's server,
// Readiness with its count, the consent sheet's providers), and the note that draws nothing
// without words.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  SECTION_ASIDE_GAP,
  SECTION_GAP,
  SECTION_NOTE_LEVEL,
  sectionHead,
  sectionNote,
} from '../section-model';

const read = (file: string) => readFileSync(path.resolve(__dirname, '..', file), 'utf8');

describe('a section', () => {
  it('keeps 12 pt (space3) between its head, its card and its lines', () => {
    expect(SECTION_GAP).toBe('space3');
  });

  it('puts a count beside the title, space3 across and space1 down once it wraps', () => {
    expect(SECTION_ASIDE_GAP).toEqual({ column: 'space3', row: 'space1' });
    expect(sectionHead(undefined)).toBe('title');
    expect(sectionHead('')).toBe('title');
    expect(sectionHead('3 of 5 ready')).toBe('title-and-aside');
  });

  it('heads in the eyebrow, heard as a header (read from source)', () => {
    expect(read('Section.tsx')).toMatch(/variant="eyebrow"\s+accessibilityRole="header"/);
  });
});

describe('a section note', () => {
  it('is Body 6, muted, and nothing without words', () => {
    expect(SECTION_NOTE_LEVEL).toBe(6);
    expect(sectionNote('In this phone’s time zone.')).toBe('In this phone’s time zone.');
    expect([sectionNote(''), sectionNote(null), sectionNote(undefined)]).toEqual([
      null,
      null,
      null,
    ]);
    expect(read('SectionNote.tsx')).toMatch(/level=\{SECTION_NOTE_LEVEL\} tone="muted"/);
  });
});
