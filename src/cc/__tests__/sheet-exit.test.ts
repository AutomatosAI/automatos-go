import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../../navigation/routes';
import { SHEET_DURATION_MS } from '../../ui/overlay';
import { firstExit, leaveSheet, type SheetExit } from '../sheet-exit';
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
