// The approval sheet as the phone draws it (PRD-268 §6.11.4, §6.12.3 'Approval view', US-G08), pure:
// who asked, the action, its target, the exact preview and the rule sentence, read in that order and
// before the buttons, then Allow once (today's 'Approve & run', full width and primary) and Refuse
// ('Deny' on a tool, 'Reject' on a plan) under it. Always allow is offered only when the view's
// answers hold it (core W2 never sends it, K10), as a link to a confirm sheet. While it waits the
// expiry counts down in minutes; once past it, Allow is not offered (the server would refuse it).

import type { ApprovalView } from '../core/approval-view';
import { APPROVAL_SHEET_COPY } from './strings';

const MINUTE_MS = 60_000;

export type SheetKind = 'tool' | 'plan';

export type ApprovalSheetView = {
  readonly askedBy: string;
  readonly title: string;
  /** 'Press list · 214 people · Gmail'; null when the view names no target. */
  readonly target: string | null;
  readonly preview: ApprovalView['preview'] | null;
  /** 'What it will send' for a send, the neutral words for a verb this version does not name. */
  readonly previewLabel: string;
  readonly rule: string;
  /** 'Waiting · 4 min left'; the expired line once past it; null without an expiry. */
  readonly waiting: string | null;
  readonly expired: boolean;
  readonly allow: string | null;
  readonly refuse: string | null;
  readonly alwaysAllow: boolean;
  /** VoiceOver hears the request and the rule before any button. */
  readonly accessibilityLabel: string;
};

function offers(view: ApprovalView, answer: ApprovalView['answers'][number]): boolean {
  // a view that names no answers offers today's two (never Always allow)
  return view.answers.length === 0 ? answer !== 'always_allow' : view.answers.includes(answer);
}

function previewLabelOf(verb: string): string {
  const labels = APPROVAL_SHEET_COPY.previewLabels;
  return Object.prototype.hasOwnProperty.call(labels, verb)
    ? labels[verb]
    : APPROVAL_SHEET_COPY.previewLabel;
}

function targetLine(target: ApprovalView['target']): string | null {
  if (!target) return null;
  return target.detail ? `${target.label} · ${target.detail}` : target.label;
}

/** Minutes left before it lapses, rounded up; null without a readable expiry. */
export function minutesLeft(expiresAt: string | null | undefined, now: number): number | null {
  const at = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.ceil((at - now) / MINUTE_MS));
}

function waitingLine(left: number | null): string | null {
  if (left === null) return null;
  return left === 0 ? APPROVAL_SHEET_COPY.expired : APPROVAL_SHEET_COPY.expiresIn(left);
}

export function approvalSheetView(
  view: ApprovalView,
  kind: SheetKind,
  now: number,
): ApprovalSheetView {
  const left = minutesLeft(view.expires_at, now);
  const expired = left === 0;
  const target = targetLine(view.target);
  const rule = APPROVAL_SHEET_COPY.rule(view.rule.sentence);
  const askedBy = APPROVAL_SHEET_COPY.askedBy(view.asked_by.name);
  const refuseWord =
    kind === 'plan' ? APPROVAL_SHEET_COPY.refusePlan : APPROVAL_SHEET_COPY.refuseTool;
  return {
    askedBy,
    title: view.action.summary,
    target,
    preview: view.preview ?? null,
    previewLabel: previewLabelOf(view.action.verb),
    rule,
    waiting: waitingLine(left),
    expired,
    allow: offers(view, 'allow_once') && !expired ? APPROVAL_SHEET_COPY.allow : null,
    refuse: offers(view, 'refuse') ? refuseWord : null,
    alwaysAllow: !expired && view.answers.includes('always_allow'),
    accessibilityLabel: [askedBy, view.action.summary, target, rule].filter(Boolean).join('. '),
  };
}
