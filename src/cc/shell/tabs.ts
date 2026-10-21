// The Command Centre's four tabs (handoff §2 'Sticky tabs'), where each one lives and which one the
// shell shows. The paths are the foundation's builders (src/navigation/routes.ts, KX3): routes.cc.board
// ('/cc') is app/(app)/cc/index.tsx, which redirects to the Board's own screen (board.tsx), so the
// Board tab goes straight there. A path under the Command Centre that is not a tab (a ticket, a social
// post, a Deliverable) opens over the tab it came from, so the shell keeps that tab.

import { routes } from '../../navigation/routes';
import { badgeText } from '../../ui/variants';
import { joinLabel } from '../../ui/paint';
import { SHELL_COPY } from '../strings';

export const CC_TABS = ['board', 'calendar', 'questions', 'deliverables'] as const;
export type CcTab = (typeof CC_TABS)[number];

/** The Board's screen file, app/(app)/cc/board.tsx: where routes.cc.board redirects. */
export const BOARD_SCREEN = `${routes.cc.board}/board`;

export const TAB_HREFS: Readonly<Record<CcTab, string>> = Object.freeze({
  board: BOARD_SCREEN,
  calendar: routes.cc.calendar,
  questions: routes.cc.questions,
  deliverables: routes.cc.deliverables,
});

/** The tab the Command Centre opens on. */
export const FIRST_TAB: CcTab = 'board';

/** '/cc/calendar?x=1#y/' → '/cc/calendar'. */
function bare(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0].trim();
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** The tab a path is, or null for anything else (a ticket, a post, a Deliverable, elsewhere). */
export function tabFor(pathname: string): CcTab | null {
  const path = bare(pathname);
  if (path === routes.cc.board) return 'board';
  return CC_TABS.find((tab) => TAB_HREFS[tab] === path) ?? null;
}

/** The tab the shell shows: the path's own, else the one it was showing (what opened over it). */
export function shellTab(pathname: string, previous: CcTab = FIRST_TAB): CcTab {
  return tabFor(pathname) ?? previous;
}

/** Each tab's figure, or null while its source has not answered (no figure shown). */
export type TabCounts = Readonly<Record<CcTab, number | null>>;

export type TabView = {
  readonly tab: CcTab;
  readonly word: string;
  readonly href: string;
  /** The mono figure beside the word: none at 0 or unknown, '99+' past the cap. */
  readonly count: string | null;
  readonly selected: boolean;
  /** 'Questions, 2': the figure means nothing to VoiceOver on its own. */
  readonly accessibilityLabel: string;
};

export function tabViews(active: CcTab, counts: TabCounts): TabView[] {
  return CC_TABS.map((tab) => {
    const figure = counts[tab];
    const count = figure === null ? null : badgeText(figure);
    const word = SHELL_COPY.tabs[tab];
    return {
      tab,
      word,
      href: TAB_HREFS[tab],
      count,
      selected: tab === active,
      accessibilityLabel: joinLabel(word, count),
    };
  });
}
