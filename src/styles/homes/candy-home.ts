// Candy's home over A2's one thread (PRD-001 §4.6.2 D-CAN-6, US-023g; CANDY-LAYOUT §4), pure: its
// four views, what the tab bar does, and which view a route opens. The components only draw.
//
//   The home is P1 Today, P2 Chat, P3 Shelf and P4 Team: views of the one home, switched in place,
//   never a route, so the thread, Auto and the voice hold across them. The floating tab bar shows on
//   Today, Shelf and Team (the P2 mock has none: the Chat view's ways out are its back and menu
//   circles, US-023h). A tab opens its view; the view on screen stays. Chat is a view too, also on a
//   conversation's own route: the conversation the route opened is the home's thread, so Chat there
//   stays on it and never leaves for the home's route (Arcade's ◀ Chat did; Candy has no reason to).
//   The home's route opens Today; a conversation's route opens Chat; a caller may name the view.
// Pure: no React, React Native, Expo or Skia.

import { routes } from '../../navigation/routes';
import { CANDY_TABS, type CandyTab } from '../candy/parts/tab-bar';

/** The home's views, in the tab bar's order (the voice sits between Chat and Shelf). */
export const CANDY_VIEWS = CANDY_TABS;
export type CandyView = CandyTab;

/** The views that show the tab bar (P1, P3, P4). */
const TAB_BAR_VIEWS: ReadonlySet<CandyView> = new Set<CandyView>(['today', 'shelf', 'team']);

export function showsTabBar(view: CandyView): boolean {
  return TAB_BAR_VIEWS.has(view);
}

export type TabAction =
  /** Show this view, in place (no route). */
  | { readonly kind: 'view'; readonly view: CandyView }
  /** The view on screen: nothing to do. */
  | { readonly kind: 'here' };

const HERE: TabAction = Object.freeze({ kind: 'here' });
const VIEW_ACTIONS: Readonly<Record<CandyView, TabAction>> = Object.freeze({
  today: Object.freeze({ kind: 'view', view: 'today' }),
  chat: Object.freeze({ kind: 'view', view: 'chat' }),
  shelf: Object.freeze({ kind: 'view', view: 'shelf' }),
  team: Object.freeze({ kind: 'view', view: 'team' }),
});

/** What a tab does from `current`: its view in place, or nothing when it is the view on screen. */
export function tabAction(tab: CandyTab, current: CandyView): TabAction {
  return tab === current ? HERE : VIEW_ACTIONS[tab];
}

/**
 * The view a route opens: the one the caller names, else Today on the home's route and Chat on a
 * conversation's (`pathname` is expo-router's usePathname).
 */
export function openingView(pathname: string, view?: CandyView): CandyView {
  if (view !== undefined) return view;
  return pathname === routes.home ? 'today' : 'chat';
}
