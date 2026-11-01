// candy-home.ts (US-023g): Candy's four views, the tab bar's action per tab (a view in place, never
// a route) and the view a route opens.

import { describe, expect, it } from 'vitest';

import { routes } from '../../../navigation/routes';
import {
  CANDY_VIEWS,
  openingView,
  routeFocusLeft,
  showsTabBar,
  tabAction,
  withScrolled,
} from '../candy-home';

describe("Candy's views", () => {
  it('are Today, Chat, Shelf and Team, in the tab bar’s order', () => {
    expect(CANDY_VIEWS).toEqual(['today', 'chat', 'shelf', 'team']);
  });

  it('float the tab bar on Today, Shelf and Team, never on Chat (the P2 mock)', () => {
    expect(CANDY_VIEWS.filter(showsTabBar)).toEqual(['today', 'shelf', 'team']);
  });
});

describe('the tab bar', () => {
  it('opens each view in place from any other', () => {
    for (const tab of CANDY_VIEWS) {
      for (const current of CANDY_VIEWS.filter((view) => view !== tab)) {
        expect(tabAction(tab, current)).toEqual({ kind: 'view', view: tab });
      }
    }
  });

  it('does nothing for the view on screen', () => {
    for (const view of CANDY_VIEWS) expect(tabAction(view, view)).toEqual({ kind: 'here' });
  });
});

describe('the view a route opens', () => {
  it("is Today on the home's route and Chat on a conversation's", () => {
    expect(openingView(routes.home)).toBe('today');
    expect(openingView(routes.chat('c-1'))).toBe('chat');
  });

  it('is the one the caller names', () => {
    expect(openingView(routes.home, 'chat')).toBe('chat');
    expect(openingView(routes.chat('c-1'), 'today')).toBe('today');
  });
});

describe("the route's focus, kept by the home", () => {
  const NONE: ReadonlySet<string> = new Set();

  it('is the route’s message until the Chat view has scrolled to it, then none', () => {
    expect(routeFocusLeft('m-brief', NONE)).toBe('m-brief');
    const scrolled = withScrolled(NONE, 'm-brief');
    expect(routeFocusLeft('m-brief', scrolled)).toBeNull();
  });

  it('stays spent when the Chat view mounts again (Today, then Chat)', () => {
    const scrolled = withScrolled(NONE, 'm-brief');
    expect(routeFocusLeft('m-brief', scrolled)).toBeNull();
    expect(routeFocusLeft('m-brief', withScrolled(scrolled, 'm-brief'))).toBeNull();
  });

  it('takes a different message, and none for no focus', () => {
    const scrolled = withScrolled(NONE, 'm-brief');
    expect(routeFocusLeft('m-later', scrolled)).toBe('m-later');
    expect(routeFocusLeft(null, NONE)).toBeNull();
  });

  it('keeps the same set when the message is there already, a new one when not', () => {
    const scrolled = withScrolled(NONE, 'm-brief');
    expect(withScrolled(scrolled, 'm-brief')).toBe(scrolled);
    expect(withScrolled(scrolled, 'm-later')).not.toBe(scrolled);
    expect([...withScrolled(scrolled, 'm-later')]).toEqual(['m-brief', 'm-later']);
    expect([...scrolled]).toEqual(['m-brief']);
  });
});
