import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../../navigation/routes';
import { SHEET_DURATION_MS } from '../../ui/overlay';
import {
  firstExit,
  leaveAfterSlide,
  leaveOnceAfterSlide,
  leaveSheet,
  type LeftBy,
  type SheetExit,
  type SheetNavigation,
} from '../sheet-exit';
import { OVER_THE_SHEET, recordingRouter, testSheetRoute } from './sheet-router';

const CHAT = routes.chatWithTicket(2680);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a sheet route's push", () => {
  it('leaves the route, then pushes, once the sheet has slid away', () => {
    const route = testSheetRoute();
    route.push(CHAT);
    vi.advanceTimersByTime(SHEET_DURATION_MS - 1);
    expect(route.calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(route.calls).toEqual(['back', `push ${CHAT}`]);
  });

  it('never pushes while the sheet route is presented', () => {
    const { calls, navigation } = recordingRouter();
    leaveSheet({ kind: 'push', href: CHAT }, navigation);
    expect(calls).toEqual(['back', `push ${CHAT}`]);
    expect(calls.some((call) => call.endsWith(OVER_THE_SHEET))).toBe(false);
  });

  it('does nothing when the route goes before the slide ends', () => {
    const route = testSheetRoute();
    route.push(CHAT);
    route.unmount();
    vi.advanceTimersByTime(SHEET_DURATION_MS);
    expect(route.calls).toEqual([]);
  });
});

describe("a sheet route's close and replaceWith", () => {
  it('close slides away, then goes back', () => {
    const route = testSheetRoute();
    route.close();
    vi.advanceTimersByTime(SHEET_DURATION_MS - 1);
    expect(route.calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(route.calls).toEqual(['back']);
  });

  it('replaceWith slides away, then puts the Command Centre screen in its place', () => {
    const route = testSheetRoute();
    route.replaceWith(routes.cc.questions);
    vi.advanceTimersByTime(SHEET_DURATION_MS - 1);
    expect(route.calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(route.calls).toEqual([`replace ${routes.cc.questions}`]);
  });
});

describe('the first exit asked for', () => {
  it('wins over a second tap while the sheet slides away', () => {
    const pushed = testSheetRoute();
    pushed.push(CHAT);
    pushed.close();
    vi.advanceTimersByTime(SHEET_DURATION_MS);
    expect(pushed.calls).toEqual(['back', `push ${CHAT}`]);

    const closed = testSheetRoute();
    closed.close();
    closed.push(CHAT);
    vi.advanceTimersByTime(SHEET_DURATION_MS);
    expect(closed.calls).toEqual(['back']);
  });

  it('is kept by firstExit', () => {
    const back: SheetExit = { kind: 'back' };
    const push: SheetExit = { kind: 'push', href: CHAT };
    expect(firstExit(null, push)).toBe(push);
    expect(firstExit(back, push)).toBe(back);
  });
});

/**
 * The route's effect as React runs it: each render that changes a dependency cleans the last run up
 * and runs the effect again. `effect` is the body; the navigation handed to it is a new one each time,
 * as a back function with a new identity would be.
 */
function effectOver(effect: (navigation: SheetNavigation) => (() => void) | undefined) {
  const router = recordingRouter();
  let cleanup: (() => void) | undefined;
  const render = () => {
    cleanup?.();
    cleanup = effect({
      goBack: () => router.navigation.goBack(),
      replace: (href) => router.navigation.replace(href),
      push: (href) => router.navigation.push(href),
    });
  };
  return { calls: router.calls, render, unmount: () => cleanup?.() };
}

describe('a sheet route leaves once per exit, whatever renders it again', () => {
  const push: SheetExit = { kind: 'push', href: CHAT };

  it('leaves once when the back function changes after the leave, while the screen is still mounted', () => {
    const left: LeftBy = { current: null };
    const route = effectOver((navigation) => leaveOnceAfterSlide(push, navigation, left));
    route.render();
    vi.advanceTimersByTime(SHEET_DURATION_MS);
    expect(route.calls).toEqual(['back', `push ${CHAT}`]);
    route.render(); // the path changed: a new back function, the effect runs again
    vi.advanceTimersByTime(SHEET_DURATION_MS * 3);
    expect(route.calls).toEqual(['back', `push ${CHAT}`]);
  });

  it('leaves once, by the newest back function, when it changes during the slide', () => {
    const left: LeftBy = { current: null };
    const route = effectOver((navigation) => leaveOnceAfterSlide(push, navigation, left));
    route.render();
    vi.advanceTimersByTime(SHEET_DURATION_MS - 1);
    route.render();
    vi.advanceTimersByTime(SHEET_DURATION_MS);
    route.render();
    vi.advanceTimersByTime(SHEET_DURATION_MS);
    expect(route.calls).toEqual(['back', `push ${CHAT}`]);
  });

  it('leaves not at all when there is no exit, or the route unmounts before the slide ends', () => {
    const left: LeftBy = { current: null };
    const idle = effectOver((navigation) => leaveOnceAfterSlide(null, navigation, left));
    idle.render();
    vi.advanceTimersByTime(SHEET_DURATION_MS);
    expect(idle.calls).toEqual([]);
    const gone = effectOver((navigation) => leaveOnceAfterSlide(push, navigation, left));
    gone.render();
    gone.unmount();
    vi.advanceTimersByTime(SHEET_DURATION_MS);
    expect(gone.calls).toEqual([]);
  });

  it('the fault it closes: leaving after every slide left twice (back, push, back again)', () => {
    const route = effectOver((navigation) => leaveAfterSlide(push, navigation));
    route.render();
    vi.advanceTimersByTime(SHEET_DURATION_MS);
    route.render();
    vi.advanceTimersByTime(SHEET_DURATION_MS);
    expect(route.calls).toEqual(['back', `push ${CHAT}`, 'back', `push ${CHAT}`]);
  });
});
