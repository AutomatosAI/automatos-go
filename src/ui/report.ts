// The "Report this" flow's logic, pure (D15, K5): whether to offer it, the draft the sheet holds,
// and the payload it sends. The chat (A2) and Command Centre (A3) waves both mount ReportSheet and
// ask canReport() before showing the action, so the gate is the same everywhere: the server lists
// report_content (D-CAPABILITIES) and the caller's role may report (D-ROLES).

import { canReportContent, type GateInput } from '../api/capabilities';
import {
  REPORT_NOTE_MAX_CHARS,
  type ReportInput,
  type ReportReason,
  type ReportReceipt,
  type ReportTarget,
} from '../api/reports';
import type { WorkspaceRole } from '../api/workspace';
import { roleCan } from '../auth/role';
import { REPORT_COPY } from './strings';

/** Shown only when the server takes reports and the role may send one; closed while either loads. */
export function canReport(discovery: GateInput, role: WorkspaceRole | null | undefined): boolean {
  return canReportContent(discovery) && roleCan(role, 'report');
}

/** The same message or Deliverable: a new object for the same target keeps the draft. */
export function sameTarget(a: ReportTarget | null, b: ReportTarget | null): boolean {
  if (a === null || b === null) return a === b;
  return a.target_type === b.target_type && a.target_id === b.target_id;
}

export type ReportDraft = { readonly reason: ReportReason | null; readonly note: string };

export const EMPTY_REPORT_DRAFT: ReportDraft = Object.freeze({ reason: null, note: '' });

export function withReason(draft: ReportDraft, reason: ReportReason): ReportDraft {
  return { ...draft, reason };
}

/** The note as typed, cut at the server's 500 characters (a paste can run past maxLength). */
export function withNote(draft: ReportDraft, note: string): ReportDraft {
  return { ...draft, note: note.slice(0, REPORT_NOTE_MAX_CHARS) };
}

/** '12 / 500' under the note. */
export function noteCounter(note: string): string {
  return `${note.length} / ${REPORT_NOTE_MAX_CHARS}`;
}

/** What Send posts, or null until a reason is chosen. */
export function draftPayload(target: ReportTarget, draft: ReportDraft): ReportInput | null {
  if (draft.reason === null || draft.note.length > REPORT_NOTE_MAX_CHARS) return null;
  const note = draft.note.trim();
  return { ...target, reason: draft.reason, ...(note ? { note } : {}) };
}

/** The toast after a send: thanks, or that this member already reported it. */
export function reportSentMessage(receipt: Pick<ReportReceipt, 'status'>): string {
  return receipt.status === 'already_received' ? REPORT_COPY.alreadySent : REPORT_COPY.sent;
}
