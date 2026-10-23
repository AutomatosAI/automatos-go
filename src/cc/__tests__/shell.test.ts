import { describe, expect, it } from 'vitest';

import { routes } from '../../navigation/routes';
import { tokensFor } from '../../styles/tokens';
import { MIN_TEXT_SIZE } from '../../styles/type';
import { LIVE_PULSE, ledeFigureFace, liveWord, tabPaint } from '../shell/chrome';
import { eyebrowText, localClock, msUntilNextMinute, wallClock, zoneCity } from '../shell/dateline';
import {
  BOARD_SCREEN,
  CC_TABS,
  TAB_HREFS,
  pressTab,
  shellTab,
  tabFor,
  tabViews,
  type CcTab,
  type TabCounts,
  type TabView,
} from '../shell/tabs';

const NO_COUNTS: TabCounts = { board: null, calendar: null, questions: null, deliverables: null };

/** The tab the shell shows after these paths, from its mount on the first (useShellTab's fold). */
function shownAfter([first, ...rest]: readonly string[]): CcTab | null {
  return rest.reduce<CcTab | null>((shown, path) => shellTab(path, shown), shellTab(first));
}

/** What tapping each tab does on the live path: the hrefs the router was asked to dismiss to. */
function taps(views: readonly TabView[]): Partial<Record<CcTab, readonly string[]>> {
  const entries = views.map((view) => {
    const calls: string[] = [];
    pressTab(view, { dismissTo: (href) => calls.push(href) });
    return [view.tab, calls] as const;
  });
  return Object.fromEntries(entries);
}

function selectedTabs(views: readonly TabView[]): CcTab[] {
  return views.filter((view) => view.selected).map((view) => view.tab);
}

describe('the tabs', () => {
  it('are Board, Calendar, Questions and Deliverables, at the foundation builders', () => {
    expect(CC_TABS).toEqual(['board', 'calendar', 'questions', 'deliverables']);
    expect(TAB_HREFS).toEqual({
      board: '/cc/board',
      calendar: routes.cc.calendar,
      questions: routes.cc.questions,
      deliverables: routes.cc.deliverables,
    });
    expect(BOARD_SCREEN.startsWith(routes.cc.board)).toBe(true);
  });

  it('reads the tab from the path: the Board at /cc and at its own screen', () => {
    expect(tabFor(routes.cc.board)).toBe('board');
    expect(tabFor(BOARD_SCREEN)).toBe('board');
    expect(tabFor('/cc/calendar')).toBe('calendar');
    expect(tabFor('/cc/questions/')).toBe('questions');
    expect(tabFor('/cc/deliverables?type=document')).toBe('deliverables');
  });

  it('a ticket, a post or a Deliverable is not a tab', () => {
    expect(tabFor(routes.cc.ticket(12))).toBeNull();
    expect(tabFor(routes.cc.social('p-1'))).toBeNull();
    expect(tabFor(routes.cc.deliverable('d-1'))).toBeNull();
    expect(tabFor(routes.home)).toBeNull();
  });

  it('keeps the tab a sheet or detail opened over; none under a detail it opened on', () => {
    expect(shellTab(routes.cc.ticket(12), 'questions')).toBe('questions');
    expect(shellTab(routes.cc.calendar, 'questions')).toBe('calendar');
    expect(shellTab(routes.cc.ticket(12))).toBeNull();
    expect(shellTab(routes.cc.deliverable('d-1'), null)).toBeNull();
  });

  it('shows a figure beside the word, none at 0 or unknown, 99+ past the cap', () => {
    const counts = { board: 2, calendar: 0, questions: 140, deliverables: null };
    const views = tabViews('questions', counts, routes.cc.questions);
    expect(views.map((view) => [view.word, view.count, view.selected])).toEqual([
      ['Board', '2', false],
      ['Calendar', null, false],
      ['Questions', '99+', true],
      ['Deliverables', null, false],
    ]);
    expect(views.map((view) => view.accessibilityLabel)).toEqual([
      'Board, 2',
      'Calendar',
      'Questions, 99+',
      'Deliverables',
    ]);
  });

  it('marks exactly one tab selected', () => {
    const views = tabViews('board', NO_COUNTS, BOARD_SCREEN);
    expect(selectedTabs(views)).toEqual(['board']);
  });
});

describe('the tab strip (P001X-SEAM-2)', () => {
  const fromChat = [routes.cc.deliverable('d-1'), routes.cc.ticket(2680)];

  it.each(fromChat)('a detail opened from chat (%s first) shows no tab selected', (path) => {
    const shown = shownAfter([path]);
    expect(shown).toBeNull();
    expect(selectedTabs(tabViews(shown, NO_COUNTS, path))).toEqual([]);
  });

  it.each(fromChat)('Board from a detail opened from chat (%s) reaches the Board', (path) => {
    const views = tabViews(shownAfter([path]), NO_COUNTS, path);
    expect(taps(views)).toEqual({
      board: [BOARD_SCREEN],
      calendar: [routes.cc.calendar],
      questions: [routes.cc.questions],
      deliverables: [routes.cc.deliverables],
    });
  });

  it('shows a tab once the detail opened from chat leaves for it', () => {
    expect(shownAfter([routes.cc.deliverable('d-1'), BOARD_SCREEN])).toBe('board');
    expect(shownAfter([routes.cc.ticket(7), routes.cc.questions, routes.cc.ticket(8)])).toBe(
      'questions',
    );
  });

  it('a ticket opened over Calendar still shows Calendar', () => {
    const path = routes.cc.ticket(12);
    const shown = shownAfter([routes.cc.calendar, path]);
    expect(shown).toBe('calendar');
    expect(selectedTabs(tabViews(shown, NO_COUNTS, path))).toEqual(['calendar']);
  });

  it('the tab under a detail goes back to its screen; the rest take the detail’s place', () => {
    const path = routes.cc.deliverable('d-1');
    const views = tabViews(shownAfter([routes.cc.deliverables, path]), NO_COUNTS, path);
    expect(selectedTabs(views)).toEqual(['deliverables']);
    expect(taps(views).deliverables).toEqual([routes.cc.deliverables]);
    expect(taps(views).board).toEqual([BOARD_SCREEN]);
  });

  it("tapping the focused tab's own screen does nothing", () => {
    const screens: readonly (readonly [CcTab, string])[] = [
      ['board', routes.cc.board],
      ['board', BOARD_SCREEN],
      ['calendar', routes.cc.calendar],
      ['questions', `${routes.cc.questions}/`],
      ['deliverables', `${routes.cc.deliverables}?type=document`],
    ];
    for (const [tab, path] of screens) {
      const views = tabViews(shownAfter([path]), NO_COUNTS, path);
      expect(selectedTabs(views)).toEqual([tab]);
      expect(views.find((view) => view.tab === tab)?.target).toBeNull();
      expect(taps(views)[tab]).toEqual([]);
    }
  });
});

describe('the eyebrow (phone timezone)', () => {
  // 07:14 UTC on Monday 19 October 2026
  const instant = new Date('2026-10-19T07:14:30Z');

  it("reads the handoff's line in London", () => {
    const zone = 'Europe/London';
    expect(eyebrowText(wallClock(instant, zone), zoneCity(zone))).toBe(
      'Operations · Mon 19 Oct · 08:14 London',
    );
  });

  it('is the same moment on another day in another zone', () => {
    const zone = 'America/Los_Angeles';
    expect(eyebrowText(wallClock(instant, zone), zoneCity(zone))).toBe(
      'Operations · Mon 19 Oct · 00:14 Los Angeles',
    );
    const late = new Date('2026-10-19T06:30:00Z');
    expect(eyebrowText(wallClock(late, zone), zoneCity(zone))).toBe(
      'Operations · Sun 18 Oct · 23:30 Los Angeles',
    );
  });

  it('crosses midnight forward in a zone ahead of UTC', () => {
    const zone = 'Asia/Tokyo';
    const clock = wallClock(new Date('2026-12-31T15:05:00Z'), zone);
    expect(clock).toEqual({ weekday: 5, day: 1, month: 0, hours: 0, minutes: 5 });
  });

  it('names the city from the zone, or the zone when it has none', () => {
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
    expect(zoneCity('UTC')).toBe('UTC');
    expect(zoneCity('Etc/GMT+5')).toBe('GMT+5');
    expect(zoneCity('  ')).toBeNull();
    expect(zoneCity(null)).toBeNull();
  });

  it("falls back to the phone's own clock with no zone or one the engine cannot read", () => {
    expect(wallClock(instant, null)).toEqual(localClock(instant));
    expect(wallClock(instant, 'Not/A_Zone')).toEqual(localClock(instant));
  });

  it('leaves the city off when there is none', () => {
    const clock = { weekday: 3, day: 7, month: 0, hours: 9, minutes: 5 };
    expect(eyebrowText(clock, null)).toBe('Operations · Wed 7 Jan · 09:05');
  });

  it('re-reads at the turn of the minute', () => {
    expect(msUntilNextMinute(new Date('2026-10-19T07:14:30.250Z'))).toBe(29_750);
    expect(msUntilNextMinute(new Date('2026-10-19T07:15:00.000Z'))).toBe(60_000);
  });
});

describe('the live word (D-LIVE)', () => {
  it('says every state: live, connecting and offline', () => {
    expect(liveWord('live', false)).toEqual({
      word: 'Streaming live',
      dot: 'ccLiveDot',
      tone: 'success',
      pulse: true,
    });
    expect(liveWord('connecting', false).word).toBe('Connecting');
    expect(liveWord('offline', false)).toMatchObject({ word: 'Offline', pulse: false });
  });

  it('only pulses while live, and never under Reduce Motion', () => {
    expect(liveWord('live', true).pulse).toBe(false);
    expect(liveWord('connecting', false).pulse).toBe(false);
    expect(LIVE_PULSE).toEqual({ periodMs: 2000, lowOpacity: 0.35, dotSize: 6 });
  });
});

describe('the shell paints (tokens only)', () => {
  const tokens = tokensFor('studio', 'light');

  it('draws the active tab in ink over the accent rule, the rest muted', () => {
    expect(tabPaint(tokens.colours, true)).toEqual({
      color: tokens.colours.foreground,
      rule: tokens.colours.accent,
    });
    expect(tabPaint(tokens.colours, false)).toEqual({
      color: tokens.colours.mutedForeground,
      rule: 'transparent',
    });
  });

  it("sets the lede's figures in the mono figure face, at no less than 11 pt", () => {
    expect(ledeFigureFace(tokens.type).fontFamily).toBe(tokens.type.figure3.fontFamily);
    expect(tokens.type.body3.fontSize).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
    expect(tokens.type.body4.fontSize).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
  });
});
