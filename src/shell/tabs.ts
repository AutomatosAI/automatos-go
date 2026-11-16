// The Tabs shell's list, pure (the app standard's rules 5.4 and 6.5): what an app hands the shell
// and how it is held. The app lists its places in the order the bar draws them, each with the
// router's name for its folder, its word and its icon. A place whose feature can be off names that
// feature, and tabsShown leaves it out while it is off, so the bar never shows a tab for something
// that does not work. tabListFaults says what is wrong with a list: an app's own test holds its
// list to none, and a copy with fewer than three places for now records that under rule 5.4 in
// its TEMPLATE.md. The shell itself is AppTabs.tsx and TabStack.tsx; this file runs with no
// renderer, so an icon is whatever the app draws with (a lucide icon in AppTabs).

import type { Edge } from 'react-native-safe-area-context';

import { TABS_MOST, type TabSpec } from '../ui/tab-bar';

/** The Tabs shell is for three to five places of equal weight (rule 5.4). */
export const TABS_LEAST = 3;

/** A place as the app lists it: a tab, and the feature it opens when that can be off. */
export type ShellTab<Icon> = TabSpec<Icon> & Readonly<{ feature?: string }>;

/** The tabs the bar is handed: the app's list, in its order, less any whose feature is off. */
export function tabsShown<Icon>(
  tabs: readonly ShellTab<Icon>[],
  isOn: (feature: string) => boolean,
): readonly ShellTab<Icon>[] {
  return Object.freeze(tabs.filter((tab) => tab.feature === undefined || isOn(tab.feature)));
}

function repeated(routes: readonly string[]): readonly string[] {
  return [...new Set(routes.filter((route, at) => routes.indexOf(route) !== at))];
}

/**
 * What is wrong with a list of tabs, in words for the person who wrote it; none for a list the
 * shell is for. More than five, fewer than three, a route listed twice, a tab with no word.
 */
export function tabListFaults<Icon>(tabs: readonly TabSpec<Icon>[]): readonly string[] {
  const routes = tabs.map((tab) => tab.route);
  const faults = [
    tabs.length > TABS_MOST ? `more than ${TABS_MOST} tabs (${tabs.length})` : null,
    tabs.length < TABS_LEAST ? `fewer than ${TABS_LEAST} tabs (${tabs.length})` : null,
    ...repeated(routes).map((route) => `the route ${route} is listed twice`),
    ...tabs
      .filter((tab) => tab.label.trim() === '')
      .map((tab) => `the tab ${tab.route} has no word`),
  ];
  return Object.freeze(faults.filter((fault): fault is string => fault !== null));
}

/** A screen inside the tabs takes these safe-area edges: the tab bar takes the bottom one. */
export const TAB_SCREEN_EDGES: readonly Edge[] = Object.freeze(['top', 'left', 'right']);

/**
 * A tab's stack starts at its root, so a link straight to one of its pushed screens still has the
 * root under it and Back leads there. Its route layout exports this as `unstable_settings`.
 */
export const TAB_STACK_SETTINGS = Object.freeze({ initialRouteName: 'index' });
