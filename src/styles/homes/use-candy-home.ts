// Candy's home in React (US-023g): the wiring candy-home.ts and candy/home/today.ts decide for. The
// shell holds what ArcadeHome holds — A2's one thread (useHomeThread), needs-you's one answer
// (useNeedsYou), the header menu (useHomeMenu, D73) — plus the view on screen, switched in place;
// Today reads the Board through the query the Command Centre shell already makes (boardQuery: no
// new endpoint, no fetch outside src/api) and opens a Needs you row as Studio's strip does
// (useFollowLink), its times re-read at the turn of each minute (the shell's useMinuteClock).
// The voice (useCandyHomeVoice) and Report this (useMessageReport) are called by CandyHome itself,
// as ArcadeHome calls them: the R15 / D15 store audit reads the file that runs each.

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNeedsYou, type NeedsYouView } from '../../api/needs-you';
import { useApiClient } from '../../app-state/session';
import { boardQuery } from '../../cc/board/api';
import { useMinuteClock } from '../../cc/shell/use-shell';
import { useFollowLink, type FollowLink } from '../../chat/components/follow-link';
import { menuHere } from '../../chat/home/menu';
import { needsStrip } from '../../chat/home/needs-strip';
import { useHomeMenu, type HomeMenuState } from '../../chat/home/use-home-menu';
import {
  figureOf,
  greetingFor,
  needRows,
  needsLine,
  statCards,
  todayCounts,
  type NeedRow,
  type StatCard,
} from '../candy/home/today';
import { tabBarMetrics, tabBarSpace, type CandyTab } from '../candy/parts/tab-bar';
import { openingView, tabAction, type CandyView } from './candy-home';
import { useHomeThread, type HomeThread } from './use-home-thread';

/** Between the raised voice and the window over it, and under a view's last row. */
const ROOM = Object.freeze({ window: 8, foot: 16 });

export type CandyViews = {
  readonly view: CandyView;
  /** A tab's tap: its view in place. */
  readonly select: (tab: CandyTab) => void;
  readonly showToday: () => void;
  readonly showChat: () => void;
};

/** The view on screen: the one the route opens first, then whichever tab is tapped. */
export function useCandyViews(asked?: CandyView): CandyViews {
  const pathname = usePathname();
  const [view, setView] = useState<CandyView>(() => openingView(pathname, asked));
  const select = useCallback((tab: CandyTab) => {
    setView((current) => {
      const action = tabAction(tab, current);
      return action.kind === 'view' ? action.view : current;
    });
  }, []);
  const showToday = useCallback(() => setView('today'), []);
  const showChat = useCallback(() => setView('chat'), []);
  return { view, select, showToday, showChat };
}

export type CandyToday = {
  readonly greeting: string;
  /** '3 things need you'; null until needs-you has answered. */
  readonly needsLine: string | null;
  /** The orb's figure: needs-you's total, '—' until it has answered. */
  readonly figure: string;
  readonly cards: readonly StatCard[];
  readonly rows: readonly NeedRow[];
  readonly openRow: FollowLink;
};

/** P1 Today's words and numbers, from needs-you's answer and the Board's query. */
export function useToday(needsYou: NeedsYouView): CandyToday {
  const client = useApiClient();
  const board = useQuery(boardQuery(client)).data?.tasks ?? null;
  const now = useMinuteClock();
  const openRow = useFollowLink();
  const answered = needsYou.query.data !== undefined;
  const needs = answered ? needsYou.total : null;
  const { total, rows } = needsYou;
  const strip = useMemo(() => needsStrip({ total, rows }), [total, rows]);
  return useMemo(
    () => ({
      greeting: greetingFor(now.getHours()),
      needsLine: needsLine(needs),
      figure: figureOf(needs),
      cards: statCards(todayCounts({ needs, board })),
      rows: needRows(strip, now.getTime()),
      openRow,
    }),
    [now, needs, board, strip, openRow],
  );
}

export type TabBarRoom = {
  /** A view's foot padding: the tab bar, its raised voice and the bottom inset, and a gap. */
  readonly foot: number;
  /** The voice window's distance from the screen's foot: over the tab bar and its voice. */
  readonly window: number;
};

/** The room the floating tab bar takes at this text size (tab-bar.ts tabBarSpace). */
export function useTabBarRoom(): TabBarRoom {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const space = tabBarSpace(tabBarMetrics(fontScale, width), insets.bottom);
  return { foot: space + ROOM.foot, window: space + ROOM.window };
}

export type CandyShell = {
  readonly home: HomeThread;
  readonly needsYou: NeedsYouView;
  readonly menu: HomeMenuState;
  readonly views: CandyViews;
  readonly today: CandyToday;
};

/** The home's thread, needs-you, the menu, the view on screen and Today's numbers. */
export function useCandyHome(
  chatId: string | null,
  ticketId: string | null,
  asked?: CandyView,
): CandyShell {
  const home = useHomeThread(chatId, ticketId);
  const needsYou = useNeedsYou();
  const menu = useHomeMenu(menuHere(home.thread.state, ticketId));
  const views = useCandyViews(asked);
  const today = useToday(needsYou);
  return { home, needsYou, menu, views, today };
}
