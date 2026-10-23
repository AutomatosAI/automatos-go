// The shell's hooks: they read the clock, the phone's timezone, the board, the week's calendar and
// the server's needs-you answer, and hand them to the pure modules beside them (dateline.ts,
// lede.ts, tabs.ts). The board and the calendar are their tabs' own queries (one cache entry each);
// needs-you is the foundation's useNeedsYou, so the lede's number and the Board tab's figure are the
// header menu's (its button and its Command Centre row, D73).
// No stream is opened here (D-LIVE).

import { useQuery } from '@tanstack/react-query';
import { useCalendars } from 'expo-localization';
import { usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { useNeedsYou } from '../../api/needs-you';
import { useApiClient } from '../../app-state/session';
import { boardQuery } from '../board/api';
import { scheduleQuery } from '../calendar/api';
import { todayCount } from '../calendar/view-model';
import { eyebrowText, msUntilNextMinute, wallClock, zoneCity } from './dateline';
import { boardFigures, ledeParts, tabCounts, type LedePart } from './lede';
import { shellTab, type CcTab, type TabCounts } from './tabs';

/** Now, re-read at the turn of every minute while the shell is mounted. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setTimeout(() => setNow(new Date()), msUntilNextMinute(now));
    return () => clearTimeout(timer);
  }, [now]);
  return now;
}

/** The phone's IANA timezone (expo-localization), or null when it reports none. */
export function usePhoneTimeZone(): string | null {
  const [calendar] = useCalendars();
  return calendar?.timeZone ?? null;
}

/** 'Operations · Mon 19 Oct · 08:14 London', in the phone's timezone. */
export function useEyebrow(): string {
  const now = useMinuteClock();
  const zone = usePhoneTimeZone();
  return eyebrowText(wallClock(now, zone), zoneCity(zone));
}

export type ShellFigures = {
  readonly lede: readonly LedePart[];
  readonly counts: TabCounts;
};

/** How many rows today has on the Calendar, in the phone's timezone; null before it has answered. */
function useCalendarToday(): number | null {
  const client = useApiClient();
  const items = useQuery(scheduleQuery(client)).data?.scheduled ?? null;
  const now = useMinuteClock();
  const timeZone = usePhoneTimeZone();
  return useMemo(
    () => (items ? todayCount({ items, now, timeZone }) : null),
    [items, now, timeZone],
  );
}

/** The lede and the tab figures; a source that has not answered yet shows nothing of its own. */
export function useShellFigures(): ShellFigures {
  const client = useApiClient();
  const board = useQuery(boardQuery(client)).data?.tasks ?? null;
  const needsYou = useNeedsYou().query.data ?? null;
  const calendarToday = useCalendarToday();
  return {
    lede: ledeParts({
      figures: board ? boardFigures(board) : null,
      needsTotal: needsYou ? needsYou.total : null,
    }),
    counts: tabCounts({ needsYou, calendarToday }),
  };
}

/**
 * The tab the shell shows; a sheet or detail opened over a tab keeps that tab. The shell mounts with
 * its stack, so a detail it first sees (opened from chat, the needs strip) has no tab under it: null.
 */
export function useShellTab(): CcTab | null {
  const pathname = usePathname();
  const [shown, setShown] = useState(() => shellTab(pathname));
  const tab = shellTab(pathname, shown);
  if (tab !== shown) setShown(tab);
  return tab;
}
