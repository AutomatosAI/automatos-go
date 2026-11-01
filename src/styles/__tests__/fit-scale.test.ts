// A one-line header title that shrinks to fit beside its buttons (Text's `fit`): how far it may
// shrink, never below the 11 pt minimum (D38), and the two headers that use it. The wide Arcade
// face cut 'Conversations' and 'Notifications' short beside New chat and Mark all read.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { FIT_FLOOR, MIN_TEXT_SIZE, fitScale } from '../type';

const read = (file: string) =>
  readFileSync(path.resolve(__dirname, '..', '..', '..', file), 'utf8');

describe('fitScale', () => {
  it('shrinks a large title as far as the floor', () => {
    expect(fitScale(28)).toBe(FIT_FLOOR);
    expect(fitScale(22)).toBe(FIT_FLOOR);
  });

  it('never takes a title below the minimum size', () => {
    for (const size of [12, 13, 14, 15, 15.7, 16, 18, 21, 23, 28, 40]) {
      expect(size * fitScale(size)).toBeGreaterThanOrEqual(MIN_TEXT_SIZE - 1e-9);
    }
    expect(fitScale(15)).toBeCloseTo(MIN_TEXT_SIZE / 15);
  });

  it('leaves a face at or under the minimum, or with no size, at its size', () => {
    expect(fitScale(MIN_TEXT_SIZE)).toBe(1);
    expect(fitScale(9)).toBe(1);
    expect(fitScale(undefined)).toBe(1);
  });
});

describe('Text’s fit', () => {
  const text = read('src/ui/Text.tsx');

  it('is one line that shrinks to fit, from the face’s own size', () => {
    expect(text).toMatch(
      /numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: fitScale\(face\.fontSize\)/,
    );
  });

  it('keeps Dynamic Type on: the scaling props come after the fit', () => {
    expect(text).toMatch(/\{\.\.\.rest\} \{\.\.\.fitted\} \{\.\.\.TEXT_SCALING\}/);
  });

  it.each(['src/chat/history/ChatsHeader.tsx', 'src/push/inbox/InboxHeader.tsx'])(
    '%s fits its title rather than cutting it short',
    (file) => {
      const source = read(file);
      expect(source).toMatch(/accessibilityRole="header"\s+fit\s+style=\{styles\.title\}/);
      expect(source).not.toMatch(/numberOfLines=\{1\}/);
    },
  );
});
