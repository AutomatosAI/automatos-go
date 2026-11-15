// The approval sheet a push opens (PRD-268 §6.11.4, §6.12.5 'the card or the push opens a bottom
// sheet', US-G08), pure: which grant's sheet is up. The push handler opens it for a verified tap on
// an approval's push whose grant still waits (src/push/inbound/handler.ts, only where discovery
// lists approval_view); PushApprovalSheet.tsx draws it over whatever screen the tap opened, in every
// layout (HUD's too, which draws no thread cards). One at a time: a newer tap replaces it. Closing
// keeps the grant while the sheet slides away. Memory only. Its id is a tool approval's grant, or a
// Mission plan's id (`kind` 'plan': core's view reads either, approval_views.py view_of), so a
// Mission plan's push or inbox row opens its plan here rather than Studio's page. A view that cannot be read says one
// line instead (viewFailureLine): a decided or lapsed approval (404), or anything else.

import { isApiError } from '../api/errors';
import { toolLine } from '../chat/cards/grants';
import type { CardOutcome } from '../chat/cards/model';
import { CARD_COPY } from '../chat/strings';
import type { SheetKind } from './sheet-view';
import { APPROVAL_SHEET_COPY } from './strings';

export type PushSheetState = {
  /** The grant (or Mission plan) whose sheet is up or sliding away; null before any tap. */
  readonly grantId: string | null;
  /** A tool approval's answers, or a Mission plan's. */
  readonly kind: SheetKind;
  readonly visible: boolean;
};

export type PushApprovals = {
  /** `kind` defaults to a tool approval's sheet. */
  readonly open: (grantId: string, kind?: SheetKind) => void;
  readonly close: () => void;
  readonly current: () => PushSheetState;
  readonly subscribe: (listener: () => void) => () => void;
};

const CLOSED: PushSheetState = Object.freeze({ grantId: null, kind: 'tool', visible: false });

export function createPushApprovals(): PushApprovals {
  let state: PushSheetState = CLOSED;
  let listeners: ReadonlySet<() => void> = new Set();
  const set = (next: PushSheetState) => {
    const same =
      next.grantId === state.grantId && next.kind === state.kind && next.visible === state.visible;
    if (same) return;
    state = Object.freeze(next);
    listeners.forEach((listener) => listener());
  };
  return Object.freeze({
    open: (grantId: string, kind: SheetKind = 'tool') => set({ grantId, kind, visible: true }),
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

/**
 * The view's query key. No family in src/api/query-keys.ts claims it, so it is memory only and no
 * other screen's invalidation refetches it under the open sheet.
 */
export function approvalViewKey(grantId: string) {
  return ['approval-view', grantId] as const;
}

/** The line a push's sheet says when the view cannot be read; never the server's words. */
export function viewFailureLine(error: unknown): string {
  return isApiError(error) && error.kind === 'not_found'
    ? APPROVAL_SHEET_COPY.pushGone
    : APPROVAL_SHEET_COPY.pushUnreadable;
}

/** What the sheet says once the server agreed: a tool approval's line, or the plan card's words. */
export function settledLine(kind: SheetKind, outcome: CardOutcome): string {
  if (kind === 'tool') return toolLine(outcome).text;
  return outcome.state === 'rejected' ? CARD_COPY.rejected : CARD_COPY.approved;
}
