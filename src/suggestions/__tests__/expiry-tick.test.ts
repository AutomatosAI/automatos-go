// A suggestion past its expiry leaves on the next turn of the minute with the list unchanged (rule
// 6.5: its Start would be refused). The decision is model.ts's: shownSuggestions (the list and the
// time in, what is shown out) and createShownSelector, which each surface's useOpenSuggestions
// holds: it is asked at the time of each render, a render comes at each turn of the minute from
// the one shared clock (minute-ticker.ts), and it hands back the same array while what is shown has
// not changed. The one whose Start is out stays until the answer, and a refusal whose card has gone
// is said in the toast (refusalPlace). Ticks here are the clock's own (dateline.ts).

import { describe, expect, it } from 'vitest';

import { readRepoFile } from '../../release/__tests__/support/tree';
import { msUntilNextMinute } from '../../cc/shell/dateline';
import {
  createShownSelector,
  keptIfSame,
  refusalPlace,
  shownSuggestions,
  type ShownInput,
} from '../model';
import type { Suggestion } from '../schema';
import { suggestion } from './fixtures';

/** The minute clock's next reading after `at`. */
const nextTick = (at: number): number => at + msUntilNextMinute(new Date(at));

const SHOWN_AT = Date.parse('2026-10-28T08:59:10Z');
/** Between two ticks: still shown at 09:00, gone at 09:01. */
const EXPIRES_AT = '2026-10-28T09:00:30Z';
const FIRST_TICK = nextTick(SHOWN_AT);
const SECOND_TICK = nextTick(FIRST_TICK);

const LAPSING = suggestion('lapsing', { expires_at: EXPIRES_AT });
const LASTING = suggestion('lasting', { expires_at: null });

const input = (
  list: readonly Suggestion[],
  now: number,
  keep: string | null = null,
): ShownInput => ({
  offered: true,
  paused: false,
  list,
  now,
  keep,
});
const ids = (list: readonly Suggestion[]) => list.map((each) => each.id);

describe('an expired suggestion leaves on the next tick, with the list unchanged', () => {
  it('the same list, judged at each turn of the minute, loses it once its time has passed', () => {
    const list = Object.freeze([LAPSING, LASTING]);
    expect(ids(shownSuggestions(input(list, SHOWN_AT)))).toEqual(['lapsing', 'lasting']);
    expect(ids(shownSuggestions(input(list, FIRST_TICK)))).toEqual(['lapsing', 'lasting']);
    expect(SECOND_TICK).toBeGreaterThan(Date.parse(EXPIRES_AT));
    expect(ids(shownSuggestions(input(list, SECOND_TICK)))).toEqual(['lasting']);
  });

  it('the last one leaving leaves none, so no surface offers a Start', () => {
    expect(shownSuggestions(input([LAPSING], SECOND_TICK))).toEqual([]);
  });
});

describe('a surface’s shown list (createShownSelector)', () => {
  it('keeps its identity across a tick that expires nothing', () => {
    const select = createShownSelector();
    const list = Object.freeze([LAPSING, LASTING]);
    const first = select(input(list, SHOWN_AT));
    expect(select(input(list, FIRST_TICK))).toBe(first);
  });

  it('changes once when one expires, then keeps the new one', () => {
    const select = createShownSelector();
    const list = Object.freeze([LAPSING, LASTING]);
    const first = select(input(list, FIRST_TICK));
    const after = select(input(list, SECOND_TICK));
    expect(after).not.toBe(first);
    expect(ids(after)).toEqual(['lasting']);
    expect(select(input(list, nextTick(SECOND_TICK)))).toBe(after);
  });

  it('judges fresh data at its own time, never by the last tick', () => {
    const select = createShownSelector();
    select(input([LASTING], FIRST_TICK));
    // a list landing at 09:00:40, after the 09:00 tick, holding one that lapsed at 09:00:30
    const landedAt = Date.parse('2026-10-28T09:00:40Z');
    expect(ids(select(input([LAPSING, LASTING], landedAt)))).toEqual(['lasting']);
  });

  it('a suggestion the server changed (the same id, a new object) is a new list', () => {
    const changed = suggestion('lasting', { expires_at: null, title: 'Reworded' });
    const before = [LASTING];
    expect(keptIfSame(before, [changed])).toEqual([changed]);
    expect(keptIfSame(before, [LASTING])).toBe(before);
  });
});

describe('a Start out when its suggestion lapses', () => {
  it('keeps that one on screen until the answer, then lets it go', () => {
    const list = Object.freeze([LAPSING, LASTING]);
    expect(ids(shownSuggestions(input(list, SECOND_TICK, 'lapsing')))).toEqual([
      'lapsing',
      'lasting',
    ]);
    expect(ids(shownSuggestions(input(list, SECOND_TICK, null)))).toEqual(['lasting']);
  });

  it('never keeps one the server no longer calls open', () => {
    const started = suggestion('lapsing', { expires_at: EXPIRES_AT, status: 'started' });
    expect(shownSuggestions(input([started], SECOND_TICK, 'lapsing'))).toEqual([]);
  });

  it('says a refusal under the card while it is shown, in the toast once it has gone', () => {
    const list = [LAPSING, LASTING];
    expect(refusalPlace(list, 'lapsing', FIRST_TICK)).toBe('line');
    expect(refusalPlace(list, 'lapsing', SECOND_TICK)).toBe('toast');
    expect(refusalPlace([LASTING], 'lapsing', FIRST_TICK)).toBe('toast');
    expect(refusalPlace(undefined, 'lapsing', FIRST_TICK)).toBe('toast');
  });
});

describe('useOpenSuggestions', () => {
  const source = readRepoFile('src/suggestions/use-suggestions.ts');

  it('judges at the time of each render, with one clock for every surface', () => {
    expect(source).not.toContain('useMinuteClock');
    expect(source.match(/createMinuteTicker\(\)/g)).toHaveLength(1);
    expect(source).toContain(
      'useSyncExternalStore(SUGGESTION_MINUTES.subscribe, SUGGESTION_MINUTES.minute);\n  return Date.now();',
    );
  });

  it('hands every caller the selector’s kept list, keeping the one whose Start is out', () => {
    expect(source).toContain('const [select] = useState(createShownSelector);');
    expect(source).toContain('const keep = useStartingId();');
    expect(source).toContain('select({ offered, paused, list: query.data, now, keep })');
  });

  it('tells a refused Start through refusalPlace', () => {
    expect(source).toContain("if (refusalPlace(list, id, Date.now()) === 'line')");
    expect(source).toContain(
      'onError: (error: unknown, view) => tell(view.id, startRefusal(error)),',
    );
  });
});
