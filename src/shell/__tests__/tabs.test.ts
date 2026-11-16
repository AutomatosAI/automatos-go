// The Tabs shell (tabs.ts, AppTabs.tsx, TabStack.tsx; the app standard's rules 5.4 and 6.5): a
// tab whose feature is off is absent and the rest keep the app's order; a list is held to three to
// five places, each route once and each with its word; a screen inside the tabs leaves the bottom
// edge to the bar; a tab's stack starts at its root. The two components are read from the source
// (vitest runs no React Native renderer): the router's own tabs with the drawn bar and no header
// of the system's, so there is never a second bar. And the template itself is One home.

import { describe, expect, it } from 'vitest';

import { codeOf } from '../../release/__tests__/support/code';
import { productFiles } from '../../release/__tests__/support/tree';
import { TABS_MOST } from '../../ui/tab-bar';
import {
  TABS_LEAST,
  TAB_SCREEN_EDGES,
  TAB_STACK_SETTINGS,
  tabListFaults,
  tabsShown,
  type ShellTab,
} from '../tabs';

const tab = (route: string, feature?: string): ShellTab<string> =>
  feature === undefined
    ? { route, label: route.toUpperCase(), icon: 'icon' }
    : { route, label: route.toUpperCase(), icon: 'icon', feature };

const PLACES = [tab('first'), tab('second', 'reports'), tab('third'), tab('fourth', 'voice')];
const many = (count: number) => Array.from({ length: count }, (_, at) => tab(`t${at}`));

describe('a tab whose feature is off (rule 6.5)', () => {
  it('is absent, and the rest keep the app’s order', () => {
    const on = (feature: string) => feature === 'voice';
    expect(tabsShown(PLACES, on).map((each) => each.route)).toEqual(['first', 'third', 'fourth']);
  });

  it('is there once its feature is on, and a tab with no feature is always there', () => {
    expect(tabsShown(PLACES, () => true)).toEqual(PLACES);
    expect(tabsShown(PLACES, () => false).map((each) => each.route)).toEqual(['first', 'third']);
  });

  it('gives a frozen list and leaves the app’s list as it was', () => {
    const given = Object.freeze([...PLACES]);
    const shown = tabsShown(given, () => false);
    expect(Object.isFrozen(shown)).toBe(true);
    expect(given).toHaveLength(PLACES.length);
  });
});

describe('a list of tabs (rule 5.4)', () => {
  it('of three to five places, each once and each with its word, has no fault', () => {
    for (let count = TABS_LEAST; count <= TABS_MOST; count += 1) {
      expect(tabListFaults(many(count))).toEqual([]);
    }
  });

  it('of more than five, or fewer than three, says so with how many', () => {
    expect(tabListFaults(many(TABS_MOST + 1))).toEqual([`more than ${TABS_MOST} tabs (6)`]);
    expect(tabListFaults(many(2))).toEqual([`fewer than ${TABS_LEAST} tabs (2)`]);
    expect(tabListFaults([])).toEqual([`fewer than ${TABS_LEAST} tabs (0)`]);
  });

  it('names a route listed twice, once', () => {
    const twice = [tab('first'), tab('second'), tab('first'), tab('first')];
    expect(tabListFaults(twice)).toEqual(['the route first is listed twice']);
  });

  it('names a tab with no word: an icon alone is not enough', () => {
    const wordless = [tab('first'), { ...tab('second'), label: '  ' }, tab('third')];
    expect(tabListFaults(wordless)).toEqual(['the tab second has no word']);
  });
});

describe('a screen inside the tabs', () => {
  it('leaves the bottom edge to the bar and keeps the other three', () => {
    expect([...TAB_SCREEN_EDGES].sort()).toEqual(['left', 'right', 'top']);
  });

  it('sits in a stack that starts at its root, so Back from a linked screen leads there', () => {
    expect(TAB_STACK_SETTINGS).toEqual({ initialRouteName: 'index' });
  });
});

describe('the shell draws one bar (rule 5.4, decision D3)', () => {
  const tabs = codeOf('src/shell/AppTabs.tsx');
  const stack = codeOf('src/shell/TabStack.tsx');

  it('is the router’s own tabs, with no header of the system’s', () => {
    expect(tabs).toMatch(/<Tabs\s+screenOptions=\{SCREEN_OPTIONS\}/);
    expect(tabs).toMatch(/SCREEN_OPTIONS = Object\.freeze\(\{ headerShown: false \}\)/);
  });

  it('draws the TabBar primitive as its bar, handed the app’s own tabs', () => {
    expect(tabs).toMatch(/tabBar=\{\(props\) => \(?<TabBar tabs=\{tabs\}/);
    expect(tabs).toMatch(
      /tabs\.map\(\(tab\) => \(?<Tabs\.Screen key=\{tab\.route\} name=\{tab\.route\}/,
    );
  });

  it('puts a stack in each tab, with no header of the system’s either', () => {
    expect(stack).toMatch(/<Stack screenOptions=\{SCREEN_OPTIONS\}/);
    expect(stack).toMatch(/SCREEN_OPTIONS = Object\.freeze\(\{ headerShown: false \}\)/);
  });

  // The template is the One home shell (the record's table of apps): no route mounts the tabs. A
  // copy that takes the Tabs shell turns this round: its tabs' layout is the file that does.
  it('is mounted by no route of the template, which is One home', () => {
    const mounts = productFiles().filter(
      (file) => file.startsWith('app/') && codeOf(file).includes('src/shell/'),
    );
    expect(mounts).toEqual([]);
  });
});
