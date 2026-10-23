// "Report this" on Auto's messages (D15, US-009c), pure: which row offers it and the accessible
// action that opens it. The foundation does the rest: src/ui/report.ts canReport is the gate (the
// server lists report_content and the role may report) and its ReportSheet sends the report
// (src/api/reports.ts), so this kit holds no second gate and no second report call. Only a message
// the server saved offers it: never the user's own, never the reply still being written (it has no
// id yet), never a saved failure (it shows this kit's words, not Auto's).

import type { AccessibilityActionEvent, AccessibilityActionInfo } from 'react-native';

import { REPORT_TARGET_ID_MAX_CHARS, type ReportTarget } from '../../api/reports';
import { REPORT_COPY } from '../../ui/strings';
import type { ChatRow } from '../view-model';

/** The custom action VoiceOver and TalkBack list on an Auto message. */
export const REPORT_ACTION = 'report';

const REPORT_ACTIONS: readonly AccessibilityActionInfo[] = Object.freeze([
  Object.freeze({ name: REPORT_ACTION, label: REPORT_COPY.action }),
]);

/** The thread's Report this: whether the gate is open (canReport) and how the sheet is opened. */
export type ThreadReport = {
  readonly allowed: boolean;
  readonly open: (target: ReportTarget) => void;
};

/** What Report this on the row would report, or null when the row offers nothing. */
export function reportTarget(row: ChatRow, allowed: boolean): ReportTarget | null {
  if (!allowed || row.type !== 'auto') return null;
  const id = row.messageId?.trim();
  // an id the server's target_id would refuse is never offered
  if (!id || id.length > REPORT_TARGET_ID_MAX_CHARS) return null;
  // a saved failure's only notice is 'failed'; a saved answer has none
  if (row.notices.some((notice) => notice.kind === 'failed')) return null;
  return { target_type: 'message', target_id: id };
}

export type ReportAccessibility = {
  readonly accessibilityActions?: readonly AccessibilityActionInfo[];
  readonly onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
};

/** 'Report this' on each part of the message a screen reader stops on; nothing when not offered. */
export function reportAccessibility(onReport: (() => void) | undefined): ReportAccessibility {
  if (!onReport) return {};
  return {
    accessibilityActions: REPORT_ACTIONS,
    onAccessibilityAction: (event) => {
      if (event.nativeEvent.actionName === REPORT_ACTION) onReport();
    },
  };
}
