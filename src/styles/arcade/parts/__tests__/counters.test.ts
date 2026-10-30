// The status bar's counters (counters.ts; the kit's frame/today.tsx; D-ARC-6): XP, ! and QUEST as
// game words and numbers in their game colours, each said in words for VoiceOver, and a counter the
// home cannot know left out rather than shown as 0.

import { describe, expect, it } from 'vitest';

import { COUNTER_TONES, statusCounters } from '../counters';

describe('the counters', () => {
  it('show XP, ! and QUEST in that order, each a game word, a number and words', () => {
    expect(statusCounters({ xp: 3, needs: 2, quest: 4 })).toEqual([
      { key: 'xp', game: 'XP', value: '3', label: '3 done today', tone: 'xp' },
      { key: 'needs', game: '!', value: '2', label: '2 need you', tone: 'qs' },
      { key: 'quest', game: 'QUEST', value: '4', label: '4 in progress', tone: 'mp' },
    ]);
  });

  it('leave out a counter given null, never showing it as 0', () => {
    const shown = statusCounters({ xp: null, needs: 0, quest: 5 });
    expect(shown.map((counter) => counter.key)).toEqual(['needs', 'quest']);
    expect(shown[0]).toMatchObject({ value: '0', label: '0 need you' });
    expect(statusCounters({ xp: null, needs: null, quest: null })).toEqual([]);
  });

  it('say one thing that needs you in the singular', () => {
    expect(statusCounters({ xp: 1, needs: 1, quest: 1 }).map((counter) => counter.label)).toEqual([
      '1 done today',
      '1 needs you',
      '1 in progress',
    ]);
  });

  it('show whole, non-negative numbers, and leave out one that is not a number', () => {
    const shown = statusCounters({ xp: 2.7, needs: -1, quest: Number.NaN });
    expect(shown.map((counter) => counter.value)).toEqual(['2', '0']);
  });

  it('paint XP gold, ! quest yellow and QUEST mana blue (README Game colours)', () => {
    expect(COUNTER_TONES).toEqual({ xp: 'xp', needs: 'qs', quest: 'mp' });
  });
});
