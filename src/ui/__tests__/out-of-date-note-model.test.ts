// OutOfDateNote on an iPhone (vitest runs no React Native renderer, so the decision is pure and the
// wiring is read from the source): iOS has no live regions, so VoiceOver is told the note's words
// once, when it appears; Android's live region speaks for itself.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { noteAnnouncement } from '../out-of-date-note-model';

const WORDS = 'Showing what was here last time.';
const SOURCE = readFileSync(path.resolve(__dirname, '../OutOfDateNote.tsx'), 'utf8');

describe('what VoiceOver is told when the out-of-date note appears', () => {
  it('the words, on iOS, the first time', () => {
    expect(noteAnnouncement('ios', WORDS, false)).toBe(WORDS);
  });

  it('nothing the second time: it is said once', () => {
    expect(noteAnnouncement('ios', WORDS, true)).toBeNull();
  });

  it.each(['android', 'web', 'windows', 'macos'] as const)(
    'nothing on %s: its live region, if any, speaks',
    (platform) => {
      expect(noteAnnouncement(platform, WORDS, false)).toBeNull();
    },
  );

  it('nothing for a blank line, so a later line with words is still announced', () => {
    expect(noteAnnouncement('ios', '  ', false)).toBeNull();
    expect(noteAnnouncement('ios', WORDS, false)).toBe(WORDS);
  });
});

describe('the note wires the decision as the toast does', () => {
  it('announces through AccessibilityInfo with Platform.OS, remembering it has', () => {
    expect(SOURCE).toContain('noteAnnouncement(Platform.OS, words, announced.current)');
    expect(SOURCE).toContain('AccessibilityInfo.announceForAccessibility(line)');
    expect(SOURCE).toMatch(/announced\.current = true;\s+AccessibilityInfo\.announceForAccessibility/);
  });

  it('keeps the live region for TalkBack', () => {
    expect(SOURCE).toContain('accessibilityLiveRegion="polite"');
  });
});
