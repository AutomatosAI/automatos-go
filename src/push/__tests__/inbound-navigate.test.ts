// A notification's screen past an open sheet route (inbound/navigate.ts): with a ticket or social
// sheet open, the handler's route goes to that sheet's leaving push and the router's push is never
// called (a screen pushed under the sheet's invisible modal takes no touch); with none open, the
// router pushes it as before. The hook passes router.push through navigateFor (read from the source).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { OVER_THE_SHEET, testSheetRoute } from '../../cc/__tests__/sheet-router';
import { createOpenSheetStore } from '../../cc/open-sheet';
import { routes } from '../../navigation/routes';
import { SHEET_DURATION_MS } from '../../ui/overlay';
import { DEFAULT_ACTION_ID } from '../config';
import { handleResponse } from '../inbound/handler';
import { navigateFor } from '../inbound/navigate';
import { REVIEW_FIELDS, response, signed, world } from './handler-fixtures';

const TICKET = routes.cc.ticket('8812');
const TAP = response(signed(REVIEW_FIELDS), DEFAULT_ACTION_ID);

afterEach(() => {
  vi.useRealTimers();
});

/** A tap handled with the router's push and the given sheets; what each was asked. */
function routing() {
  const pushed: string[] = [];
  const asked: string[] = [];
  const sheets = createOpenSheetStore();
  const run = world();
  const navigate = navigateFor((route) => void pushed.push(route), sheets);
  return { pushed, asked, sheets, navigate, deps: { ...run.deps, navigate } };
}

describe('navigateFor', () => {
  it('a sheet open: the sheet is asked to leave for the route; the router never pushes', () => {
    const { pushed, asked, sheets, navigate } = routing();
    sheets.attach({ leaveFor: (route) => void asked.push(route) });
    navigate(TICKET);
    expect(asked).toEqual([TICKET]);
    expect(pushed).toEqual([]);
  });

  it('no sheet open, or the sheet gone: the router pushes the route as before', () => {
    const { pushed, sheets, navigate } = routing();
    navigate(TICKET);
    sheets.attach({ leaveFor: () => undefined })();
    navigate(routes.cc.questions);
    expect(pushed).toEqual([TICKET, routes.cc.questions]);
  });
});

describe("handleResponse with the hook's navigate", () => {
  it("a tap while a sheet is open → the sheet's exit gets the ticket; router.push is not called", async () => {
    const { pushed, asked, sheets, deps } = routing();
    sheets.attach({ leaveFor: (route) => void asked.push(route) });
    expect(await handleResponse(TAP, deps)).toEqual({ route: TICKET });
    expect(asked).toEqual([TICKET]);
    expect(pushed).toEqual([]);
  });

  it('a tap with no sheet open → router.push gets the ticket, as before', async () => {
    const { pushed, deps } = routing();
    expect(await handleResponse(TAP, deps)).toEqual({ route: TICKET });
    expect(pushed).toEqual([TICKET]);
  });

  it('through a sheet route: slide, back, then the push, never over the sheet', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { pushed, sheets, deps } = routing();
    const sheet = testSheetRoute();
    sheets.attach({ leaveFor: sheet.push });
    await handleResponse(TAP, deps);
    expect(sheet.calls).toEqual([]);
    vi.advanceTimersByTime(SHEET_DURATION_MS);
    expect(sheet.calls).toEqual(['back', `push ${TICKET}`]);
    expect(sheet.calls.some((call) => call.endsWith(OVER_THE_SHEET))).toBe(false);
    expect(pushed).toEqual([]);
  });
});

describe('useNotificationResponses (read from the source)', () => {
  const source = readFileSync(
    path.resolve(__dirname, '../inbound/use-notification-responses.ts'),
    'utf8',
  );

  it('hands the handler router.push through navigateFor, never router.push bare', () => {
    expect(source).toMatch(/navigate: navigateFor\(\(route: string\) => router\.push\(route\)\),/);
    expect(source).not.toMatch(/navigate: \(route[^)]*\) => router\.push/);
  });
});
