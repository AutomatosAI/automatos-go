// The open sheet route (open-sheet.ts): none until a sheet route attaches; a later attach wins and a
// stale detach changes nothing; asked to leave for a screen, the sheet leaves the way its own push
// does (sheet-exit.ts: slide, back, then the push, never over the sheet); and useSheetRoute attaches
// that push only while its route is focused (read from the source: the hook needs a navigator).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../../navigation/routes';
import { SHEET_DURATION_MS } from '../../ui/overlay';
import { createOpenSheetStore, openSheets, type OpenSheet } from '../open-sheet';
import { OVER_THE_SHEET, testSheetRoute } from './sheet-router';

const TARGET = routes.cc.ticket('8812');

const sheet = (): OpenSheet => ({ leaveFor: () => undefined });

describe('the open sheet store', () => {
  it('holds no sheet until one attaches, then that one, until it detaches', () => {
    const store = createOpenSheetStore();
    expect(store.current()).toBeNull();
    const ticket = sheet();
    const detach = store.attach(ticket);
    expect(store.current()).toBe(ticket);
    detach();
    expect(store.current()).toBeNull();
  });

  it('a later attach wins, and the earlier sheet detaching late changes nothing', () => {
    const store = createOpenSheetStore();
    const ticket = sheet();
    const social = sheet();
    const detachTicket = store.attach(ticket);
    const detachSocial = store.attach(social);
    expect(store.current()).toBe(social);
    detachTicket();
    expect(store.current()).toBe(social);
    detachSocial();
    detachSocial();
    expect(store.current()).toBeNull();
  });

  it("the app's one store starts with no sheet open", () => {
    expect(openSheets.current()).toBeNull();
  });
});

describe('an open sheet asked to leave for a screen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("slides away, leaves the route, then pushes the screen: the route's own push", () => {
    const store = createOpenSheetStore();
    const route = testSheetRoute();
    store.attach({ leaveFor: route.push });
    store.current()?.leaveFor(TARGET);
    vi.advanceTimersByTime(SHEET_DURATION_MS - 1);
    expect(route.calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(route.calls).toEqual(['back', `push ${TARGET}`]);
    expect(route.calls.some((call) => call.endsWith(OVER_THE_SHEET))).toBe(false);
  });
});

describe('useSheetRoute (read from the source)', () => {
  const source = readFileSync(path.resolve(__dirname, '../use-sheet-route.ts'), 'utf8');

  it("attaches its push as the open sheet while focused; the focus effect's cleanup detaches it", () => {
    expect(source).toMatch(
      /useFocusEffect\(useCallback\(\(\) => openSheets\.attach\(\{ leaveFor \}\), \[leaveFor\]\)\)/,
    );
    expect(source).toMatch(/useOpenWhileFocused\(exits\.push\);/);
  });
});
