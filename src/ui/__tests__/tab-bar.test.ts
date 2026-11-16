// The tab bar's logic (tab-bar.ts, the app standard's rule 5.4): the app's own list in the app's
// own order, five at the most; a listed tab with no route made loud, never dropped; the selected
// tab marked; a press sends the router's own tab-press event, and pressing the selected tab opens
// nothing and asks its stack back to its root; the bar inside the safe area in both shapes, with
// a floating bar's inset and corner from the chrome; gone while the keyboard is up; never under
// the touch target; a cap on the label's growth that is never under 2; and the template's bar,
// whose words the contrast test measures and whose marks read, in every palette.

import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../../core/web/lib/look-kit/contrast';
import { LEAST_FONT_SCALE_CAP } from '../../release/__tests__/support/a11y-allowed';
import { TEXT_ON } from '../../styles/contrast';
import { STYLE_IDS, tokensFor, type Tokens } from '../../styles/tokens';
import { MIN_TEXT_SIZE, TYPE_SPECS } from '../../styles/type';
import { MARK_CONTRAST } from '../accent';
import { MIN_TOUCH } from '../paint';
import {
  TABS_MOST,
  TAB_BAR_CHROME,
  TAB_LABEL_SCALING,
  missingTabs,
  refuseMissingTabs,
  tabBarFrame,
  tabBarHidden,
  tabInk,
  tabItems,
  tabMinHeight,
  tabPress,
  tabTone,
  type TabBarChrome,
  type TabSpec,
  type TabState,
} from '../tab-bar';
import { TEXT_TONES, textRole } from '../variants';

const ICON = 'icon';
const tab = (route: string, label: string): TabSpec<string> => ({ route, label, icon: ICON });

const TABS: readonly TabSpec<string>[] = [
  tab('first', 'First'),
  tab('second', 'Second'),
  tab('third', 'Third'),
];

/** The router's state: its routes in the router's own order, which is not the app's. */
function state(index: number, names: readonly string[] = ['third', 'first', 'second']): TabState {
  return {
    key: 'tab-navigator',
    index,
    routes: names.map((name) => ({ key: `${name}-key`, name })),
  };
}

describe('how many tabs', () => {
  const many = (count: number) => Array.from({ length: count }, (_, at) => tab(`t${at}`, `T${at}`));

  it('draws as many as it is handed, up to its most', () => {
    const names = many(TABS_MOST).map((each) => each.route);
    expect(tabItems(many(TABS_MOST), state(0, names))).toHaveLength(TABS_MOST);
    expect(tabItems(many(1), state(0, ['t0']))).toHaveLength(1);
  });

  it('refuses one more than its most, and says how many it was handed', () => {
    const tooMany = many(TABS_MOST + 1);
    expect(() => tabItems(tooMany, state(0))).toThrow(RangeError);
    expect(() => tabItems(tooMany, state(0))).toThrow(new RegExp(`not ${TABS_MOST + 1}`));
  });
});

describe('the tabs the bar draws', () => {
  it("are the app's list in the app's order, not the router's", () => {
    const items = tabItems(TABS, state(0));
    expect(items.map((item) => item.route)).toEqual(['first', 'second', 'third']);
    expect(items.map((item) => item.label)).toEqual(['First', 'Second', 'Third']);
    expect(items.map((item) => item.key)).toEqual(['first-key', 'second-key', 'third-key']);
  });

  it('every one carries its word and its icon', () => {
    for (const item of tabItems(TABS, state(0))) {
      expect(item.label).not.toBe('');
      expect(item.icon).toBe(ICON);
    }
  });

  it('marks the one the router has open, and only that one', () => {
    expect(tabItems(TABS, state(0)).map((item) => item.selected)).toEqual([false, false, true]);
    expect(tabItems(TABS, state(1)).map((item) => item.selected)).toEqual([true, false, false]);
    expect(tabItems(TABS, state(2)).map((item) => item.selected)).toEqual([false, true, false]);
  });

  it('draws no tab for a route the app did not list: a filtered tab is absent', () => {
    const items = tabItems(TABS.slice(0, 2), state(1));
    expect(items.map((item) => item.route)).toEqual(['first', 'second']);
  });

  it('marks none when the open route is not one of the tabs', () => {
    expect(tabItems(TABS.slice(0, 2), state(0)).some((item) => item.selected)).toBe(false);
    expect(tabItems(TABS, state(9)).some((item) => item.selected)).toBe(false);
  });

  it("carries the route's own params", () => {
    const params = { from: 'a link' };
    const withParams: TabState = {
      key: 'tab-navigator',
      index: 0,
      routes: [{ key: 'first-key', name: 'first', params }],
    };
    expect(tabItems(TABS.slice(0, 1), withParams)[0]).toMatchObject({ params, selected: true });
  });

  it('gives frozen items and leaves its inputs as they were', () => {
    const given = state(0);
    const before = JSON.stringify(given);
    const items = tabItems(TABS, given);
    expect(items.every((item) => Object.isFrozen(item))).toBe(true);
    expect(JSON.stringify(given)).toBe(before);
  });
});

describe('a listed tab the router has no route for', () => {
  const WITH_A_FOURTH = [...TABS, tab('fourth', 'Fourth')];

  it('is named, and the tabs that have routes are not', () => {
    expect(missingTabs(WITH_A_FOURTH, state(0))).toEqual(['fourth']);
    expect(missingTabs(TABS, state(0))).toEqual([]);
    expect(missingTabs(TABS, state(0, ['first']))).toEqual(['second', 'third']);
  });

  it('is not a fault the other way round: a route with no tab is a filtered tab', () => {
    expect(missingTabs(TABS.slice(0, 1), state(0))).toEqual([]);
  });

  it('is thrown in a development build, with its name, after it is written to the log', () => {
    const logged: string[] = [];
    const report = { development: true, log: (message: string) => logged.push(message) };
    expect(() => refuseMissingTabs(['fourth'], report)).toThrow(/fourth/);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('fourth');
  });

  it('is written to the log in a release build, and the bar still draws the rest', () => {
    const logged: string[] = [];
    const report = { development: false, log: (message: string) => logged.push(message) };
    expect(() => refuseMissingTabs(['fourth', 'fifth'], report)).not.toThrow();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('fourth, fifth');
    expect(tabItems(WITH_A_FOURTH, state(0)).map((item) => item.route)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('says nothing, and throws nothing, when no tab is missing', () => {
    const logged: string[] = [];
    const report = { development: true, log: (message: string) => logged.push(message) };
    expect(() => refuseMissingTabs([], report)).not.toThrow();
    expect(logged).toEqual([]);
  });
});

describe('a press on a tab', () => {
  const NAVIGATOR = 'tab-navigator';
  const [first, , third] = tabItems(TABS, state(0));

  it("always sends the router's tab-press event for that tab", () => {
    expect(first).toBeDefined();
    expect(third).toBeDefined();
    if (first === undefined || third === undefined) return;
    expect(tabPress(first, NAVIGATOR).target).toBe('first-key');
    expect(tabPress(third, NAVIGATOR).target).toBe('third-key');
  });

  it('on a tab that is not open, opens it: the navigate action, aimed at the tab navigator', () => {
    if (first === undefined) return;
    expect(tabPress(first, NAVIGATOR)).toEqual({
      target: 'first-key',
      data: { behavior: { scrollToTop: false, popToTop: false } },
      jump: { type: 'NAVIGATE', payload: { name: 'first', params: undefined }, target: NAVIGATOR },
    });
  });

  it('on the open tab, opens nothing and asks its stack back to its root', () => {
    if (third === undefined) return;
    expect(third.selected).toBe(true);
    expect(tabPress(third, NAVIGATOR)).toEqual({
      target: 'third-key',
      data: { behavior: { scrollToTop: true, popToTop: true } },
      jump: null,
    });
  });

  it('opens a tab with the params its route already has', () => {
    const params = { from: 'a link' };
    const press = tabPress({ key: 'k', route: 'first', params, selected: false }, NAVIGATOR);
    expect(press.jump?.payload).toEqual({ name: 'first', params });
  });

  it('is frozen all the way down', () => {
    if (first === undefined) return;
    const press = tabPress(first, NAVIGATOR);
    expect(Object.isFrozen(press)).toBe(true);
    expect(Object.isFrozen(press.data.behavior)).toBe(true);
    expect(Object.isFrozen(press.jump)).toBe(true);
  });
});

describe('the selected tab is marked by more than colour', () => {
  it('takes a tone of its own for its word, beside the rule above it', () => {
    expect(tabTone(true)).not.toBe(tabTone(false));
  });

  it("and a heavier face in the template's bar", () => {
    expect(TAB_BAR_CHROME.labelWeight.selected).toBeGreaterThan(TAB_BAR_CHROME.labelWeight.rest);
  });
});

describe('the bar at the bottom edge', () => {
  const HOME_INDICATOR = 34;
  const floating = { inset: 'space6', radius: 'card' } as const;
  const docked: Pick<TabBarChrome, 'shape' | 'floating'> = { shape: 'docked', floating };
  const afloat: Pick<TabBarChrome, 'shape' | 'floating'> = { shape: 'floating', floating };

  it('docked: runs edge to edge, its own ground under the home indicator', () => {
    expect(tabBarFrame(docked, HOME_INDICATOR)).toEqual({
      paddingBottom: HOME_INDICATOR,
      marginBottom: 0,
      inset: null,
      radius: null,
      rule: 'top',
    });
  });

  it("floating: a rounded bar off the sides and above the home indicator, by the chrome's values", () => {
    expect(tabBarFrame(afloat, HOME_INDICATOR)).toEqual({
      paddingBottom: 0,
      marginBottom: HOME_INDICATOR,
      inset: floating.inset,
      radius: floating.radius,
      rule: 'around',
    });
  });

  it('stays inside the safe area in both shapes: the inset is always spent, once', () => {
    for (const chrome of [docked, afloat]) {
      const frame = tabBarFrame(chrome, HOME_INDICATOR);
      expect(frame.paddingBottom + frame.marginBottom).toBe(HOME_INDICATOR);
    }
  });

  it('on a phone with no home indicator, or an inset that is not a number, adds nothing', () => {
    for (const inset of [0, -3, Number.NaN]) {
      expect(tabBarFrame(docked, inset).paddingBottom).toBe(0);
      expect(tabBarFrame(afloat, inset).marginBottom).toBe(0);
    }
  });

  it('is not drawn while the keyboard is up', () => {
    expect(tabBarHidden(0)).toBe(false);
    expect(tabBarHidden(291)).toBe(true);
    expect(tabBarHidden(Number.NaN)).toBe(false);
  });
});

describe('a tab is a touch target, and grows with its word', () => {
  it("is the chrome's height at the least, and never under 44", () => {
    expect(tabMinHeight(49)).toBe(49);
    expect(tabMinHeight(30)).toBe(MIN_TOUCH);
    expect(tabMinHeight(Number.NaN)).toBe(MIN_TOUCH);
    expect(tabMinHeight(TAB_BAR_CHROME.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  it('caps its word no lower than the least cap the app allows, and never turns scaling off', () => {
    expect(TAB_LABEL_SCALING.maxFontSizeMultiplier).toBeGreaterThanOrEqual(LEAST_FONT_SCALE_CAP);
    expect(Object.keys(TAB_LABEL_SCALING)).toEqual(['maxFontSizeMultiplier']);
  });

  it("draws its word in the template's bar at 11 pt or more", () => {
    const role = textRole('body', TAB_BAR_CHROME.labelLevel);
    expect(TYPE_SPECS[role].size).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
  });
});

describe("the template's bar reads in every palette (rule 10.4)", () => {
  const SCHEMES = ['light', 'dark'] as const;
  const PALETTES: readonly Tokens[] = [
    ...new Set(STYLE_IDS.flatMap((style) => SCHEMES.map((scheme) => tokensFor(style, scheme)))),
  ];
  const { ground } = TAB_BAR_CHROME;

  it('draws its words on a ground the contrast test measures both of their tones on', () => {
    for (const selected of [true, false]) {
      const text = TEXT_TONES[tabTone(selected)];
      const pair = TEXT_ON.find(([each]) => each === text);
      expect(pair?.[1], text).toContain(ground);
    }
  });

  it.each(PALETTES.map((tokens) => [`${tokens.style} ${tokens.scheme}`, tokens] as const))(
    '%s: the icon and the mark read on the bar, selected or not',
    (_name, tokens) => {
      for (const selected of [true, false]) {
        const ink = tabInk(tokens.colours, selected);
        const ratio = contrastRatio(ink.slice(0, 7), tokens.colours[ground].slice(0, 7));
        expect(ratio).toBeGreaterThanOrEqual(MARK_CONTRAST);
      }
    },
  );
});
