// "Report this": who is offered it (the capability and the role), the draft the sheet holds and the
// payload it sends, and the reason list's ids against the server's.

import { describe, expect, it } from 'vitest';

import type { GateInput } from '../../api/capabilities';
import { CAPABILITIES } from '../../api/discovery';
import {
  REPORT_NOTE_MAX_CHARS,
  REPORT_REASONS,
  buildReportPayload,
  type ReportTarget,
} from '../../api/reports';
import { WORKSPACE_ROLES } from '../../api/workspace';
import {
  EMPTY_REPORT_DRAFT,
  canReport,
  draftPayload,
  noteCounter,
  reportSentMessage,
  sameTarget,
  withNote,
  withReason,
} from '../report';
import { REPORT_COPY, REPORT_REASON_CHOICES } from '../strings';

const WITH_REPORTS: GateInput = { capabilities: ['report_content'], push: { expo: true } };
const WITHOUT_REPORTS: GateInput = {
  capabilities: CAPABILITIES.filter((capability) => capability !== 'report_content'),
  push: { expo: true },
};
const MESSAGE: ReportTarget = { target_type: 'message', target_id: 'msg-0419' };

describe('canReport: the capability and role gate', () => {
  it('opens for owners, admins and editors on a server that takes reports', () => {
    for (const role of ['owner', 'admin', 'editor'] as const) {
      expect(canReport(WITH_REPORTS, role)).toBe(true);
    }
  });

  it('stays closed for a viewer (a read-only app, D17)', () => {
    expect(canReport(WITH_REPORTS, 'viewer')).toBe(false);
  });

  it('stays closed when the server does not list report_content, for every role', () => {
    for (const role of WORKSPACE_ROLES) expect(canReport(WITHOUT_REPORTS, role)).toBe(false);
  });

  it('stays closed while discovery or the role is still loading', () => {
    expect(canReport(null, 'owner')).toBe(false);
    expect(canReport(undefined, 'owner')).toBe(false);
    expect(canReport(WITH_REPORTS, null)).toBe(false);
    expect(canReport(WITH_REPORTS, undefined)).toBe(false);
  });
});

describe('the reason list', () => {
  it("has EXACTLY the server's ids, in its order", () => {
    expect(REPORT_REASON_CHOICES.map((choice) => choice.id)).toEqual([
      'harmful',
      'offensive',
      'inaccurate',
      'privacy',
      'other',
    ]);
    expect(REPORT_REASON_CHOICES.map((choice) => choice.id)).toEqual([...REPORT_REASONS]);
  });

  it('gives each a plain label of its own', () => {
    const labels = REPORT_REASON_CHOICES.map((choice) => choice.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) {
      expect(label.trim()).toBe(label);
      expect(label).not.toMatch(/_/);
      expect(label.length).toBeGreaterThan(3);
    }
  });

  it('titles the sheet for a message and for a Deliverable', () => {
    expect(REPORT_COPY.titles.message).toBe('Report this message');
    expect(REPORT_COPY.titles.deliverable).toBe('Report this Deliverable');
  });
});

describe('sameTarget', () => {
  it('matches by type and id, so a re-rendered target keeps the draft', () => {
    expect(sameTarget(MESSAGE, { ...MESSAGE })).toBe(true);
    expect(sameTarget(MESSAGE, { ...MESSAGE, target_id: 'msg-0420' })).toBe(false);
    expect(sameTarget(MESSAGE, { ...MESSAGE, target_type: 'deliverable' })).toBe(false);
  });

  it('treats closed (null) as its own value', () => {
    expect(sameTarget(null, null)).toBe(true);
    expect(sameTarget(MESSAGE, null)).toBe(false);
    expect(sameTarget(null, MESSAGE)).toBe(false);
  });
});

describe('the draft', () => {
  it('starts with no reason and no note, and cannot be sent', () => {
    expect(EMPTY_REPORT_DRAFT).toEqual({ reason: null, note: '' });
    expect(draftPayload(MESSAGE, EMPTY_REPORT_DRAFT)).toBeNull();
  });

  it('changes by copy, never in place', () => {
    const chosen = withReason(EMPTY_REPORT_DRAFT, 'harmful');
    const noted = withNote(chosen, 'unsafe advice');
    expect(EMPTY_REPORT_DRAFT.reason).toBeNull();
    expect(chosen).toEqual({ reason: 'harmful', note: '' });
    expect(noted).toEqual({ reason: 'harmful', note: 'unsafe advice' });
  });

  it('cuts a pasted note at 500 characters', () => {
    const pasted = withNote(EMPTY_REPORT_DRAFT, 'n'.repeat(REPORT_NOTE_MAX_CHARS + 40));
    expect(pasted.note).toHaveLength(REPORT_NOTE_MAX_CHARS);
    expect(noteCounter(pasted.note)).toBe('500 / 500');
    expect(noteCounter('')).toBe('0 / 500');
  });
});

describe('the payload', () => {
  it('sends the target and the reason id, with no note when none was written', () => {
    const payload = draftPayload(MESSAGE, withReason(EMPTY_REPORT_DRAFT, 'inaccurate'));
    expect(payload).toEqual({
      target_type: 'message',
      target_id: 'msg-0419',
      reason: 'inaccurate',
    });
  });

  it('sends the id, never the label', () => {
    for (const choice of REPORT_REASON_CHOICES) {
      const payload = draftPayload(MESSAGE, withReason(EMPTY_REPORT_DRAFT, choice.id));
      expect(payload?.reason).toBe(choice.id);
      expect(JSON.stringify(payload)).not.toContain(choice.label);
    }
  });

  it('trims the note and leaves a blank one out', () => {
    const chosen = withReason(EMPTY_REPORT_DRAFT, 'privacy');
    expect(draftPayload(MESSAGE, withNote(chosen, '  has an address  '))?.note).toBe(
      'has an address',
    );
    expect(draftPayload(MESSAGE, withNote(chosen, '    '))).not.toHaveProperty('note');
  });

  it('holds back a note over 500 characters that did not come through withNote', () => {
    const long = { reason: 'other' as const, note: 'n'.repeat(REPORT_NOTE_MAX_CHARS + 1) };
    expect(draftPayload(MESSAGE, long)).toBeNull();
  });

  it('builds a body the server takes, for a Deliverable too', () => {
    const target: ReportTarget = { target_type: 'deliverable', target_id: 'DLV-0311' };
    const payload = draftPayload(target, withNote(withReason(EMPTY_REPORT_DRAFT, 'other'), 'x'));
    expect(payload).not.toBeNull();
    if (payload) {
      expect(buildReportPayload(payload)).toEqual({
        target_type: 'deliverable',
        target_id: 'DLV-0311',
        reason: 'other',
        note: 'x',
      });
    }
  });
});

describe('after sending', () => {
  it('thanks a new report and says so when it was already reported', () => {
    expect(reportSentMessage({ status: 'received' })).toBe(REPORT_COPY.sent);
    expect(reportSentMessage({ status: 'already_received' })).toBe(REPORT_COPY.alreadySent);
  });
});
