// The approval sheet a push opens (PRD-268 §6.11.4, §6.12.5 'the card or the push opens a bottom
// sheet', US-G08), pure: which grant's sheet is up. The push handler opens it for a verified tap on
// an approval's push whose grant still waits (src/push/inbound/handler.ts, only where discovery
// lists approval_view); PushApprovalSheet.tsx draws it over whatever screen the tap opened, in every
// layout (HUD's too, which draws no thread cards). One at a time: a newer tap replaces it. Closing
// keeps the grant while the sheet slides away. Memory only. A view that cannot be read says one
// line instead (viewFailureLine): a decided or lapsed approval (404), or anything else.

import { isApiError } from '../api/errors';
import { APPROVAL_SHEET_COPY } from './strings';

export type PushSheetState = {
  /** The grant whose sheet is up or sliding away; null before any tap. */
  readonly grantId: string | null;
  readonly visible: boolean;
};

export type PushApprovals = {
  readonly open: (grantId: string) => void;
  readonly close: () => void;
  readonly current: () => PushSheetState;
  readonly subscribe: (listener: () => void) => () => void;
};

const CLOSED: PushSheetState = Object.freeze({ grantId: null, visible: false });

export function createPushApprovals(): PushApprovals {
  let state: PushSheetState = CLOSED;
  let listeners: ReadonlySet<() => void> = new Set();
  const set = (next: PushSheetState) => {
    if (next.grantId === state.grantId && next.visible === state.visible) return;
    state = Object.freeze(next);
    listeners.forEach((listener) => listener());
  };
  return Object.freeze({
    open: (grantId: string) => set({ grantId, visible: true }),
    close: () => set({ ...state, visible: false }),
    current: () => state,
    subscribe: (listener: () => void) => {
      listeners = new Set([...listeners, listener]);
      return () => {
        listeners = new Set([...listeners].filter((each) => each !== listener));
      };
    },
  });
}

/** The app's one: the push handler opens it, PushApprovalSheet draws it. */
export const pushApprovals: PushApprovals = createPushApprovals();

/** The view's query key, under the approval grants' family (src/api/query-keys.ts: memory only). */
export function approvalViewKey(grantId: string) {
  return ['approval-grants', 'view', grantId] as const;
}

/** The line a push's sheet says when the view cannot be read; never the server's words. */
export function viewFailureLine(error: unknown): string {
  return isApiError(error) && error.kind === 'not_found'
    ? APPROVAL_SHEET_COPY.pushGone
    : APPROVAL_SHEET_COPY.pushUnreadable;
}
