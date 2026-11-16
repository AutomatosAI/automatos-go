// The tab bar's logic, pure (the app standard's rules 5.4 and 3.3), so TabBar.tsx only wires:
// which tabs the bar draws, what a press sends the router, how the bar sits at the bottom edge,
// and its paints and sizes.
//
// THE CONTRACT. The app hands the bar its own list, already filtered: a tab whose feature is off
// is not in it (rule 6.5; src/shell/tabs.ts tabsShown). The bar draws that list in that order,
// each tab matched to the router's route of the same name. Every tab shows its word. The selected
// one is marked by more than colour: a rule above it and a heavier face, in the accent that reads
// (accent.ts), and VoiceOver hears it selected. Pressing a tab sends the router's own tab-press
// event, so pressing the selected one takes its stack back to its root, as the system's bar does.
//
// What the bar holds the app to, and what it leaves to the app:
//   - Five tabs at the most. A sixth is refused with an error: it belongs in one of the five.
//   - A listed tab must have a route. One with none is a fault and is made loud (missingTabs,
//     refuseMissingTabs): it is handed to the app's log as an error, and in a development build
//     it is thrown, so whoever listed the tab sees it the first time the bar is drawn. It is
//     never dropped quietly. (The log says nothing in a release build; the throw in development
//     is what stops the fault, and an app also holds its list with a test: tabListFaults.)
//   - The Tabs shell is for three to five places (rule 5.4), but the LEAST is the app's to hold,
//     not the bar's: an app may be on its way there, with fewer tabs built than its design has,
//     and records that as a difference. The bar draws what it is handed.
//   - Sizes, the bar's shape (docked or floating) and how a floating bar is inset are the app's:
//     TabBarChrome, with the template's own bar as TAB_BAR_CHROME.

import type { FontWeight } from '../styles/fonts';
import type { ColourName, Colours, RadiusName, SpaceName } from '../styles/tokens';
import { accentInk } from './accent';
import { MIN_TOUCH } from './paint';
import type { TextLevel, TextTone } from './variants';

/** A tab bar holds five tabs at the most (rule 5.4). */
export const TABS_MOST = 5;

/** One tab as the app lists it: the router's name for it, its word and its icon. */
export type TabSpec<Icon> = Readonly<{ route: string; label: string; icon: Icon }>;

/** What the bar reads of the router's state: its own key, the open tab, and each tab's route. */
export type TabRoute = Readonly<{ key: string; name: string; params?: object | undefined }>;
export type TabState = Readonly<{ key: string; index: number; routes: readonly TabRoute[] }>;

/** One tab as the bar draws it. */
export type TabItem<Icon> = Readonly<{
  /** The router's key for the tab's route: where its events are sent. */
  key: string;
  route: string;
  label: string;
  icon: Icon;
  params: object | undefined;
  selected: boolean;
}>;

/**
 * The tabs the bar draws: the app's list, in the app's order, each with the router's route of
 * its name. A route the app did not list has no tab. A listed tab the router has no route for
 * cannot be drawn: missingTabs names it, and the bar makes that loud. More than five is refused:
 * a sixth place belongs in one of the five.
 */
export function tabItems<Icon>(
  tabs: readonly TabSpec<Icon>[],
  state: TabState,
): readonly TabItem<Icon>[] {
  if (tabs.length > TABS_MOST) {
    throw new RangeError(`A tab bar holds ${TABS_MOST} tabs at the most, not ${tabs.length}`);
  }
  const open = state.routes[state.index]?.key;
  return tabs.flatMap((tab) => {
    const route = state.routes.find((each) => each.name === tab.route);
    if (route === undefined) return [];
    return [
      Object.freeze({
        key: route.key,
        route: tab.route,
        label: tab.label,
        icon: tab.icon,
        params: route.params,
        selected: route.key === open,
      }),
    ];
  });
}

/** The listed tabs the router has no route for, by name. None, when the list and the routes agree. */
export function missingTabs<Icon>(
  tabs: readonly TabSpec<Icon>[],
  state: TabState,
): readonly string[] {
  const routed = new Set(state.routes.map((route) => route.name));
  return tabs.map((tab) => tab.route).filter((name) => !routed.has(name));
}

/** How a fault is made loud: where the error is written, and whether this is a development build. */
export type FaultReport = Readonly<{ development: boolean; log: (message: string) => void }>;

/**
 * A listed tab with no route is a fault in the app, never something to draw around. It is handed
 * to the app's log as an error in every build, and in a development build it is thrown, so the
 * person who listed the tab sees it at once.
 */
export function refuseMissingTabs(missing: readonly string[], report: FaultReport): void {
  if (missing.length === 0) return;
  const message = `The tab bar was handed a tab with no route of its name (${missing.join(', ')}): a listed tab is never dropped`;
  report.log(message);
  if (report.development) throw new Error(message);
}

/** What the tab-press event tells the screens under the tab (the router's own shape). */
export type TabPressData = Readonly<{
  behavior: Readonly<{ scrollToTop: boolean; popToTop: boolean }>;
}>;

/** The router's action that opens a tab, aimed at the tab navigator itself. */
export type TabJump = Readonly<{
  type: 'NAVIGATE';
  payload: Readonly<{ name: string; params: object | undefined }>;
  target: string;
}>;

export type TabPress = Readonly<{
  /** The route the tab-press event is for. */
  target: string;
  data: TabPressData;
  /** The action that opens the tab, when it is not the open one and nothing prevented it. */
  jump: TabJump | null;
}>;

type Pressed = Pick<TabItem<unknown>, 'key' | 'route' | 'params' | 'selected'>;

/**
 * What a press on a tab sends: always the router's tab-press event for that tab, which a screen
 * may prevent. On the selected tab the event asks its stack to go back to its root and its list
 * to scroll to the top, and nothing is opened. On any other tab it asks for neither, and the tab
 * is opened unless the event was prevented.
 */
export function tabPress(item: Pressed, navigatorKey: string): TabPress {
  const again = item.selected;
  return Object.freeze({
    target: item.key,
    data: Object.freeze({ behavior: Object.freeze({ scrollToTop: again, popToTop: again }) }),
    jump: again
      ? null
      : Object.freeze({
          type: 'NAVIGATE',
          payload: Object.freeze({ name: item.route, params: item.params }),
          target: navigatorKey,
        }),
  });
}

/** The bar is not drawn while the keyboard is up: the room is the field's. */
export function tabBarHidden(keyboardHeight: number): boolean {
  return keyboardHeight > 0;
}

/** A tab's least height: the chrome's, and never under the touch target. The bar grows with its words. */
export function tabMinHeight(given: number): number {
  return Math.max(MIN_TOUCH, Number.isFinite(given) ? given : 0);
}

/**
 * The one text in the bar whose growth with Dynamic Type is capped. A screen's words wrap; a
 * tab's cannot, and the bar grows taller with them up to the cap.
 */
export const TAB_LABEL_SCALING = Object.freeze({
  // the tabs share the bar's width equally, so a tab's word stops growing at twice its size
  maxFontSizeMultiplier: 2,
});

/** The selected tab's mark: a short rule above its icon. */
export const TAB_MARK = Object.freeze({ width: 20, height: 3 });

/** A tab's icon and mark: the accent that reads when it is the selected one, the muted ink otherwise. */
export function tabInk(colours: Colours, selected: boolean): string {
  return selected ? accentInk(colours) : colours.mutedForeground;
}

/** The same two inks as tones, for the tab's word: the Text primitive paints them. */
export function tabTone(selected: boolean): TextTone {
  return selected ? 'accent' : 'muted';
}

export type TabBarShape = 'docked' | 'floating';

/** The bar's shape, sizes and paints: the app's own. */
export type TabBarChrome = Readonly<{
  shape: TabBarShape;
  /** A floating bar: its inset from the sides and above the home indicator, and its corner. */
  floating: Readonly<{ inset: SpaceName; radius: RadiusName }>;
  /** A tab's least height before its word grows (tabMinHeight keeps it at 44 or more). */
  minHeight: number;
  iconSize: number;
  /** The word's Body level, and its weight at rest and when the tab is the selected one. */
  labelLevel: TextLevel;
  labelWeight: Readonly<{ rest: FontWeight; selected: FontWeight }>;
  /** The bar's ground and its rule (across the top when docked, all round when it floats). */
  ground: ColourName;
  rule: ColourName;
}>;

/**
 * The template's bar: docked, each tab at least 49 tall (the system bar's own height), a 22 pt
 * icon (the header menu's glyph, D73), the word at Body 5 (12 pt, the scale's buttons and
 * controls) in Geist 500, and 600 on the selected tab, on the card with the border's hairline.
 * Its words are measured on the card by the contrast test, in every palette.
 */
export const TAB_BAR_CHROME: TabBarChrome = Object.freeze({
  shape: 'docked',
  floating: Object.freeze({ inset: 'space6', radius: 'card' }),
  minHeight: 49,
  iconSize: 22,
  labelLevel: 5,
  labelWeight: Object.freeze({ rest: 500, selected: 600 }),
  ground: 'card',
  rule: 'border',
});

export type TabBarFrame = Readonly<{
  /** Under the tabs, inside the bar's own ground: the home indicator's inset when docked. */
  paddingBottom: number;
  /** Under the bar: the home indicator's inset when the bar floats above it. */
  marginBottom: number;
  /** From the screen's sides and above the inset, when the bar floats; none when docked. */
  inset: SpaceName | null;
  /** The bar's corner when it floats; square when docked. */
  radius: RadiusName | null;
  /** Its rule: across the top when docked, all round when it floats. */
  rule: 'top' | 'around';
}>;

/**
 * How the bar sits at the bottom edge, inside the safe area either way. Docked, it runs edge to
 * edge and its own ground continues under the home indicator. Floating, it is a rounded bar held
 * off the sides and above the home indicator, by the chrome's inset and with the chrome's corner.
 */
export function tabBarFrame(
  chrome: Pick<TabBarChrome, 'shape' | 'floating'>,
  safeBottom: number,
): TabBarFrame {
  const bottom = Number.isFinite(safeBottom) && safeBottom > 0 ? safeBottom : 0;
  if (chrome.shape === 'floating') {
    return Object.freeze({
      paddingBottom: 0,
      marginBottom: bottom,
      inset: chrome.floating.inset,
      radius: chrome.floating.radius,
      rule: 'around',
    });
  }
  return Object.freeze({
    paddingBottom: bottom,
    marginBottom: 0,
    inset: null,
    radius: null,
    rule: 'top',
  });
}
