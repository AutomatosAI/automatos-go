// when.ts (US-023g, vendored from the kit's src/ui/when.ts at 3920359d5): times in Candy's words,
// read in the phone's own time (every date here is built in local time, so the test holds in any
// timezone).

import { describe, expect, it } from 'vitest';

import { agoWords, aheadWords, dayWords, shortWhen } from '../when';

const NOW = new Date(2026, 9, 31, 10, 30).getTime(); // Saturday 31 October, 10:30
const at = (...parts: [number, number, number, number?, number?]) => new Date(...parts).toISOString();

describe('how long ago (the Needs you rows)', () => {
  it('says Now, minutes and hours within the day', () => {
    expect(agoWords(at(2026, 9, 31, 10, 30), NOW)).toBe('Now');
    expect(agoWords(at(2026, 9, 31, 10, 18), NOW)).toBe('12 min ago');
    expect(agoWords(at(2026, 9, 31, 8, 15), NOW)).toBe('2 h ago');
  });

  it('then the day: Yesterday, a weekday up to five days back, else the date', () => {
    expect(agoWords(at(2026, 9, 30, 23, 0), NOW)).toBe('Yesterday');
    expect(agoWords(at(2026, 9, 26, 9, 0), NOW)).toBe('Mon');
    expect(agoWords(at(2026, 9, 24, 9, 0), NOW)).toBe('Oct 24');
  });

  it('is null for a time it cannot read', () => {
    expect(agoWords(null, NOW)).toBeNull();
    expect(agoWords('not a time', NOW)).toBeNull();
  });
});

describe('the other forms', () => {
  it('shortens, names a past day, and a time ahead', () => {
    expect(shortWhen(at(2026, 9, 31, 10, 18), NOW)).toBe('12 min');
    expect(dayWords(at(2026, 9, 31, 7, 0), NOW)).toBe('Today');
    expect(aheadWords(at(2026, 9, 31, 16, 0), NOW)).toBe('16:00');
    expect(aheadWords(at(2026, 10, 1, 9, 0), NOW)).toBe('Tomorrow');
    expect(aheadWords(at(2026, 10, 3, 9, 0), NOW)).toBe('Tue');
    expect(aheadWords(at(2026, 10, 10, 9, 0), NOW)).toBe('Nov 10');
  });
});
