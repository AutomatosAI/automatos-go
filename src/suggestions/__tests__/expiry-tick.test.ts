// A suggestion past its expiry leaves on the next minute's turn with the list unchanged (rule 6.5:
// its Start would be refused). The decision is shownSuggestions (model.ts: the list and the time
// in, what is shown out); useOpenSuggestions hands it the minute clock's time (useMinuteClock, as
// the approval sheet and the calendar judge theirs), so each turn of the minute judges the same
// list again. Ticks here are the clock's own (dateline.ts msUntilNextMinute).

import { describe, expect, it } from 'vitest';

import { readRepoFile } from '../../release/__tests__/support/tree';
import { msUntilNextMinute } from '../../cc/shell/dateline';
import { shownSuggestions } from '../model';
import type { Suggestion } from '../schema';
import { suggestion } from './fixtures';

/** The minute clock's next reading after `at`. */
const nextTick = (at: number): number => at + msUntilNextMinute(new Date(at));

const SHOWN_AT = Date.parse('2026-10-28T08:59:10Z');
/** Between two ticks: still shown at 09:00, gone at 09:01. */
const EXPIRES_AT = '2026-10-28T09:00:30Z';

const shownAt = (list: readonly Suggestion[], now: number) =>
  shownSuggestions({ offered: true, paused: false, list, now }).map((each) => each.id);

describe('an expired suggestion leaves on the next tick, with the list unchanged', () => {
  it('the same list, judged at each turn of the minute, loses it once its time has passed', () => {
    const list = Object.freeze([
      suggestion('lapsing', { expires_at: EXPIRES_AT }),
      suggestion('lasting', { expires_at: null }),
    ]);
    const first = nextTick(SHOWN_AT);
    const second = nextTick(first);
    expect(shownAt(list, SHOWN_AT)).toEqual(['lapsing', 'lasting']);
    expect(shownAt(list, first)).toEqual(['lapsing', 'lasting']);
    expect(second).toBeGreaterThan(Date.parse(EXPIRES_AT));
    expect(shownAt(list, second)).toEqual(['lasting']);
  });

  it('the last one leaving leaves none, so no surface offers a Start', () => {
    const list = Object.freeze([suggestion('only', { expires_at: EXPIRES_AT })]);
    expect(shownAt(list, nextTick(nextTick(SHOWN_AT)))).toEqual([]);
  });
});

describe('useOpenSuggestions judges at the minute clock’s time', () => {
  const source = readRepoFile('src/suggestions/use-suggestions.ts');

  it('reads the minute clock, never a time taken once', () => {
    expect(source).toContain("import { useMinuteClock } from '../cc/shell/use-shell';");
    expect(source).toContain('const now = useMinuteClock().getTime();');
    expect(source).not.toContain('Date.now()');
  });

  it('judges again when the minute turns, whether or not the list changed', () => {
    expect(source).toContain('shownSuggestions({ offered, paused, list: data, now })');
    expect(source).toContain('[offered, paused, data, now],');
  });
});
