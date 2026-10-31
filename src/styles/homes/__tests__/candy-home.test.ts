// candy-home.ts (US-023g): Candy's four views, the tab bar's action per tab (a view in place, never
// a route) and the view a route opens.

import { describe, expect, it } from 'vitest';

import { routes } from '../../../navigation/routes';
import { CANDY_VIEWS, openingView, showsTabBar, tabAction } from '../candy-home';

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
