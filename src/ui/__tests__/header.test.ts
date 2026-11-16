// The header's logic (header-model.ts, the app standard's rule 4.2): back on every screen but a tab's
// root, two actions at the most and each at a place of its own, a bar never under the touch
// target, the bar's title held back while a large title is still on screen, where a large title
// ends when something sits above it, and whether a bar's sizes leave room for every button's
// 44 pt touch, the template's own bar among them, in every style.

import { describe, expect, it } from 'vitest';

import { STYLE_IDS, tokensFor } from '../../styles/tokens';
import type { HeaderAction, HeaderActions } from '../Header';
import {
  HEADER_BAR,
  HEADER_BUTTON_SIZE,
  HEADER_TITLE_LINES,
  barTitleShown,
  headerActions,
  headerKeepsTouch,
  headerMinHeight,
  largeTitleEnd,
  largeTitleGone,
  showsBack,
} from '../header-model';
import { MIN_TOUCH, hitSlopFor } from '../paint';
import { ICON_BUTTON_SIZES } from '../variants';

const SCHEMES = ['light', 'dark'] as const;
const noop = () => undefined;
const share = { icon: noop, accessibilityLabel: 'Share', onPress: noop } as unknown as HeaderAction;
// The type is the guard: a third action does not compile (npm run typecheck).
// @ts-expect-error a bar holds two actions at the most (rule 4.2)
const three: HeaderActions = [share, share, share];
const two: HeaderActions = [share, share];

describe('the way back', () => {
  it("is drawn on every screen but a tab's root", () => {
    expect(showsBack(undefined)).toBe(true);
    expect(showsBack(false)).toBe(true);
    expect(showsBack(true)).toBe(false);
  });
});

describe('the actions', () => {
  it('draws none, one or two as given, in order', () => {
    expect(headerActions(undefined)).toEqual([]);
    expect(headerActions([])).toEqual([]);
    expect(headerActions(['a']).map((placed) => placed.action)).toEqual(['a']);
    expect(headerActions(['a', 'b']).map((placed) => placed.action)).toEqual(['a', 'b']);
  });

  it('never draws a third, even where the type was got round', () => {
    expect(headerActions(['a', 'b', 'c']).map((placed) => placed.action)).toEqual(['a', 'b']);
    expect(headerActions(three)).toHaveLength(2);
    expect(headerActions(two)).toHaveLength(2);
  });

  it('gives each a place of its own, so two actions alike in every word still differ', () => {
    const same = { label: 'Share' };
    const places = headerActions([same, same]).map((placed) => placed.place);
    expect(new Set(places).size).toBe(2);
    expect(headerActions([same])[0]?.place).toBe(places[0]);
  });

  it('does not change the list it was given', () => {
    const given = Object.freeze(['a', 'b', 'c']);
    headerActions(given);
    expect(given).toEqual(['a', 'b', 'c']);
  });
});

describe("the bar's height", () => {
  it('is the one given, and never under the touch target', () => {
    expect(headerMinHeight(48)).toBe(48);
    expect(headerMinHeight(56)).toBe(56);
    expect(headerMinHeight(30)).toBe(MIN_TOUCH);
    expect(headerMinHeight(0)).toBe(MIN_TOUCH);
    expect(headerMinHeight(Number.NaN)).toBe(MIN_TOUCH);
  });
});

describe("the bar's own title", () => {
  it('is always shown on a screen with no large title', () => {
    expect(barTitleShown(undefined)).toBe(true);
  });

  it('waits on a screen with a large title, and appears once that has scrolled away', () => {
    expect(barTitleShown({ gone: false })).toBe(false);
    expect(barTitleShown({ gone: true })).toBe(true);
  });

  it('wraps once at the larger text sizes before it is cut short', () => {
    expect(HEADER_TITLE_LINES).toBe(2);
  });
});

describe('where a large title ends', () => {
  it('is the bottom of the view that holds it, measured from the top of the content', () => {
    expect(largeTitleEnd({ y: 0, height: 96 })).toBe(96);
  });

  it('counts whatever sits above the title in the content', () => {
    const BANNER = 60;
    expect(largeTitleEnd({ y: BANNER, height: 96 })).toBe(BANNER + 96);
    expect(largeTitleGone(100, largeTitleEnd({ y: BANNER, height: 96 }))).toBe(false);
    expect(largeTitleGone(BANNER + 96, largeTitleEnd({ y: BANNER, height: 96 }))).toBe(true);
  });

  it('is not known for a view with no height, or a layout that is not a size', () => {
    expect(largeTitleEnd({ y: 0, height: 0 })).toBeNull();
    expect(largeTitleEnd({ y: 20, height: 0 })).toBeNull();
    expect(largeTitleEnd({ y: Number.NaN, height: 96 })).toBeNull();
    expect(largeTitleEnd({ y: 0, height: Number.POSITIVE_INFINITY })).toBeNull();
    expect(largeTitleEnd({ y: -200, height: 96 })).toBeNull();
  });
});

describe('a large title has scrolled away', () => {
  const END = 96;

  it('when the content has moved up by at least where the title ends', () => {
    expect(largeTitleGone(0, END)).toBe(false);
    expect(largeTitleGone(END - 1, END)).toBe(false);
    expect(largeTitleGone(END, END)).toBe(true);
    expect(largeTitleGone(END + 400, END)).toBe(true);
  });

  it('and comes back when the content is pulled down again, or bounces past the top', () => {
    expect(largeTitleGone(END - 20, END)).toBe(false);
    expect(largeTitleGone(-40, END)).toBe(false);
  });

  it('never before the title has been measured', () => {
    expect(largeTitleGone(500, null)).toBe(false);
    expect(largeTitleGone(500, largeTitleEnd({ y: 0, height: 0 }))).toBe(false);
  });

  it('never for a scroll position that is not a number', () => {
    expect(largeTitleGone(Number.NaN, END)).toBe(false);
    expect(largeTitleGone(Number.POSITIVE_INFINITY, END)).toBe(false);
  });
});

describe('every button in the bar is a 44 pt target', () => {
  const { box } = ICON_BUTTON_SIZES[HEADER_BUTTON_SIZE];
  const slop = hitSlopFor(box, box);

  it("is the template's header button, grown to 44 by its slop", () => {
    expect(box + slop.top + slop.bottom).toBeGreaterThanOrEqual(MIN_TOUCH);
    expect(box + slop.left + slop.right).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  it('fits in a bar tall enough, padded enough and spaced enough for the slop', () => {
    const tightest = { minHeight: MIN_TOUCH, paddingX: slop.left, gap: slop.left + slop.right };
    expect(headerKeepsTouch(tightest)).toBe(true);
    expect(headerKeepsTouch({ minHeight: 48, paddingX: 12, gap: 8 })).toBe(true);
  });

  it('does not fit in a bar that is too short, too tight at the sides or between two buttons', () => {
    const tightest = { minHeight: MIN_TOUCH, paddingX: slop.left, gap: slop.left + slop.right };
    expect(headerKeepsTouch({ ...tightest, minHeight: tightest.minHeight - 1 })).toBe(false);
    expect(headerKeepsTouch({ ...tightest, paddingX: tightest.paddingX - 1 })).toBe(false);
    expect(headerKeepsTouch({ ...tightest, gap: tightest.gap - 1 })).toBe(false);
  });

  it.each(STYLE_IDS.flatMap((style) => SCHEMES.map((scheme) => [style, scheme] as const)))(
    "fits in the template's bar under %s %s",
    (style, scheme) => {
      const { spacing } = tokensFor(style, scheme);
      const room = {
        minHeight: headerMinHeight(HEADER_BAR.minHeight),
        paddingX: spacing[HEADER_BAR.paddingX],
        gap: spacing[HEADER_BAR.gap],
      };
      expect(headerKeepsTouch(room)).toBe(true);
    },
  );
});
